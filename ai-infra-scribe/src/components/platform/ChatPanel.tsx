import { useState, useRef, useEffect } from "react";
import { Send, Mic, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE } from "@/lib/api-config";

export interface ReasoningStep {
  id: string;
  agent: string;
  text: string;
  timestamp: Date;
  type: "analysis" | "decision" | "action" | "result";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GithubWorkflowStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  explanation?: string;
}

// Default workflow step explanations to preserve descriptions during CREATE
const defaultWorkflowExplanations: Record<string, string> = {
  "Checkout repository": "Cloning the infrastructure repository to workspace",
  "Process Terraform File": "Parsing and validating Terraform configuration files",
  "Setup Terraform": "Installing Terraform CLI and required providers",
  "Set up GCP credentials": "Configuring authentication for GCP resource access",
  "Configure Git for Private Modules": "Setting up SSH keys for private Terraform modules",
  "Terraform Init": "Initializing working directory and downloading providers",
  "Terraform Validate": "Validating configuration syntax and references",
  "Terraform Format Check": "Checking code formatting and style compliance",
  "Terraform Plan": "Creating execution plan and showing resource changes",
  "Create Pull Request": "Opening PR with infrastructure changes for review",
};

function normalizeAgentResponse(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  const stripped = normalized.replace(/```[\s\S]*?```/g, "").trim();
  const looksLikeJson =
    (stripped.startsWith("{") && stripped.endsWith("}")) ||
    (stripped.startsWith("[") && stripped.endsWith("]"));

  if (looksLikeJson) {
    try {
      return JSON.stringify(JSON.parse(stripped), null, 2);
    } catch {
      return normalized.replace(/\n{3,}/g, "\n\n");
    }
  }

  return normalized.replace(/\n{3,}/g, "\n\n");
}

function FormattedAssistantMessage({ content }: { content: string }) {
  // Detect clarifying questions pattern (numbered list with code blocks showing defaults)
  const isClarifyingQuestions = /\d+\.\s+What|The\s+default.*is\s+`.*`/i.test(content);
  
  if (isClarifyingQuestions) {
    // Parse questions with defaults
    const lines = content.split('\n');
    const questions: Array<{ question: string; defaultValue?: string; note?: string }> = [];
    let currentQuestion = '';
    let currentDefault = '';
    let currentNote = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect numbered questions
      if (/^\d+\.\s+/.test(line)) {
        if (currentQuestion) {
          questions.push({ question: currentQuestion, defaultValue: currentDefault, note: currentNote });
        }
        currentQuestion = line.replace(/^\d+\.\s+/, '');
        currentDefault = '';
        currentNote = '';
      } 
      // Detect default values
      else if (/default.*is\s+`(.+?)`/i.test(line)) {
        const match = line.match(/`(.+?)`/);
        if (match) currentDefault = match[1];
        currentNote = line;
      }
      // Detect "Also" or "The" statements about defaults
      else if (line.includes('`') && (line.toLowerCase().includes('default') || line.toLowerCase().includes('also'))) {
        const match = line.match(/`(.+?)`/);
        if (match) currentDefault = match[1];
        currentNote = line;
      }
      // Continuation of question
      else if (line && !line.startsWith('`') && currentQuestion && !currentDefault) {
        currentQuestion += ' ' + line;
      }
    }
    
    if (currentQuestion) {
      questions.push({ question: currentQuestion, defaultValue: currentDefault, note: currentNote });
    }
    
    if (questions.length > 0) {
      return (
        <div className="space-y-3">
          {/* Intro text */}
          <p className="text-sm text-foreground/90">I can help you create a Cloud Run service. I need a few more details:</p>
          
          {/* Questions Grid */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="text-sm font-medium text-foreground">
                  {idx + 1}. {q.question}
                </div>
                {q.defaultValue && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Default:</span>
                    <code className="px-2 py-1 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                      {q.defaultValue}
                    </code>
                  </div>
                )}
                {q.note && !q.note.includes('`') && (
                  <p className="text-xs text-muted-foreground">{q.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }
  
  // Default markdown rendering (strip content from backticks to remove them from display)
  const cleanContent = content.replace(/`([^`]+)`/g, '$1');
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block styling - now without visible backticks
          code({ node, inline, className, children, ...props }: any) {
            return inline ? (
              <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs font-medium" {...props}>
                {children}
              </span>
            ) : (
              <code className="block rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs overflow-x-auto" {...props}>
                {children}
              </code>
            );
          },
          // Style pre blocks
          pre({ children }: any) {
            return <div className="not-prose my-2">{children}</div>;
          },
          // Style links
          a({ href, children }: any) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {children}
              </a>
            );
          },
          // Style lists
          ul({ children }: any) {
            return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>;
          },
          ol({ children }: any) {
            return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>;
          },
          // Style paragraphs
          p({ children }: any) {
            return <p className="whitespace-pre-wrap break-words my-2">{children}</p>;
          },
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}

const quickPrompts = [ "Create a Cloud Run service for my API", 
  "Deploy a staging environment with Postgres", 
  "Add GitHub API secrets to the service", 
  "Provision Redis cache for this application", ];

/* ============================= */
/* STREAMING FUNCTION (OUTSIDE)  */
/* ============================= */

async function streamChat(
  payload: { session_id?: string; message: string },
  onChunk: (data: any) => void
) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${errText || response.statusText}`);
  }

  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim().startsWith("data: ")) {
        try {
          const json = JSON.parse(buffer.trim().replace(/^data:\s*/, ""));
          onChunk(json);
        } catch {}
      }
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

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

async function streamForm(
  payload: any,
  onChunk: (data: any) => void
) {
  console.log('📤 [streamForm] Sending payload:', {
    payload,
    hasBatch: 'batch' in payload,
    hasResources: 'resources' in payload,
    resourcesType: typeof payload.resources,
    resourcesIsArray: Array.isArray(payload.resources),
    hasNumericKeys: payload.resources && typeof payload.resources === 'object' && !Array.isArray(payload.resources) && Object.keys(payload.resources).some(k => !isNaN(Number(k))),
    jsonString: JSON.stringify(payload)
  });
  const response = await fetch(`${API_BASE}/form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Form request failed (${response.status}): ${errText || response.statusText}`);
  }

  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim().startsWith("data: ")) {
        try {
          const json = JSON.parse(buffer.trim().replace(/^data:\s*/, ""));
          onChunk(json);
        } catch {}
      }
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

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

