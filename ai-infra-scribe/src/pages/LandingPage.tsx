import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, ArrowRight, Cpu, Shield, GitBranch, Zap, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Cpu, title: "Natural Language Provisioning", desc: "Describe infrastructure in plain English." },
  { icon: Shield, title: "Policy & Governance", desc: "Auto-validate against org standards." },
  { icon: GitBranch, title: "GitOps Integration", desc: "Terraform PRs generated automatically." },
  { icon: Zap, title: "Multi-Agent Orchestration", desc: "Planner, Policy, and Deploy agents." },
  { icon: BarChart3, title: "Cost Estimation", desc: "Real-time cost impact as you build." },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="h-14 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">Platform AI</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => navigate(isAuthenticated ? "/console" : "/login")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-opacity duration-200"
          >
            {isAuthenticated ? "Open Console" : "Sign In"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="max-w-2xl text-center space-y-6"
        >
          <motion.div variants={fadeUp} className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Bot className="h-8 w-8 text-primary-foreground" />
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              Platform AI
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Provision cloud resources with natural language. Platform AI interprets your intent, enforces governance, and generates compliant Terraform — all through conversation.
          </motion.p>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate(isAuthenticated ? "/console" : "/login")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-opacity duration-200 shadow-glow"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl w-full"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="p-4 rounded-xl border border-border bg-card hover:bg-surface-hover hover:border-primary/20 transition-all duration-300 space-y-2"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="py-6 text-center text-[11px] text-muted-foreground/50 border-t border-border">
        Platform AI · Conversational Infrastructure Automation
      </footer>
    </div>
  );
}