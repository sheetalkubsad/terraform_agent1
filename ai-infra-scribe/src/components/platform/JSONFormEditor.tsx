import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, CheckCircle2, X, RefreshCw, Plus, Loader2 } from "lucide-react";

interface JSONFormEditorProps {
  jsonData: any;
  isSubmitting?: boolean;
  onChange?: (editedData: any) => void;
  onApply: (editedData: any) => void;
  onCancel?: () => void;
}

export function JSONFormEditor({ jsonData, isSubmitting = false, onChange, onApply, onCancel }: JSONFormEditorProps) {
  const [editedData, setEditedData] = useState(jsonData);
  const [isEditing, setIsEditing] = useState(false);

  const getNestedValue = (obj: any, path: string[]): any => {
    let current = obj;
    for (const key of path) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  const updateField = (path: string[], value: any) => {
    const newData = JSON.parse(JSON.stringify(editedData));
    let current = newData;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setEditedData(newData);
    
    // Notify parent of changes
    onChange?.(newData);
  };

  const renderField = (key: string, value: any, path: string[] = []) => {
    const fullPath = [...path, key];
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={fullPath.join('.')} className="space-y-2 pl-4 border-l-2 border-border">
          <label className="text-xs font-semibold text-foreground capitalize">
            {key.replace(/_/g, ' ')}
          </label>
          {Object.entries(value).map(([k, v]) => renderField(k, v, fullPath))}
        </div>
      );
    }
    
    const inputValue = getNestedValue(editedData, fullPath) ?? value;
    const displayKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    
    return (
      <div key={fullPath.join('.')} className="space-y-1">
        <label className="text-xs font-medium text-foreground capitalize">
          {displayKey}
        </label>
        {typeof value === 'boolean' ? (
          <select
            value={String(inputValue)}
            onChange={(e) => updateField(fullPath, e.target.value === 'true')}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : typeof value === 'number' ? (
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => updateField(fullPath, Number(e.target.value))}
            disabled={!isEditing}
            className="text-sm"
          />
        ) : String(value).length > 50 ? (
          <Textarea
            value={inputValue}
            onChange={(e) => updateField(fullPath, e.target.value)}
            disabled={!isEditing}
            className="text-sm font-mono"
            rows={3}
          />
        ) : (
          <Input
            value={inputValue}
            onChange={(e) => updateField(fullPath, e.target.value)}
            disabled={!isEditing}
            className="text-sm"
          />
        )}
      </div>
    );
  };

  const handleApply = () => {
    console.log('✅ User clicked Apply - submitting to backend:', editedData);
    onApply(editedData);
    setIsEditing(false);
  };

  // Determine if this is an update or create operation
  const isUpdate = editedData.module_name || editedData._operation === 'update';
  const operationType = isUpdate ? 'Update' : 'Create';

  return (
    <div className="rounded-xl border border-primary/30 bg-card/50 shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-primary" />
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {editedData.resource_type ? `${operationType} Resource Configuration` : `${operationType} Configuration`}
            </h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isUpdate 
                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                : 'bg-green-500/10 text-green-600 border border-green-500/20'
            }`}>
              {isUpdate ? (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5" />
                  Update
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Plus className="h-2.5 w-2.5" />
                  Create
                </span>
              )}
            </span>
          </div>
          {isUpdate && (
            <p className="text-xs text-muted-foreground ml-2">
              Review changes and click "Submit Update" when ready
            </p>
          )}
        </div>
        {!isEditing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="h-8"
          >
            <Edit3 className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditedData(jsonData);
                setIsEditing(false);
                onCancel?.();
              }}
              className="h-8"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isSubmitting}
              className="h-8 gradient-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {isUpdate ? 'Approve and Submit' : 'Approve and Submit'}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-2">
        {Object.entries(editedData).map(([key, value]) => renderField(key, value))}
      </div>

      {isEditing && (
        <div className="pt-3 border-t border-border">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View JSON
            </summary>
            <pre className="mt-2 p-3 rounded-lg bg-muted/50 border border-border overflow-x-auto">
              <code>{JSON.stringify(editedData, null, 2)}</code>
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
