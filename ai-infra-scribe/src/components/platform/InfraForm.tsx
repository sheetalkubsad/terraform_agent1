import { useState, useEffect, useRef } from "react";
import { Send, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ReasoningStep } from "@/components/platform/ChatPanel";
import { type WorkflowStep } from "@/components/platform/WorkflowPanel";
import { API_BASE } from "@/lib/api-config";

interface FormResponse {
  session_id?: string;
  agent: string;
  text: string;
  is_final: boolean;
  type: string;
}

type ResourceType = "cloud_run_service" | "cloud_run_service_iam" | "bigquery_dataset";

interface GithubWorkflowStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface CreateFormValues {
  cloud_run_service: {
    serviceName: string;
    containerImage: string;
    maxInstanceCount: number;
    cpuLimit: string;
    memoryLimit: string;
  };
  cloud_run_service_iam: {
    service_name: string;
    region: string;
    member: string;
    environment: string;
  };
  bigquery_dataset: {
    datasetId: string;
    dataLocation: string;
    allowUpdate: boolean;
    tableExpirationMs: number;
  };
}

async function submitForm(
  payload: any,
  onChunk: (data: FormResponse) => void
) {
  const response = await fetch(`${API_BASE}/form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const events = chunk.split("\n\n");

    for (const event of events) {
      if (event.startsWith("data: ")) {
        try {
          const json = JSON.parse(event.replace("data: ", ""));
          onChunk(json);
        } catch {}
      }
    }
  }
}

export function InfraForm({ 
  onResponse,
  onReasoningUpdate,
  onWorkflowStart,
  onWorkflowUpdate
}: { 
  onResponse?: (msg: string) => void;
  onReasoningUpdate?: (steps: ReasoningStep[]) => void;
  onWorkflowStart?: () => void;
  onWorkflowUpdate?: (steps: WorkflowStep[]) => void;
}) {
  const [formMode, setFormMode] = useState<"create" | "update">("create");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const workflowPollingRef = useRef(false);

  // Create Form State (based on shared_modules_context.txt)
  const [resourceType, setResourceType] = useState<ResourceType>("cloud_run_service");
  const [resourceName, setResourceName] = useState("");
  const [createValues, setCreateValues] = useState<CreateFormValues>({
    cloud_run_service: {
      serviceName: "",
      containerImage: "",
      maxInstanceCount: 10,
      cpuLimit: "1000m",
      memoryLimit: "512Mi",
    },
    cloud_run_service_iam: {
      service_name: "",
      region: "us-central1",
      member: "",
      environment: "dev",
    },
    bigquery_dataset: {
      datasetId: "",
      dataLocation: "US",
      allowUpdate: false,
      tableExpirationMs: 3600000,
    },
  });

  // Update Form State
  const [moduleName, setModuleName] = useState("");
  const [selectedModuleInfo, setSelectedModuleInfo] = useState<{ name: string; type?: ResourceType } | null>(null);
  const [availableModules, setAvailableModules] = useState<Array<{ name: string; type: string }>>([]); 
  const [updateFields, setUpdateFields] = useState<Record<string, any>>({});
  const [updates, setUpdates] = useState("");

  // Helper function to update a single field and regenerate the full updates object
  const updateField = (fieldName: string, value: any) => {
    const newFields = { ...updateFields, [fieldName]: value };
    setUpdateFields(newFields);
    // Update the JSON string for display
    setUpdates(JSON.stringify(newFields, null, 2));
  };

  // Response State
  const [responseHistory, setResponseHistory] = useState<FormResponse[]>([]);

  // Fetch and parse main.tf to get available modules
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await fetch(`${API_BASE}/terraform-modules`);
        const data = await response.json();
        
        if (data.modules && Array.isArray(data.modules)) {
          setAvailableModules(data.modules);
        }
      } catch (error) {
        console.warn("Could not fetch terraform modules from backend:", error);
        setAvailableModules([]);
      }
    };
    
    fetchModules();
  }, []);

  const resourceTypes = [
    { value: "cloud_run_service", label: "Cloud Run Service" },
    { value: "cloud_run_service_iam", label: "Cloud Run IAM Policy" },
    { value: "bigquery_dataset", label: "BigQuery Dataset" },
  ] as const;

  const currentAttributes = createValues[resourceType];

  const updateCreateValue = <R extends ResourceType, K extends keyof CreateFormValues[R]>(
    type: R,
    key: K,
    value: CreateFormValues[R][K]
  ) => {
    setCreateValues((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }));
  };

  const validateCreateValues = () => {
    if (!resourceName.trim()) {
      alert("Please enter a resource name");
      return false;
    }

    if (resourceType === "cloud_run_service") {
      const fields = createValues.cloud_run_service;
      if (!fields.serviceName.trim() || !fields.containerImage.trim()) {
        alert("Please fill serviceName and containerImage");
        return false;
      }
    }

    if (resourceType === "cloud_run_service_iam") {
      const fields = createValues.cloud_run_service_iam;
      if (!fields.service_name.trim() || !fields.member.trim()) {
        alert("Please fill service_name and member");
        return false;
      }
    }

    if (resourceType === "bigquery_dataset") {
      const fields = createValues.bigquery_dataset;
      if (!fields.datasetId.trim()) {
        alert("Please fill datasetId");
        return false;
      }
    }

    return true;
  };

  const startWorkflowPolling = async ({
    repoName,
    runId,
    dispatchedAt,
  }: {
    repoName: string;
    runId?: number;
    dispatchedAt?: number;
  }) => {
    if (workflowPollingRef.current) return;
    workflowPollingRef.current = true;

    const params = new URLSearchParams();
    params.set("repo_name", repoName);
    if (runId) params.set("run_id", String(runId));
    if (dispatchedAt) params.set("dispatched_at", String(dispatchedAt));

    try {
      for (let i = 0; i < 120; i++) {
        const response = await fetch(
          `${API_BASE}/workflow-status?${params.toString()}`
        );
        if (response.ok) {
          const payload = await response.json();
          const realSteps: GithubWorkflowStep[] = Array.isArray(payload.steps)
            ? payload.steps
                .filter((step: any) => step?.name)
                .map((step: any) => ({
                  name: String(step.name),
                  status: ["pending", "running", "completed", "failed"].includes(step.status)
                    ? step.status
                    : "pending",
                }))
            : [];
          onWorkflowUpdate?.(realSteps);

          if (payload.run_status === "completed") {
            workflowPollingRef.current = false;
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      workflowPollingRef.current = false;
    }
  };

  const handleSubmitCreate = async () => {
    if (!validateCreateValues()) {
      return;
    }

    setIsSubmitting(true);
    setResponseHistory([]);
    setReasoningSteps([]);
    onWorkflowUpdate?.([]);
    workflowPollingRef.current = false;

    try {
      let eventCount = 0;
      await submitForm(
        {
          session_id: sessionId,
          resource_type: resourceType,
          resource_name: resourceName,
          attributes: currentAttributes,
        },
        (data) => {
          if (!sessionId && data.session_id) {
            setSessionId(data.session_id);
          }

          eventCount++;
          const newStep: ReasoningStep = {
            id: `step-${eventCount}`,
            agent: data.agent || "Agent",
            text: data.text,
            timestamp: new Date(),
            type:
              data.type === "tool_call"
                ? "action"
                : data.type === "tool_response"
                  ? "result"
                  : data.is_final
                    ? "result"
                    : "analysis",
          };

          const updatedSteps = [...reasoningSteps, newStep];
          setReasoningSteps(updatedSteps);
          onReasoningUpdate?.(updatedSteps);

          setResponseHistory((prev) => [...prev, data]);
          if (data.is_final && data.text) {
            onResponse?.(data.text);
          }

          if (
            data.type === "tool_call" &&
            data.text.includes("trigger_infra_workflow")
          ) {
            onWorkflowStart?.();
          }

          if (
            data.type === "tool_response" &&
            data.agent === "trigger_infra_workflow"
          ) {
            try {
              const payload = JSON.parse(data.text);
              if (payload?.ok) {
                startWorkflowPolling({
                  repoName: payload.repo || "sheetalkubsad/terraform_agent1",
                  runId: payload.run_id,
                  dispatchedAt: payload.dispatched_at,
                });
              }
            } catch {
              // ignore non-JSON tool payloads
            }
          }

          if (data.is_final) {
            setIsSubmitting(false);
          }
        }
      );
    } catch {
      alert("Failed to submit form");
      setIsSubmitting(false);
    }
  };

  const handleSubmitUpdate = async () => {
    if (!moduleName.trim()) {
      alert("Please select a module name");
      return;
    }

    if (Object.keys(updateFields).length === 0) {
      alert("Please select at least one field to update");
      return;
    }

    setIsSubmitting(true);
    setResponseHistory([]);
    setReasoningSteps([]);
    onWorkflowUpdate?.([]);
    workflowPollingRef.current = false;

    try {
      let eventCount = 0;

      await submitForm(
        {
          session_id: sessionId,
          module_name: moduleName,
          updates: updateFields,
        },
        (data) => {
          if (!sessionId && data.session_id) {
            setSessionId(data.session_id);
          }

          eventCount++;
          const newStep: ReasoningStep = {
            id: `step-${eventCount}`,
            agent: data.agent || "Agent",
            text: data.text,
            timestamp: new Date(),
            type:
              data.type === "tool_call"
                ? "action"
                : data.type === "tool_response"
                  ? "result"
                  : data.is_final
                    ? "result"
                    : "analysis",
          };

          const updatedSteps = [...reasoningSteps, newStep];
          setReasoningSteps(updatedSteps);
          onReasoningUpdate?.(updatedSteps);

          setResponseHistory((prev) => [...prev, data]);

          if (
            data.type === "tool_call" &&
            data.text.includes("trigger_infra_workflow")
          ) {
            onWorkflowStart?.();
          }

          if (
            data.type === "tool_response" &&
            data.agent === "trigger_infra_workflow"
          ) {
            try {
              const payload = JSON.parse(data.text);
              if (payload?.ok) {
                startWorkflowPolling({
                  repoName: payload.repo || "sheetalkubsad/terraform_agent1",
                  runId: payload.run_id,
                  dispatchedAt: payload.dispatched_at,
                });
              }
            } catch {
              // ignore non-JSON tool payloads
            }
          }

          if (data.is_final) {
            setIsSubmitting(false);
          }
        }
      );
    } catch (err) {
      alert("Invalid JSON format for updates");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-chat-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Infrastructure Form</h2>
          <p className="text-xs text-muted-foreground">Create or update Terraform resources</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
          <span className="text-xs text-muted-foreground">Ready</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={formMode} onValueChange={(v) => setFormMode(v as "create" | "update")} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent px-5 py-3 h-auto gap-2">
          <TabsTrigger value="create" className="rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Resource
          </TabsTrigger>
          <TabsTrigger value="update" className="rounded-lg">
            <Copy className="h-4 w-4 mr-2" />
            Update Module
          </TabsTrigger>
        </TabsList>

        {/* Scroll Container for Forms */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <TabsContent value="create" className="px-5 py-4 space-y-4 mt-0">
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Resource Type (3 governed resources)</label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as ResourceType)}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all"
              >
                {resourceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Resource Name</label>
              <Input
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="e.g., payments-service-resource"
                className="text-sm"
              />
            </div>

            {resourceType === "cloud_run_service" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">serviceName</label>
                  <Input
                    value={createValues.cloud_run_service.serviceName}
                    onChange={(e) => updateCreateValue("cloud_run_service", "serviceName", e.target.value)}
                    placeholder="e.g., payments-api"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">containerImage</label>
                  <Input
                    value={createValues.cloud_run_service.containerImage}
                    onChange={(e) => updateCreateValue("cloud_run_service", "containerImage", e.target.value)}
                    placeholder="gcr.io/project/image:tag"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">maxInstanceCount</label>
                  <Input
                    type="number"
                    min={1}
                    value={createValues.cloud_run_service.maxInstanceCount}
                    onChange={(e) => updateCreateValue("cloud_run_service", "maxInstanceCount", Number(e.target.value) || 1)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">cpuLimit</label>
                  <select
                    value={createValues.cloud_run_service.cpuLimit}
                    onChange={(e) => updateCreateValue("cloud_run_service", "cpuLimit", e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="250m">250m</option>
                    <option value="500m">500m</option>
                    <option value="1000m">1000m</option>
                    <option value="2000m">2000m</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">memoryLimit</label>
                  <select
                    value={createValues.cloud_run_service.memoryLimit}
                    onChange={(e) => updateCreateValue("cloud_run_service", "memoryLimit", e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="256Mi">256Mi</option>
                    <option value="512Mi">512Mi</option>
                    <option value="1Gi">1Gi</option>
                    <option value="2Gi">2Gi</option>
                  </select>
                </div>
              </>
            )}

            {resourceType === "cloud_run_service_iam" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">service_name</label>
                  <Input
                    value={createValues.cloud_run_service_iam.service_name}
                    onChange={(e) => updateCreateValue("cloud_run_service_iam", "service_name", e.target.value)}
                    placeholder="e.g., payments-api"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">region</label>
                  <select
                    value={createValues.cloud_run_service_iam.region}
                    onChange={(e) => updateCreateValue("cloud_run_service_iam", "region", e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="us-central1">us-central1</option>
                    <option value="us-east1">us-east1</option>
                    <option value="europe-west1">europe-west1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">member</label>
                  <Input
                    value={createValues.cloud_run_service_iam.member}
                    onChange={(e) => updateCreateValue("cloud_run_service_iam", "member", e.target.value)}
                    placeholder="e.g., allUsers or user:email@domain.com"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">environment</label>
                  <select
                    value={createValues.cloud_run_service_iam.environment}
                    onChange={(e) => updateCreateValue("cloud_run_service_iam", "environment", e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                    <option value="prod">prod</option>
                  </select>
                </div>
              </>
            )}

            {resourceType === "bigquery_dataset" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">datasetId</label>
                  <Input
                    value={createValues.bigquery_dataset.datasetId}
                    onChange={(e) => updateCreateValue("bigquery_dataset", "datasetId", e.target.value)}
                    placeholder="e.g., analytics_events"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">dataLocation</label>
                  <select
                    value={createValues.bigquery_dataset.dataLocation}
                    onChange={(e) => updateCreateValue("bigquery_dataset", "dataLocation", e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="US">US</option>
                    <option value="EU">EU</option>
                    <option value="us-central1">us-central1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">allowUpdate</label>
                  <select
                    value={createValues.bigquery_dataset.allowUpdate ? "true" : "false"}
                    onChange={(e) => updateCreateValue("bigquery_dataset", "allowUpdate", e.target.value === "true")}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">tableExpirationMs</label>
                  <select
                    value={String(createValues.bigquery_dataset.tableExpirationMs)}
                    onChange={(e) => updateCreateValue("bigquery_dataset", "tableExpirationMs", Number(e.target.value))}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="3600000">3600000 (1 hour)</option>
                    <option value="86400000">86400000 (1 day)</option>
                    <option value="604800000">604800000 (7 days)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">JSON payload sent to backend</label>
              <Textarea
                readOnly
                value={JSON.stringify(
                  {
                    session_id: sessionId,
                    resource_type: resourceType,
                    resource_name: resourceName,
                    attributes: currentAttributes,
                  },
                  null,
                  2
                )}
                className="text-xs font-mono h-40 resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="update" className="px-5 py-4 space-y-4 mt-0">
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Select Module to Update</label>
              {availableModules.length > 0 ? (
                <select
                  value={moduleName}
                  onChange={(e) => {
                    const selected = availableModules.find(m => m.name === e.target.value);
                    setModuleName(e.target.value);
                    setSelectedModuleInfo(selected ? { name: selected.name, type: selected.type as ResourceType } : null);
                    setUpdateFields({}); // Reset fields when switching modules
                  }}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all"
                >
                  <option value="">-- Select a module --</option>
                  {availableModules.map((module) => (
                    <option key={module.name} value={module.name}>
                      {module.name} ({module.type})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g., cloud_run_service.api (no modules found in main.tf)"
                  className="text-sm"
                />
              )}
            </div>

            {moduleName && (
              <>
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Update Fields</h3>
                  
                  {selectedModuleInfo?.type === "cloud_run_service" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">maxInstanceCount</label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g., 20"
                          className="text-sm"
                          onChange={(e) => updateField("maxInstanceCount", Number(e.target.value) || 1)}
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-foreground mb-2">cpuLimit</label>
                        <select
                          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                          onChange={(e) => updateField("cpuLimit", e.target.value)}
                        >
                          <option value="">-- Select --</option>
                          <option value="250m">250m</option>
                          <option value="500m">500m</option>
                          <option value="1000m">1000m</option>
                          <option value="2000m">2000m</option>
                        </select>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-foreground mb-2">memoryLimit</label>
                        <select
                          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                          onChange={(e) => updateField("memoryLimit", e.target.value)}
                        >
                          <option value="">-- Select --</option>
                          <option value="256Mi">256Mi</option>
                          <option value="512Mi">512Mi</option>
                          <option value="1Gi">1Gi</option>
                          <option value="2Gi">2Gi</option>
                        </select>
                      </div>
                    </>
                  )}

                  {selectedModuleInfo?.type === "cloud_run_service_iam" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">environment</label>
                        <select
                          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                          onChange={(e) => updateField("environment", e.target.value)}
                        >
                          <option value="">-- Select --</option>
                          <option value="dev">dev</option>
                          <option value="staging">staging</option>
                          <option value="prod">prod</option>
                        </select>
                      </div>
                    </>
                  )}

                  {selectedModuleInfo?.type === "bigquery_dataset" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-2">tableExpirationMs</label>
                        <select
                          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary/50"
                          onChange={(e) => updateField("tableExpirationMs", e.target.value)}
                        >
                          <option value="">-- Select --</option>
                          <option value="3600000">1 hour</option>
                          <option value="86400000">1 day</option>
                          <option value="604800000">7 days</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">JSON Payload Preview</label>
                  <Textarea
                    value={moduleName ? JSON.stringify({ module_name: moduleName, updates: updateFields }, null, 2) : ""}
                    readOnly
                    placeholder="Fill in module and fields to see JSON"
                    className="text-xs font-mono h-40 resize-none bg-muted/50"
                  />
                </div>
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Response Section */}
      <AnimatePresence>
        {responseHistory.length > 0 && (
          <motion.div
            key="response"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto scrollbar-thin px-5 py-4 bg-muted/20 space-y-3">
              {responseHistory.map((resp, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs space-y-1"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-primary mt-0.5">{resp.agent}:</span>
                    <span className="text-muted-foreground flex-1">{resp.text}</span>
                  </div>
                  {resp.is_final && (
                    <div className="flex items-center gap-1 text-success text-[10px] mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      Complete
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <div className="px-5 py-4 border-t border-border">
        <Button
          onClick={
            formMode === "create" ? handleSubmitCreate : handleSubmitUpdate
          }
          disabled={isSubmitting}
          className="w-full gradient-primary text-primary-foreground rounded-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Submit {formMode === "create" ? "Resource" : "Update"}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