/* ============================= */
/* COMPONENT                     */
/* ============================= */

export function ChatPanel({ onReasoningUpdate, onWorkflowStart, onWorkflowUpdate, onEditableJson, onSubmissionError, editedJsonToSubmit, editedJsonSubmitKey }: { onReasoningUpdate?: (steps: ReasoningStep[]) => void; onWorkflowStart?: () => void; onWorkflowUpdate?: (steps: any[]) => void; onEditableJson?: (json: any | null) => void; onSubmissionError?: () => void; editedJsonToSubmit?: any | null; editedJsonSubmitKey?: number }) {

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to Platform AI. I'm your infrastructure automation assistant.",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const workflowTriggeredRef = useRef(false);
  const workflowPollingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  useEffect(() => {
    if (editedJsonSubmitKey && editedJsonToSubmit) {
      // Always use /form endpoint for edited JSON submissions (both batch and single)
      // Add session_id to the payload
      const payload = {
        ...editedJsonToSubmit,
        session_id: sessionId
      };
      submitFormData(payload);
    }
  }, [editedJsonSubmitKey, editedJsonToSubmit, sessionId]);

  const submitFormData = async (formData: any) => {
    console.log('📋 Submitting form data:', formData);
    
    setIsTyping(true);
    
    const assistantId = (Date.now() + 1).toString();
    
    // Add empty assistant message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);
    
    let currentSteps: ReasoningStep[] = [];
    
    // Use the same workflow polling setup
    const startWorkflowPolling = async ({
      repoName,
      runId,
      dispatchedAt,
    }: {
      repoName: string;
      runId?: number;
      dispatchedAt?: number;
    }) => {
      if (workflowPollingRef.current) {
        console.warn('⚠️ Workflow polling already in progress, skipping');
        return;
      }
      
      workflowPollingRef.current = true;
      console.log('🔄 Starting workflow polling with params:', { repoName, runId, dispatchedAt });

      const params = new URLSearchParams();
      params.set("repo_name", repoName);
      if (runId) params.set("run_id", String(runId));
      if (dispatchedAt) params.set("dispatched_at", String(dispatchedAt));

      try {
        for (let i = 0; i < 120; i++) {
          console.log(`📡 Polling attempt ${i + 1}/120`);
          const response = await fetch(
            `${API_BASE}/workflow-status?${params.toString()}`
          );
          const result = await response.json();
          
          console.log('📊 Workflow status result:', result);

          if (result.ok) {
            if (result.steps && result.steps.length > 0) {
              console.log(`📋 Found ${result.steps.length} workflow steps, updating UI`);
              
              // Map workflow steps and add explanations from defaultWorkflowExplanations
              const mappedSteps: GithubWorkflowStep[] = result.steps
                .filter((step: any) => step?.name)
                .map((step: any) => ({
                  name: String(step.name),
                  status: ["pending", "running", "completed", "failed"].includes(step.status)
                    ? step.status
                    : "pending",
                  explanation: defaultWorkflowExplanations[String(step.name)] || step.explanation,
                }));
              
              onWorkflowUpdate?.(mappedSteps);

              const allStepsComplete = mappedSteps.every(
                (s: any) => s.status === "completed" || s.status === "failed"
              );
              if (allStepsComplete) {
                console.log("✅ All workflow steps complete");
                break;
              }
            } else {
              console.log('⏳ Workflow is starting, no steps yet...');
            }
          } else {
            console.warn('⚠️ Workflow status returned ok=false, stopping polling');
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error("Workflow polling error:", error);
      } finally {
        workflowPollingRef.current = false;
        console.log('🏁 Workflow polling ended, ref reset to false');
      }
    };
    
    try {
      // formData already contains session_id from useEffect
      await streamForm(formData, (data) => {
        console.log('🔔 [submitFormData] Received SSE event:', {
          type: data.type,
          agent: data.agent,
          is_final: data.is_final,
          text_preview: data.text?.substring(0, 100)
        });
        
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
        }

        // Handle errors
        if (data.error) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `Error: ${data.error}`,
                  }
                : msg
            )
          );
          setIsTyping(false);
          return;
        }

        // Update message content with final response
        if (data.is_final && data.text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: normalizeAgentResponse(msg.content + data.text),
                  }
                : msg
            )
          );
        }

        // Track reasoning steps
        if (data.text) {
          const stepType: "action" | "result" | "analysis" | "decision" = 
            data.type === "tool_call" ? "action" : 
            data.type === "tool_response" ? "result" :
            data.is_final ? "result" : "analysis";

          const newStep: ReasoningStep = {
            id: `${assistantId}-${currentSteps.length}`,
            agent: data.agent || "Unknown",
            text: data.text,
            timestamp: new Date(),
            type: stepType
          };

          currentSteps = [...currentSteps, newStep].slice(-20);
          setReasoningSteps(currentSteps);
          onReasoningUpdate?.(currentSteps);

          // Detect workflow trigger
          if (
            data.type === "tool_call" && 
            (data.text.includes("trigger_infra_workflow") || data.text.includes("update_module_block"))
          ) {
            console.log('🔧 Tool call detected for workflow:', data.agent || data.text);
            workflowTriggeredRef.current = true;
            onWorkflowStart?.();
          }

          // Check for workflow response
          if (
            data.type === "tool_response" &&
            (data.agent === "trigger_infra_workflow" || data.agent === "update_module_block")
          ) {
            console.log('📦 Workflow tool response received:', data.text);
            
            let parsed: any = null;
            try {
              parsed = JSON.parse(data.text);
            } catch {
              console.error('Failed to parse workflow response:', data.text);
            }

            console.log('🔍 Parsed workflow response:', parsed);

            // Start polling even with just dispatched_at (backend will find run_id)
            if (parsed && (parsed.run_id || parsed.dispatched_at || parsed.ok)) {
              console.log('🚀 Starting workflow polling from form submission with:', {
                repo: parsed.repo,
                run_id: parsed.run_id,
                dispatched_at: parsed.dispatched_at
              });
              startWorkflowPolling({
                repoName: parsed?.repo || "sheetalkubsad/terraform_agent1",
                runId: parsed?.run_id,
                dispatchedAt: parsed?.dispatched_at,
              });
            } else {
              console.warn('⚠️ Workflow response missing required fields:', parsed);
            }
          }
        }

        if (data.is_final) {
          setIsTyping(false);
        }
      });
    } catch (error: any) {
      console.error("Form submission error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `Error: ${error.message}`,
              }
            : msg
        )
      );
      setIsTyping(false);
      onSubmissionError?.(); // Reset submission state on error
    }
  };

  const sendMessage = async (text: string, isEditedJsonSubmit: boolean = false) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    // Don't show the JSON message in UI if it's an edited JSON submission
    if (!isEditedJsonSubmit) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput("");
    
    // Only clear workflow if this is NOT an edited JSON submission
    // Edited JSON submissions should preserve the workflow that was just set up
    if (!isEditedJsonSubmit) {
      workflowTriggeredRef.current = false;
      workflowPollingRef.current = false;
      onWorkflowUpdate?.([]);
    }
    // Don't clear JSONs automatically - let the user process them sequentially
    // onEditableJson?.(null);
    
    // Clear reasoning steps for new message
    setReasoningSteps([]);

    setIsTyping(true);

    const assistantId = (Date.now() + 1).toString();

    // Add empty assistant message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);

    let currentSteps: ReasoningStep[] = [];

    const startWorkflowPolling = async ({
      repoName,
      runId,
      dispatchedAt,
    }: {
      repoName: string;
      runId?: number;
      dispatchedAt?: number;
    }) => {
      if (workflowPollingRef.current) {
        console.warn('⚠️ [sendMessage] Workflow polling already in progress, skipping');
        return;
      }
      workflowPollingRef.current = true;
      console.log('🔄 [sendMessage] Starting workflow polling with params:', { repoName, runId, dispatchedAt });

      const params = new URLSearchParams();
      params.set("repo_name", repoName);
      if (runId) params.set("run_id", String(runId));
      if (dispatchedAt) params.set("dispatched_at", String(dispatchedAt));

      try {
        for (let i = 0; i < 120; i++) {
          console.log(`📡 [sendMessage] Polling attempt ${i + 1}/120`);
          const response = await fetch(
            `${API_BASE}/workflow-status?${params.toString()}`
          );
          if (response.ok) {
            const data = await response.json();
            console.log('📊 [sendMessage] Workflow status API response:', data);
            console.log('📊 [sendMessage] Raw steps from API:', data.steps);
            
            // Check if we got valid workflow data
            if (data.ok) {
              if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
                const realSteps: GithubWorkflowStep[] = data.steps
                  .filter((step: any) => step?.name)
                  .map((step: any) => ({
                    name: String(step.name),
                    status: ["pending", "running", "completed", "failed"].includes(step.status)
                      ? step.status
                      : "pending",
                    explanation: defaultWorkflowExplanations[String(step.name)] || step.explanation,
                  }));

                console.log('📊 [sendMessage] Mapped workflow steps:', realSteps);
                console.log('📊 [sendMessage] Calling onWorkflowUpdate with', realSteps.length, 'steps');
                onWorkflowUpdate?.(realSteps);

                if (data.run_status === "completed") {
                  console.log('✅ [sendMessage] Workflow completed');
                  break;
                }
              } else {
                console.log('⏳ [sendMessage] Workflow starting, no steps yet...');
              }
            } else {
              console.warn('⚠️ [sendMessage] Workflow status returned ok=false');
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('[sendMessage] Workflow polling error:', error);
      } finally {
        workflowPollingRef.current = false;
        console.log('🏁 [sendMessage] Workflow polling ended, ref reset to false');
      }
    };

    const maybeStartWorkflowPolling = (eventData: any) => {
      const agent = String(eventData?.agent || "").toLowerCase();
      const text = String(eventData?.text || "");

      console.log('🔍 Checking if workflow should start. Agent:', agent);

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            parsed = null;
          }
        }
      }

      const hasTriggerSignal =
        agent.includes("trigger_infra_workflow") ||
        agent.includes("update_module_block") ||
        /workflow\s+triggered\s+successfully/i.test(text) ||
        Boolean(parsed?.run_id) ||
        Boolean(parsed?.dispatched_at);

      console.log('🎯 Trigger signal check:', {
        agent,
        hasTriggerSignal,
        hasRunId: Boolean(parsed?.run_id),
        hasDispatchedAt: Boolean(parsed?.dispatched_at),
        parsedOk: parsed?.ok
      });

      if (!hasTriggerSignal) return;
      if (parsed?.ok === false) return;

      console.log('🚀 maybeStartWorkflowPolling: Starting polling');
      startWorkflowPolling({
        repoName: parsed?.repo || "sheetalkubsad/terraform_agent1",
        runId: parsed?.run_id,
        dispatchedAt: parsed?.dispatched_at,
      });
    };

    try {
      await streamChat(
        {
          session_id: sessionId,
          message: text.trim(),
        },
        (data) => {
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
        }

        // Handle editable JSON responses
        if (data.type === 'editable_json' && data.text && data.editable) {
          try {
            const jsonData = JSON.parse(data.text);
            console.log('🔍 [ChatPanel] Received editable JSON:', {
              type: typeof jsonData,
              isArray: Array.isArray(jsonData),
              hasNumericKeys: typeof jsonData === 'object' && !Array.isArray(jsonData) && Object.keys(jsonData).some(k => !isNaN(Number(k))),
              data: jsonData
            });
            onEditableJson?.(jsonData);
            // Successfully triggered editable form - don't add JSON text to chat
            return;
          } catch {
            // If JSON parsing fails, treat as regular text
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: normalizeAgentResponse(msg.content + data.text),
                    }
                  : msg
              )
            );
          }
        }
        // Only add to chat message content if this is the final response from root agent
        else if (data.is_final && data.text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: normalizeAgentResponse(msg.content + data.text),
                  }
                : msg
            )
          );
        }

        // Track ALL reasoning steps (both intermediate and final)
        if (data.text) {
          const stepType: "action" | "result" | "analysis" | "decision" = 
            data.type === "tool_call" ? "action" : 
            data.type === "editable_json" ? "decision" :
            data.type === "tool_response" ? "result" :
            data.is_final ? "result" : "analysis";

          const newStep: ReasoningStep = {
            id: `${assistantId}-${currentSteps.length}`,
            agent: data.agent || "Unknown",
            text: data.type === "editable_json" ? "Generated editable configuration" : data.text,
            timestamp: new Date(),
            type: stepType
          };

          currentSteps = [...currentSteps, newStep].slice(-20); // Keep last 20 steps
          setReasoningSteps(currentSteps);
          onReasoningUpdate?.(currentSteps);

          // Detect workflow trigger
          if (
            data.type === "tool_call" && 
            (data.text.includes("trigger_infra_workflow") || data.text.includes("update_module_block"))
          ) {
            console.log('🔧 Tool call detected for workflow:', data.agent || data.text);
            workflowTriggeredRef.current = true;
            onWorkflowStart?.();
          }

          if (
            data.type === "tool_response" &&
            (data.agent === "trigger_infra_workflow" || data.agent === "update_module_block")
          ) {
            console.log('📦 Tool response from:', data.agent, 'Text:', data.text);
            try {
              const payload = JSON.parse(data.text);
              console.log('✅ Parsed workflow payload:', payload);
              if (payload?.ok) {
                console.log('🚀 Starting workflow polling with:', {
                  repo: payload.repo,
                  runId: payload.run_id,
                  dispatchedAt: payload.dispatched_at
                });
                startWorkflowPolling({
                  repoName: payload.repo || "sheetalkubsad/terraform_agent1",
                  runId: payload.run_id,
                  dispatchedAt: payload.dispatched_at,
                });
              } else {
                console.warn('⚠️ Payload ok is false:', payload);
              }
            } catch (err) {
              console.error('❌ Failed to parse tool response:', err, 'Text was:', data.text);
            }
          }

          maybeStartWorkflowPolling(data);
        }

          if (data.is_final) {
            setIsTyping(false);
          }
        }
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              }
            : msg
        )
      );
      setIsTyping(false);
      onSubmissionError?.(); // Reset submission state on error
    }
  };


  return (
    <div className="flex flex-col h-full min-h-0 bg-chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Platform AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Infrastructure automation agent</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.filter((msg) => msg.content.trim() !== "").map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${msg.role === "user" ? "bg-chat-user" : "gradient-primary"}`}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-primary-foreground" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                )}
              </div>
              <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`${msg.role === "user" ? "" : "rounded-xl px-4 py-3 text-sm leading-relaxed bg-card shadow-card border border-border text-card-foreground"} ${msg.role === "user" ? "rounded-xl px-4 py-3 text-sm leading-relaxed bg-chat-user text-primary-foreground" : ""}`}
                >
                  {msg.role === "assistant" ? (
                    <FormattedAssistantMessage content={msg.content} />
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-card shadow-card border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-soft"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-card"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2 shadow-card focus-within:border-primary/50 focus-within:shadow-glow transition-all">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask Platform AI to provision infrastructure…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${isListening ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setIsListening(!isListening)}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 gradient-primary text-primary-foreground rounded-lg"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 flex items-center justify-center gap-1"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="w-1 bg-destructive rounded-full"
                style={{
                  animation: `waveform 0.8s ease-in-out ${i * 0.05}s infinite`,
                  height: "4px",
                }}
              />
            ))}
            <span className="ml-3 text-xs text-muted-foreground">Listening…</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
