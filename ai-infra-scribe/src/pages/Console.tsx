import { useState, useCallback, useEffect } from "react";
import { ChatPanel, type ReasoningStep } from "@/components/platform/ChatPanel";
import { ReasoningPanel } from "@/components/platform/ReasoningPanel";
import { ResourceCards } from "@/components/platform/ResourceCards";
import { type WorkflowStep } from "@/components/platform/WorkflowPanel";

export interface ResourceItem {
  id: string;
  type: "cloud-run" | "redis" | "secret" | "bucket" | "vpc" | "iam" | "bigquery";
  name: string;
  action: "create" | "update" | "delete";
  fields: Record<string, string>;
  missingFields: string[];
  status: "draft" | "ready" | "provisioning" | "done" | "failed";
}

export interface AgentEvent {
  id: string;
  text: string;
  detail?: string;
  status: "running" | "completed" | "failed";
  timestamp: Date;
}

const defaultWorkflowSteps: WorkflowStep[] = [
  { name: "Checkout repository", status: "pending", explanation: "Cloning the infrastructure repository to workspace" },
  { name: "Process Terraform File", status: "pending", explanation: "Parsing and validating Terraform configuration files" },
  { name: "Setup Terraform", status: "pending", explanation: "Installing Terraform CLI and required providers" },
  { name: "Set up GCP credentials", status: "pending", explanation: "Configuring authentication for GCP resource access" },
  { name: "Configure Git for Private Modules", status: "pending", explanation: "Setting up SSH keys for private Terraform modules" },
  { name: "Terraform Init", status: "pending", explanation: "Initializing working directory and downloading providers" },
  { name: "Terraform Validate", status: "pending", explanation: "Validating configuration syntax and references" },
  { name: "Terraform Format Check", status: "pending", explanation: "Checking code formatting and style compliance" },
  { name: "Terraform Plan", status: "pending", explanation: "Creating execution plan and showing resource changes" },
  { name: "Create Pull Request", status: "pending", explanation: "Opening PR with infrastructure changes for review" },
];

