import { motion } from "framer-motion";
import {
  Server, CheckCircle2, ShieldAlert, Clock, DollarSign,
  TrendingUp, Activity, AlertTriangle, Zap, Bot,
  XCircle, GitPullRequest, Layers, Timer, ShieldCheck,
  Database, HardDrive, Network, Key, Trash2
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

/* ─── Mock Data ─── */
const kpis = [
  { label: "Total Requests", value: "312", icon: Server, change: "+18%", positive: true },
  { label: "Successful", value: "278", icon: CheckCircle2, change: "+15%", positive: true },
  { label: "Failed", value: "19", icon: XCircle, change: "-12%", positive: true },
  { label: "Avg Provision Time", value: "2.4m", icon: Clock, change: "-18%", positive: true },
];

const trendData = Array.from({ length: 14 }, (_, i) => ({
  day: `Mar ${i + 1}`,
  requests: Math.floor(Math.random() * 30) + 20,
  successful: Math.floor(Math.random() * 25) + 15,
  failed: Math.floor(Math.random() * 5) + 1,
}));

const policyViolations = [
  { name: "Non-standard module", value: 6, color: "hsl(0, 72%, 51%)" },
  { name: "Missing encryption", value: 4, color: "hsl(38, 92%, 50%)" },
  { name: "Public exposure", value: 3, color: "hsl(220, 9%, 46%)" },
  { name: "Oversized instance", value: 2, color: "hsl(205, 80%, 56%)" },
];

const resourceTypes = [
  { type: "Cloud Run", count: 98, icon: Server },
  { type: "Redis", count: 52, icon: Database },
  { type: "Bucket", count: 41, icon: HardDrive },
  { type: "Secret", count: 67, icon: Key },
  { type: "VPC", count: 28, icon: Network },
  { type: "IAM", count: 26, icon: ShieldCheck },
];

const tokenByAgent = [
  { agent: "Planner", tokens: 420000 },
  { agent: "Policy", tokens: 180000 },
  { agent: "Terraform", tokens: 350000 },
  { agent: "Evaluator", tokens: 250000 },
];

const costByEnv = [
  { env: "Production", cost: 6200 },
  { env: "Staging", cost: 3100 },
  { env: "Dev", cost: 2400 },
  { env: "Sandbox", cost: 1140 },
];

const expiringResources = [
  { name: "staging-api-runner", type: "Cloud Run", ttl: "2 days", env: "Staging" },
  { name: "test-redis-cache", type: "Redis", ttl: "4 hours", env: "Sandbox" },
  { name: "poc-storage-bucket", type: "Bucket", ttl: "6 days", env: "Dev" },
  { name: "demo-vpc-network", type: "VPC", ttl: "12 hours", env: "Sandbox" },
  { name: "load-test-runner", type: "Cloud Run", ttl: "1 day", env: "Dev" },
];

const activityLog = [
  { text: "Cloud Run deployed for payments-api", time: "2m ago", type: "success" as const },
  { text: "Redis provisioned for cache-service", time: "15m ago", type: "success" as const },
  { text: "Policy blocked external load balancer", time: "32m ago", type: "warning" as const },
  { text: "GKE cluster scaled for analytics-engine", time: "1h ago", type: "success" as const },
  { text: "Terraform plan failed for storage-bucket", time: "1.5h ago", type: "error" as const },
  { text: "Secret rotation completed for auth-service", time: "2h ago", type: "info" as const },
  { text: "VPC peering established for data-pipeline", time: "3h ago", type: "success" as const },
  { text: "Agent resolved missing region for api-gateway", time: "3.5h ago", type: "info" as const },
];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: "easeOut" as const },
});

/* ─── Component ─── */
export default function AdminDashboard() {
  return (
    <div className="h-full overflow-y-auto bg-canvas-bg">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Business & operational KPIs · Demo data</p>
        </div>

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((m, i) => (
            <motion.div
              key={m.label}
              {...fadeUp(i * 0.03)}
              className="bg-card border border-border rounded-xl p-3 shadow-card hover:shadow-elevated transition-shadow duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <m.icon className="h-3 w-3 text-primary" />
                </div>
                {m.change && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${m.positive ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {m.change}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground leading-none">{m.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{m.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Row 1: Provisioning Activity ── */}
        <div className="mb-4">
          <motion.div {...fadeUp(0.2)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Provisioning Activity (14d)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 71%, 45%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(217, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(220, 13%, 91%)" }} />
                <Area type="monotone" dataKey="requests" stroke="hsl(217, 71%, 45%)" fill="url(#gReq)" strokeWidth={2} />
                <Area type="monotone" dataKey="successful" stroke="hsl(142, 71%, 45%)" fill="url(#gOk)" strokeWidth={1.5} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="failed" stroke="hsl(0, 72%, 51%)" fill="transparent" strokeWidth={1.5} strokeDasharray="2 2" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              {[
                { label: "Requests", color: "hsl(217, 71%, 45%)" },
                { label: "Successful", color: "hsl(142, 71%, 45%)" },
                { label: "Failed", color: "hsl(0, 72%, 51%)" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-2 h-0.5 rounded" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Row 2: Policy Violations + Resource Types + Cost ── */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <motion.div {...fadeUp(0.3)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Policy Violations
            </h3>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={policyViolations} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                  {policyViolations.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {policyViolations.map((t) => (
                <span key={t.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.color }} />
                  {t.name} ({t.value})
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.33)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Most Used Resource Types
            </h3>
            <div className="space-y-2.5">
              {resourceTypes.map((r) => {
                const max = Math.max(...resourceTypes.map((x) => x.count));
                return (
                  <div key={r.type} className="flex items-center gap-2.5">
                    <r.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-foreground w-16 flex-shrink-0">{r.type}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.count / max) * 100}%` }}
                        transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full gradient-primary"
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">{r.count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.36)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Cost by Environment
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={costByEnv}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="env" tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Cost"]} />
                <Bar dataKey="cost" fill="hsl(217, 71%, 45%)" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* ── Row 3: Token Usage + Expiring Resources + Activity ── */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div {...fadeUp(0.4)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" />
              Agent Token Usage
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tokenByAgent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="agent" tick={{ fontSize: 10 }} stroke="hsl(220, 9%, 46%)" width={70} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${(v / 1000).toFixed(0)}k tokens`, "Usage"]} />
                <Bar dataKey="tokens" fill="hsl(205, 80%, 56%)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div {...fadeUp(0.43)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Timer className="h-4 w-4 text-warning" />
              Expiring Resources
            </h3>
            <div className="space-y-2">
              {expiringResources.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.type} · {r.env}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    r.ttl.includes("hour") ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  }`}>
                    {r.ttl}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.46)} className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </h3>
            <div className="space-y-2.5">
              {activityLog.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    item.type === "success" ? "bg-success/10" : item.type === "warning" ? "bg-warning/10" : item.type === "error" ? "bg-destructive/10" : "bg-info/10"
                  }`}>
                    {item.type === "success" ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> :
                     item.type === "warning" ? <AlertTriangle className="h-2.5 w-2.5 text-warning" /> :
                     item.type === "error" ? <XCircle className="h-2.5 w-2.5 text-destructive" /> :
                     <Activity className="h-2.5 w-2.5 text-info" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground leading-snug">{item.text}</p>
                    <p className="text-[10px] text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}