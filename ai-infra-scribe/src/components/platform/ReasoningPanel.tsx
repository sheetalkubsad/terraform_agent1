import { useMemo, useState, useEffect } from "react";
import { Brain, Sparkles, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { WorkflowPanel, type WorkflowStep } from "./WorkflowPanel";
import { JSONFormEditor } from "./JSONFormEditor";

export interface ReasoningStep {
  id: string;
  agent: string;
  text: string;
  timestamp: Date;
  type: "analysis" | "decision" | "action" | "result";
}

export function ReasoningPanel({ 
  steps, 
  workflowSteps = [],
  editableJsons = [],
  isSubmittingPR = false,
  onApplyEditableJson,
  onCancelEditableJson,
}: { 
  steps: ReasoningStep[];
  workflowSteps?: WorkflowStep[];
  editableJsons?: any[];
  isSubmittingPR?: boolean;
  onApplyEditableJson?: (json: any, index: number) => void;
  onCancelEditableJson?: (index: number) => void;
}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  // Track edited versions of JSONs - initialized from editableJsons
  const [editedJsons, setEditedJsons] = useState<any[]>([]);
  
  // Update edited versions when editableJsons changes
  useEffect(() => {
    setEditedJsons([...editableJsons]);
  }, [editableJsons]);

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };
  const statusText = useMemo(() => {
    if (workflowSteps.some((step) => step.status === "failed")) return "Workflow failed - needs attention";
    if (workflowSteps.some((step) => step.status === "running")) return "Processing workflow after approval";
    if (workflowSteps.length > 0 && workflowSteps.every((step) => step.status === "completed")) return "All workflow steps completed successfully";
    if (editableJsons.length > 0) return `Review and approve ${editableJsons.length} configuration${editableJsons.length > 1 ? 's' : ''}`;
    if (steps.length > 0) return "Agent is analyzing your request";
    return "Waiting for your request";
  }, [steps.length, workflowSteps, editableJsons.length]);

  const summarizeStepText = (text: string): { summary: string; details?: string } => {
    // Handle JSON-like responses
    if (text.includes('{"') && text.includes('"}')) {
      try {
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          
          // Handle workflow trigger responses
          if (jsonData.message && jsonData.message.includes('Workflow triggered')) {
            return {
              summary: `Workflow triggered successfully`,
              details: jsonData.repo ? `Repository: ${jsonData.repo}` : undefined
            };
          }
          
          // Handle module creation responses
          if (jsonData.result && jsonData.result.includes('module')) {
            const moduleMatch = jsonData.result.match(/module\\?"([^"]+)\\?"?/);
            const datasetMatch = jsonData.result.match(/datasetId\\?s*=\\?s*\\?"([^"]+)\\?"?/);
            if (moduleMatch || datasetMatch) {
              return {
                summary: `Module configuration generated`,
                details: datasetMatch ? `Dataset: ${datasetMatch[1]}` : `Module: ${moduleMatch?.[1] || 'terraform module'}`
              };
            }
          }
          
          // Handle GitHub workflow responses
          if (jsonData.run_html_url && jsonData.run_status) {
            return {
              summary: `GitHub workflow initiated`,
              details: `Status: ${jsonData.run_status} • Run #${jsonData.run_number || 'N/A'}`
            };
          }
        }
      } catch (e) {
        // If JSON parsing fails, check for GitHub URLs and workflow info
        if (text.includes('github.com') && text.includes('actions/runs')) {
          const urlMatch = text.match(/https:\/\/github\.com\/[^"'\s]+/);
          const runMatch = text.match(/run_number"?:\s*(\d+)/);
          return {
            summary: `GitHub workflow started`,
            details: runMatch ? `Run #${runMatch[1]}` : undefined
          };
        }
      }
    }
    
    // Handle long text responses
    if (text.length > 120) {
      // Extract key information from long responses
      if (text.includes('BigQuery dataset') || text.includes('dataset')) {
        return {
          summary: `BigQuery dataset configuration completed`,
          details: text.includes('terraform_agent1') ? 'Repository: terraform_agent1' : undefined
        };
      }
      
      if (text.includes('branch has been created')) {
        const urlMatch = text.match(/https:\/\/[^\s]+/);
        return {
          summary: `Branch created and workflow triggered`,
          details: urlMatch ? `Monitor: ${urlMatch[0]}` : undefined
        };
      }
      
      // Generic long text truncation
      return {
        summary: text.substring(0, 80) + '...',
        details: 'Click to view full details'
      };
    }
    
    return { summary: text };
  };

  const completedCount = workflowSteps.filter((step) => step.status === "completed").length;
  const totalCount = workflowSteps.length;
  const totalActivityCount = steps.length + workflowSteps.length + editableJsons.length;

  return (
    <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden">
      <div className="px-4 py-4 border-b border-border">
        <div className="rounded-xl border border-border bg-card/60 p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <motion.span
                className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-success"
                animate={{ scale: [1, 1.35, 1], opacity: [0.85, 0.3, 0.85] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Agent Runtime</p>
              <p className="text-xs text-muted-foreground">{statusText}</p>
            </div>
            <Sparkles className="h-4 w-4 text-primary/80" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-muted">{totalActivityCount} activities</span>
            {editableJsons.length > 0 && (
              <span className="px-2 py-1 rounded-full bg-warning/10 text-warning">{editableJsons.length} pending approval</span>
            )}
            {workflowSteps.length > 0 && (
              <span className="px-2 py-1 rounded-full bg-muted">{completedCount}/{totalCount} workflow completed</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-3 p-3">
        {/* Render multiple JSON configurations */}
        {editableJsons.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {editableJsons.length} Configuration{editableJsons.length > 1 ? 's' : ''} Pending Review
                </span>
                <div className="flex gap-2">
                  {editableJsons.length > 1 && (
                    <button
                      onClick={() => {
                        // Apply all JSONs together in one PR - use edited versions
                        console.log('📦 Apply All Together clicked, using edited JSONs:', editedJsons);
                        onApplyEditableJson?.(editedJsons, -1); // -1 signals "apply all"
                      }}
                      disabled={isSubmittingPR}
                      className="text-xs font-medium text-white hover:bg-primary/90 transition-colors bg-primary px-3 py-1.5 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isSubmittingPR ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          ✓ Apply All Together (1 PR)
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // Clear all pending JSONs
                      if (editableJsons.length > 1) {
                        for (let i = editableJsons.length - 1; i >= 0; i--) {
                          onCancelEditableJson?.(i);
                        }
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              {editableJsons.length > 1 && (
                <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    💡 <strong>Tip:</strong> Click "Apply All Together" to create all {editableJsons.length} resources in a single PR. 
                    Applying individually will create {editableJsons.length} separate PRs.
                  </p>
                </div>
              )}
            </div>
            {editableJsons.map((jsonData, index) => (
              <div key={`json-${index}`} className="border-l-2 border-primary/30 pl-3">
                {editableJsons.length > 1 && (
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Configuration {index + 1} of {editableJsons.length}
                    </span>
                    <span className="text-xs text-muted-foreground italic">
                      (Individual apply creates separate PR)
                    </span>
                  </div>
                )}
                <JSONFormEditor
                  jsonData={jsonData}
                  isSubmitting={isSubmittingPR}
                  onChange={(editedData) => {
                    // Update edited version when user makes changes
                    setEditedJsons(prev => {
                      const updated = [...prev];
                      updated[index] = editedData;
                      return updated;
                    });
                  }}
                  onApply={(editedData) => {
                    // Trigger PR workflow after approval
                    onApplyEditableJson?.(editedData, index);
                    // The workflow will start automatically in Console after JSON is submitted
                  }}
                  onCancel={() => onCancelEditableJson?.(index)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/50 p-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
              <Brain className="h-3 w-3 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Agent Activity</p>
          </div>
          <div className="space-y-3">
            {/* Agent Events */}
            {steps.length === 0 && workflowSteps.length === 0 && editableJsons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <>
                {/* Show reasoning steps first */}
                {steps.slice(-8).map((step) => {
                  const { summary, details } = summarizeStepText(step.text);
                  const isExpanded = expandedSteps.has(step.id);
                  const hasMoreContent = summary !== step.text;
                  
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center mt-0.5 flex-shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium text-foreground leading-tight flex-1">
                            {isExpanded ? step.text : summary}
                          </p>
                          {hasMoreContent && (
                            <button
                              onClick={() => toggleStepExpansion(step.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {(details && !isExpanded) || (!details && !hasMoreContent) ? (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {details || (
                              step.type === "analysis" ? "Analyzing requirements and constraints" :
                              step.type === "decision" ? "Making decisions based on analysis" :
                              step.type === "action" ? "Executing planned actions" :
                              step.type === "result" ? "Documenting results and outcomes" :
                              "Processing agent task"
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                
                {/* Show workflow steps as part of agent activity */}
                {workflowSteps.map((step, index) => (
                  <div key={`workflow-${index}`} className="flex items-start gap-3">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      step.status === 'completed' ? 'bg-success' :
                      step.status === 'running' ? 'bg-primary' :
                      step.status === 'failed' ? 'bg-destructive' : 
                      'bg-muted-foreground/30'
                    }`}>
                      {step.status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                      {step.status === 'running' && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                      {(step.status === 'pending' || !step.status) && <div className="w-2 h-2 bg-white/50 rounded-full" />}
                      {step.status === 'failed' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight">{step.name}</p>
                      {step.explanation && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