export default function Console() {
  const [resources, setResources] = useState<ResourceItem[]>([
    { id: "cr-1", type: "cloud-run", name: "api-service", action: "create", fields: {}, missingFields: [], status: "done" },
    { id: "iam-1", type: "iam", name: "cloud-run-invoker", action: "create", fields: {}, missingFields: [], status: "done" },
    { id: "bq-1", type: "bigquery", name: "analytics-dataset", action: "create", fields: {}, missingFields: [], status: "ready" },
  ]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([
    { id: "e1", text: "Interpreting request", detail: "Parsing natural language and extracting resource specifications", status: "completed", timestamp: new Date(Date.now() - 60000) },
    { id: "e2", text: "Validating API Gateway config", detail: "Checking required fields for Cloud Run service", status: "completed", timestamp: new Date(Date.now() - 55000) },
    { id: "e3", text: "Validating Worker Service config", detail: "Checking CPU and memory constraints", status: "completed", timestamp: new Date(Date.now() - 50000) },
    { id: "e4", text: "Configuring Redis instances", detail: "Setting up Session Cache and Rate Limiter", status: "completed", timestamp: new Date(Date.now() - 45000) },
    { id: "e5", text: "Creating storage buckets", detail: "Configuring User Uploads and Logs Archive buckets", status: "completed", timestamp: new Date(Date.now() - 40000) },
    { id: "e6", text: "Setting up VPC network", detail: "Custom subnet mode with CIDR 10.0.0.0/16", status: "completed", timestamp: new Date(Date.now() - 35000) },
    { id: "e7", text: "Storing secrets", detail: "DB_CONNECTION_STRING and STRIPE_SECRET_KEY added to Secret Manager", status: "completed", timestamp: new Date(Date.now() - 30000) },
    { id: "e8", text: "Configuring IAM bindings", detail: "Service account with run.invoker role", status: "completed", timestamp: new Date(Date.now() - 25000) },
    { id: "e9", text: "Running policy checks", detail: "tfsec, checkov, OPA — all passed", status: "completed", timestamp: new Date(Date.now() - 20000) },
    { id: "e10", text: "Generating Terraform modules", detail: "Writing HCL for 10 resources across 4 types", status: "completed", timestamp: new Date(Date.now() - 15000) },
    { id: "e11", text: "Checking module versions", detail: "Verifying org-approved module versions", status: "completed", timestamp: new Date(Date.now() - 10000) },
    { id: "e12", text: "Awaiting approval", detail: "All resources validated and ready for deployment", status: "running", timestamp: new Date(Date.now() - 5000) },
  ]);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [chatWidth, setChatWidth] = useState(420);
  
  // Editable JSON functionality - support multiple JSONs
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [editableJsons, setEditableJsons] = useState<any[]>([]);
  const [editedJsonToSubmit, setEditedJsonToSubmit] = useState<any | null>(null);
  const [editedJsonSubmitKey, setEditedJsonSubmitKey] = useState(0);
  const [isSubmittingPR, setIsSubmittingPR] = useState(false);

  // Safety timeout: reset submission state after 30 seconds if workflow never starts
  useEffect(() => {
    if (isSubmittingPR) {
      console.log('⏱️ Starting 30s timeout for submission state reset');
      const timeout = setTimeout(() => {
        console.warn('⚠️ Submission timeout reached - resetting state');
        setIsSubmittingPR(false);
      }, 30000); // 30 seconds
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [isSubmittingPR]);

  const handleHorizontalDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      setChatWidth(Math.min(600, Math.max(300, ev.clientX)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const addResource = (r: ResourceItem) =>
    setResources((prev) => [...prev.filter((p) => p.id !== r.id), r]);

  const updateResource = (id: string, updates: Partial<ResourceItem>) =>
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));

  const removeResource = (id: string) =>
    setResources((prev) => prev.filter((r) => r.id !== id));

  const addAgentEvent = (evt: Omit<AgentEvent, "id" | "timestamp">) => {
    const event: AgentEvent = { ...evt, id: `evt-${Date.now()}-${Math.random()}`, timestamp: new Date() };
    setAgentEvents((prev) => [...prev, event]);
    return event.id;
  };

  const updateAgentEvent = (id: string, updates: Partial<AgentEvent>) =>
    setAgentEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

  const startProvisioning = () => {
    setIsProvisioning(true);
    setResources((prev) => prev.map((r) => ({ ...r, status: "provisioning" as const })));

    const steps = [
      { text: "Interpreting request", detail: "Parsing natural language and extracting resource specifications" },
      { text: "Validating inputs", detail: "Checking required fields and parameter constraints" },
      { text: "Creating provisioning plan", detail: "Generating Terraform for " + resources.map((r) => r.name).join(", ") },
      { text: "Checking module version", detail: "Verifying org-approved module versions" },
      { text: "Generating infrastructure code", detail: "Writing HCL modules and variable definitions" },
      { text: "Running policy checks", detail: "tfsec, checkov, OPA — all passed" },
      { text: "Raising pull request", detail: "PR #341 → platform-infra/feature/infra-update" },
      { text: "Triggering workflow", detail: "GitHub Actions CI pipeline started" },
      { text: "Awaiting approval", detail: "Auto-approved by policy engine" },
      { text: "Provisioning completed", detail: "All resources deployed successfully" },
    ];

    let elapsed = 0;
    steps.forEach((step, i) => {
      const startDelay = elapsed;
      const duration = 800 + Math.random() * 800;

      setTimeout(() => {
        const eid = addAgentEvent({ text: step.text, status: "running", detail: step.detail });
        setTimeout(() => {
          updateAgentEvent(eid, { status: "completed" });
          if (i === steps.length - 1) {
            setResources((prev) => prev.map((r) => ({ ...r, status: "done" as const })));
            setIsProvisioning(false);
          }
        }, duration);
      }, startDelay);

      elapsed += duration + 200;
    });
  };

  // Simulate workflow steps progression (for GitHub Actions workflow)
  const simulateWorkflowSteps = () => {
    console.log('🎬 Starting workflow steps simulation');
    const stepsToProgress = [...defaultWorkflowSteps];
    
    let elapsed = 1000; // Start after 1 second
    stepsToProgress.forEach((step, i) => {
      const duration = 1500 + Math.random() * 1000; // 1.5-2.5s per step
      
      // Mark as running
      setTimeout(() => {
        console.log(`▶️ Step ${i + 1}/${stepsToProgress.length}: ${step.name} - running`);
        setWorkflowSteps(prev => 
          prev.map((s, idx) => 
            idx === i ? { ...s, status: "running" as const } : s
          )
        );
      }, elapsed);
      
      // Mark as completed
      setTimeout(() => {
        console.log(`✅ Step ${i + 1}/${stepsToProgress.length}: ${step.name} - completed`);
        setWorkflowSteps(prev => 
          prev.map((s, idx) => 
            idx === i ? { ...s, status: "completed" as const } : s
          )
        );
      }, elapsed + duration);
      
      elapsed += duration + 300;
    });
  };

  return (
    <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Chat */}
      <div className="h-full overflow-hidden shrink-0" style={{ width: chatWidth }}>
        <ChatPanel
          onReasoningUpdate={setReasoningSteps}
          onWorkflowStart={() => {
            console.log('🚀 Workflow started - waiting for backend status updates');
            setWorkflowSteps(defaultWorkflowSteps);
            // Reset submission state when workflow actually starts
            setIsSubmittingPR(false);
            // Workflow steps will be updated by backend polling via onWorkflowUpdate
          }}
          onWorkflowUpdate={(steps) => {
            console.log('📥 Received workflow update in Console:', steps);
            setWorkflowSteps(steps);
            // Also reset submission state when we get first workflow update
            if (steps && steps.length > 0) {
              setIsSubmittingPR(false);
            }
          }}
          onSubmissionError={() => {
            console.error('❌ Submission error - resetting submission state');
            setIsSubmittingPR(false);
          }}
          onEditableJson={(json) => {
            if (json) {
              console.log('🔍 [Console] Receiving editable JSON:', {
                type: typeof json,
                isArray: Array.isArray(json),
                data: json
              });

              // Add to array of editable JSONs
              setEditableJsons(prev => {
                // Keep the JSON exactly as it comes (Array or Object)
                // This ensures "Approve and Submit" on a single card can handle the whole list if it is one.
                const exists = prev.some(existing => 
                  JSON.stringify(existing) === JSON.stringify(json)
                );
                if (exists) return prev;
                
                console.log(`📥 Adding new JSON card to UI (Array size: ${Array.isArray(json) ? json.length : 1})`);
                return [...prev, json];
              });
            } else {
              // Only clear JSONs if explicitly requested (not during workflow)
              console.log('⚠️ Explicit clear of JSONs requested');
              setEditableJsons([]);
            }
          }}
          editedJsonToSubmit={editedJsonToSubmit}
          editedJsonSubmitKey={editedJsonSubmitKey}
        />
      </div>

      {/* Vertical Drag Handle */}
      <div
        className="shrink-0 w-2 flex items-center justify-center cursor-col-resize bg-border/40 hover:bg-primary/20 transition-colors group border-x border-border"
        onMouseDown={handleHorizontalDrag}
      >
        <div className="h-8 w-1 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* Right: Split between Resources and Reasoning */}
      <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
        {/* Top: Resource Cards - 1/4 height */}
        <div className="h-1/4 border-b border-border overflow-hidden">
          <ResourceCards
            resources={resources}
            onUpdateResource={updateResource}
            onRemoveResource={removeResource}
          />
        </div>
        
        {/* Bottom: Reasoning Panel - 3/4 height */}
        <div className="h-3/4 overflow-hidden">
          <ReasoningPanel
            steps={reasoningSteps}
            workflowSteps={workflowSteps}
            editableJsons={editableJsons}
            isSubmittingPR={isSubmittingPR}
            onApplyEditableJson={(json, index) => {
              console.log('📝 Applying edited JSON:', json, 'at index:', index);
              console.log('📊 Current JSON queue length:', editableJsons.length);
              console.log('🔍 Debug Apply All condition:', {
                indexIsMinusOne: index === -1,
                jsonIsArray: Array.isArray(json),
                bothTrue: index === -1 && Array.isArray(json),
                jsonType: typeof json,
                jsonConstructor: json?.constructor?.name
              });
              
              // Prevent duplicate submissions
              if (isSubmittingPR) {
                console.warn('⚠️ PR submission already in progress, ignoring click');
                return;
              }
              
              setIsSubmittingPR(true);
              
              // Check if this is "Apply All" (index === -1)
              // If it's -1, we should always treat json as the list of all resources
              if (index === -1) {
                console.log('🎯 Apply All: Submitting multiple JSONs together', { json });
                
                // Ensure json is an array. If it's a dict with numeric keys, convert it.
                let resourcesArray: any[] = [];
                
                if (Array.isArray(json)) {
                  resourcesArray = json;
                } else if (typeof json === 'object' && json !== null) {
                  console.log('⚠️ Batch data is not an array, attempting to convert from object values');
                  // Handle proxy/dictionary with numeric keys or nested structure
                  const values = Object.values(json);
                  resourcesArray = values.filter((val: any) => 
                    typeof val === 'object' && val !== null && (val.resource_type || val.module_name || val.attributes)
                  );
                  
                  // If we still have an empty array, maybe the root object IS the resource?
                  if (resourcesArray.length === 0 && (json.resource_type || json.module_name)) {
                    console.log('💡 Root object appears to be a single resource, wrapping in array');
                    resourcesArray = [json];
                  }
                }

                // If somehow it's still not an array or empty, fallback to the original json
                if (resourcesArray.length === 0 && json) {
                   console.log('🚨 Fallback: resourcesArray empty, trying to spread json');
                   resourcesArray = Array.isArray(json) ? json : [json];
                }

                // Submit all JSONs as an array for batch processing
                const finalBatchSubmit = {
                  batch: true,
                  resources: resourcesArray
                };
                
                // Debug log to confirm what we're sending
                console.log('📤 Final transformed payload for backend:', JSON.stringify(finalBatchSubmit, null, 2));

                setEditedJsonToSubmit(finalBatchSubmit);
                setEditedJsonSubmitKey((prev) => prev + 1);
                
                // Clear all JSONs from the queue
                setEditableJsons([]);
                console.log('🗑️ Cleared all JSONs from queue');
                
                // Initialize workflow steps
                console.log('🚀 Starting workflow for batch submission');
                setWorkflowSteps(defaultWorkflowSteps);
                return;
              }
              
              // Single JSON submission (original behavior)
              // Only mark as update if it has module_name (update flow)
              // If it has resource_type, it's a create flow - don't add update marker
              let jsonToSubmit: any;
              
              if (Array.isArray(json)) {
                // If the "single" card being approved is actually a list, wrap it as a batch
                jsonToSubmit = {
                  batch: true,
                  resources: json
                };
                console.log('📦 Submitting list from card as batch:', jsonToSubmit);
              } else if (json.module_name) {
                // For updates, preserve ALL existing fields (like repo_name, session_id, etc)
                // but ensure _operation is set to update
                jsonToSubmit = {
                  ...json,
                  _operation: 'update'
                };
                console.log('🔄 Preparing UPDATE submission:', jsonToSubmit);
              } else if (json.resource_type) {
                // For creations, preserve ALL existing fields
                jsonToSubmit = { ...json };
                console.log('🆕 Preparing CREATE submission:', jsonToSubmit);
              } else {
                // Fallback for any other format
                jsonToSubmit = json;
                console.log('📤 Submitting raw JSON (fallback):', jsonToSubmit);
              }
              
              // Final check: if the resulting object still has numeric keys, clean it
              if (typeof jsonToSubmit === 'object' && jsonToSubmit !== null) {
                Object.keys(jsonToSubmit).forEach(key => {
                  if (!isNaN(Number(key))) {
                    console.warn(`🗑️ Removing numeric key "${key}" from single resource payload`);
                    delete jsonToSubmit[key];
                  }
                });
              }

              // Submit the JSON for processing
              setEditedJsonToSubmit(jsonToSubmit);
              setEditedJsonSubmitKey((prev) => prev + 1);
              
              // Remove only this specific JSON from the array
              setEditableJsons(prev => {
                const newArray = prev.filter((_, i) => i !== index);
                console.log('🗑️ Removed JSON at index', index, 'new queue length:', newArray.length);
                return newArray;
              });
              
              // Don't initialize workflow if there are more JSONs to process
              if (editableJsons.length <= 1) {
                console.log('🚀 All JSONs processed, waiting for backend workflow trigger');
                
                // Initialize workflow steps to pending
                setWorkflowSteps(defaultWorkflowSteps);
                // Workflow will be updated by backend via onWorkflowUpdate callback
              } else {
                console.log('⏳ More JSONs pending, workflow will start after all are processed');
              }
            }}
            onCancelEditableJson={(index) => {
              console.log(`Cancelling editable JSON at index ${index}`);
              // Remove specific JSON from array
              setEditableJsons(prev => {
                const newJsons = prev.filter((_, i) => i !== index);
                console.log(`Removed JSON at index ${index}. Remaining: ${newJsons.length}`);
                return newJsons;
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
