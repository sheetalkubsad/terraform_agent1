import { useState } from "react";
import { ChevronDown, Brain, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReasoningStep {
  agent: string;
  text: string;
  timestamp: Date;
  type: "analysis" | "decision" | "action" | "result";
}

export function AgentReasoning({ steps }: { steps: ReasoningStep[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (steps.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "analysis":
        return <Brain className="h-4 w-4 text-blue-500" />;
      case "decision":
        return <Zap className="h-4 w-4 text-amber-500" />;
      case "action":
        return <Zap className="h-4 w-4 text-purple-500" />;
      case "result":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Brain className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-3 rounded-lg bg-muted/40 border border-border/50 overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
        <Brain className="h-3.5 w-3.5" />
        <span>Agent Reasoning ({steps.length} steps)</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 px-3 py-2 space-y-2 bg-background/50 max-h-64 overflow-y-auto scrollbar-thin"
          >
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex gap-2 text-xs"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(step.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {step.agent}
                    </span>
                    <span className="text-muted-foreground/70 flex-1 break-words">
                      {step.text}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {step.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
