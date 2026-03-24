import { motion } from "framer-motion";
import { CheckCircle2, Circle, AlertCircle, Clock, GitBranch } from "lucide-react";

export interface WorkflowStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  duration?: number;
  error?: string;
  explanation?: string;
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

export function WorkflowPanel({
  steps = defaultWorkflowSteps,
  embedded = false,
}: {
  steps?: WorkflowStep[];
  embedded?: boolean;
}) {
  const getIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 border-green-500/30";
      case "running":
        return "bg-blue-500/10 border-blue-500/30";
      case "failed":
        return "bg-red-500/10 border-red-500/30";
      default:
        return "bg-muted/30 border-muted/50";
    }
  };

  const allSteps = steps.length > 0 ? steps : defaultWorkflowSteps;
  const completedCount = allSteps.filter(s => s.status === "completed").length;
  const isRunning = allSteps.some((s) => s.status === "running");

  return (
    <div className={`flex flex-col h-full bg-background overflow-hidden ${embedded ? "" : "border-l border-border"}`}>
      {/* Header */}
      <div className={`px-4 py-3 ${embedded ? "" : "border-b border-border"}`}>
        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">PR Creation Flow</h3>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {allSteps.length} steps completed
              {isRunning ? " · running" : ""}
            </p>
          </div>
        </div>
        {allSteps.length > 0 && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / allSteps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-500 to-green-500"
            />
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-2">
        {allSteps.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <GitBranch className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              PR creation steps will appear when workflow starts
            </p>
          </div>
        ) : (
          allSteps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-lg border px-3 py-2.5 transition-all ${getStatusColor(
                step.status
              )}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{getIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{step.name}</p>
                  {step.explanation && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {step.explanation}
                    </p>
                  )}
                  {step.duration && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Duration: {step.duration.toFixed(1)}s
                    </p>
                  )}
                  {step.error && (
                    <p className="text-[10px] text-red-500/80 mt-1 break-words">
                      {step.error}
                    </p>
                  )}
                  {step.status === "running" && (
                    <p className="text-[10px] text-blue-500/80 mt-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      In progress...
                    </p>
                  )}
                </div>
                {step.status === "completed" && (
                  <span className="text-[10px] text-green-600 font-medium">Done</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
