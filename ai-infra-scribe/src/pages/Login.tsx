import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Shield, User } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: "admin" | "user") => {
    login(role);
    navigate("/console");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow"
          >
            <Bot className="h-7 w-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Platform AI</h1>
          <p className="text-sm text-muted-foreground">
            Select a test account to continue
          </p>
        </div>

        <div className="space-y-3">
          <motion.button
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            onClick={() => handleLogin("admin")}
            className="w-full group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-surface-hover hover:border-primary/30 hover:shadow-glow transition-all duration-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground">Admin</p>
              <p className="text-xs text-muted-foreground">platform.engineer@miraclesoft.ai · Full access</p>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              ADMIN
            </span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            onClick={() => handleLogin("user")}
            className="w-full group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-surface-hover hover:border-accent/30 hover:shadow-glow transition-all duration-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
              <User className="h-5 w-5 text-accent" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground">Product Development</p>
              <p className="text-xs text-muted-foreground">product.dev@miraclesoft.ai · Standard access</p>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              USER
            </span>
          </motion.button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60">
          These are demo accounts for testing purposes only.
        </p>
      </motion.div>
    </div>
  );
}