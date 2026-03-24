import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Database, Shield, Key, DollarSign, GitPullRequest,
  CheckCircle2, AlertTriangle, Clock, Cpu, Globe, HardDrive,
  Play, ChevronDown, ToggleLeft, ToggleRight, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const cardVariant = {
  hidden: { opacity: 0, x: 20, scale: 0.97 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function ConfigCard({ icon: Icon, title, badge, badgeColor, children, delay = 0 }: {
  icon: any; title: string; badge?: string; badgeColor?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div variants={cardVariant} initial="hidden" animate="visible" transition={{ delay }} className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {badge && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor || "bg-success/10 text-success"}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium font-mono">{value}</span>
    </div>
  );
}

export function InfraCanvas({ hasRequest }: { hasRequest: boolean }) {
  const [ephemeral, setEphemeral] = useState(false);
  const [ttl, setTtl] = useState("24h");
  const [region, setRegion] = useState("us-central1");
  const [memory, setMemory] = useState(1024);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(-1);

  const startProvisioning = () => {
    setShowWorkflow(true);
    setWorkflowStep(0);
    const steps = [0, 1, 2, 3, 4, 5];
    steps.forEach((step, i) => {
      setTimeout(() => setWorkflowStep(step), (i + 1) * 1200);
    });
  };

  if (!hasRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-canvas-bg">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-6 shadow-glow">
          <Server className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Infrastructure Canvas</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Start a conversation with the AI assistant to see infrastructure configurations, cost estimates, and deployment plans appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-canvas-bg">
      {/* Cost Estimator */}
      <div className="sticky top-0 z-10 bg-canvas-bg/80 backdrop-blur-xl border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Estimated Monthly Cost</span>
          </div>
          <span className="text-lg font-bold text-foreground">$62<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
        </div>
        <div className="flex gap-4 mt-1.5">
          {[{ l: "Compute", v: "$42" }, { l: "Storage", v: "$12" }, { l: "Network", v: "$8" }].map((item) => (
            <span key={item.l} className="text-[10px] text-muted-foreground">
              {item.l} <span className="text-foreground font-medium">{item.v}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <AnimatePresence>
          {/* Service Configuration */}
          <ConfigCard icon={Server} title="Service Configuration" badge="Org Standard Validated" delay={0}>
            <div className="space-y-0.5">
              <FieldRow label="Service" value="order-processing" />
              <FieldRow label="Runtime" value="Cloud Run" />
              <FieldRow label="Image" value="gcr.io/company/order-api:v1" />
              <div className="pt-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">Region</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full text-xs bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50">
                  <option value="us-central1">us-central1</option>
                  <option value="us-east1">us-east1</option>
                  <option value="europe-west1">europe-west1</option>
                </select>
              </div>
              <div className="pt-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">Memory: {memory}MB</label>
                <input type="range" min={512} max={8192} step={512} value={memory} onChange={(e) => setMemory(Number(e.target.value))} className="w-full accent-primary h-1" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>512MB</span><span>8GB</span>
                </div>
              </div>
            </div>
          </ConfigCard>

          {/* Database */}
          <ConfigCard icon={Database} title="Redis Cache" badge="Org Standard Validated" delay={0.1}>
            <FieldRow label="Instance" value="Redis 7.0" />
            <FieldRow label="Memory" value="1GB" />
            <FieldRow label="Region" value={region} />
            <FieldRow label="HA" value="Enabled" />
          </ConfigCard>

          {/* Secrets */}
          <ConfigCard icon={Key} title="Secrets Configuration" badge="Encrypted" delay={0.2}>
            <FieldRow label="GITHUB_API_KEY" value="••••••••" />
            <FieldRow label="DATABASE_URL" value="••••••••" />
            <FieldRow label="Source" value="Secret Manager" />
          </ConfigCard>

          {/* Compliance */}
          <ConfigCard icon={Shield} title="Compliance Status" delay={0.3}>
            <div className="space-y-2">
              {[
                { label: "Security policy validated", pass: true },
                { label: "Org modules applied", pass: true },
                { label: "No hallucinated resources", pass: true },
                { label: "User intent satisfied", pass: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </ConfigCard>

          {/* Ephemeral */}
          <ConfigCard icon={Clock} title="Environment Settings" delay={0.35}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-foreground">Ephemeral Environment</span>
              <button onClick={() => setEphemeral(!ephemeral)} className="text-primary">
                {ephemeral ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
              </button>
            </div>
            {ephemeral && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <label className="text-xs text-muted-foreground mb-1.5 block">Destroy after</label>
                <select value={ttl} onChange={(e) => setTtl(e.target.value)} className="w-full text-xs bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50">
                  <option value="4h">4 hours</option>
                  <option value="12h">12 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="3d">3 days</option>
                </select>
              </motion.div>
            )}
          </ConfigCard>

          {/* Blast Radius */}
          <ConfigCard icon={Globe} title="Infrastructure Change Summary" delay={0.4}>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm bg-success" />
                <span className="text-foreground font-medium">+2 Add</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm bg-warning" />
                <span className="text-foreground font-medium">~1 Modify</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm bg-destructive" />
                <span className="text-foreground font-medium">-0 Destroy</span>
              </div>
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="text-success">+</span> Cloud Run Service</div>
              <div className="flex items-center gap-1.5"><span className="text-success">+</span> Redis Instance</div>
              <div className="flex items-center gap-1.5"><span className="text-warning">~</span> IAM Policy</div>
            </div>
          </ConfigCard>

          {/* GitHub PR */}
          <ConfigCard icon={GitPullRequest} title="GitHub Integration" delay={0.45}>
            <FieldRow label="Repository" value="platform-infra" />
            <FieldRow label="Branch" value="feature/cloud-run-service" />
            <FieldRow label="PR" value="#341 Created" />
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8">
              View Pull Request
            </Button>
          </ConfigCard>

          {/* Agent Workflow */}
          {showWorkflow && (
            <ConfigCard icon={Cpu} title="Agent Execution Plan" delay={0}>
              <div className="space-y-3">
                {[
                  { name: "Planner Agent", desc: "Interpret request and generate plan" },
                  { name: "Policy Agent", desc: "Validate against governance rules" },
                  { name: "Terraform Generator", desc: "Generate Terraform modules" },
                  { name: "GitHub Agent", desc: "Create Pull Request" },
                  { name: "Evaluator Agent", desc: "Verify configuration" },
                  { name: "Provisioning Agent", desc: "Execute deployment" },
                ].map((agent, i) => (
                  <div key={agent.name} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < workflowStep ? "bg-success text-success-foreground" : i === workflowStep ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {i < workflowStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === workflowStep ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                      </div>
                      {i < 5 && <div className={`w-px h-4 ${i < workflowStep ? "bg-success" : "bg-border"}`} />}
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${i <= workflowStep ? "text-foreground" : "text-muted-foreground"}`}>{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground">{agent.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ConfigCard>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {!showWorkflow && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex gap-3 pt-2">
            <Button onClick={startProvisioning} className="flex-1 gradient-primary text-primary-foreground h-10 text-sm font-medium">
              <Play className="h-4 w-4 mr-2" />
              Approve and Deploy
            </Button>
            <Button variant="outline" className="flex-1 h-10 text-sm">
              Revise Plan
            </Button>
          </motion.div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
