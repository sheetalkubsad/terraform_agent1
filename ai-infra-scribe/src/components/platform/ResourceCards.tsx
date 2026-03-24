import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Database, Key, HardDrive, Network, ShieldCheck, Clock, BarChart3
} from "lucide-react";
import type { ResourceItem } from "@/pages/Console";

const typeIcons: Record<ResourceItem["type"], { icon: typeof Server; color: string }> = {
  "cloud-run": { icon: Server, color: "text-blue-500" },
  redis: { icon: Database, color: "text-red-500" },
  secret: { icon: Key, color: "text-purple-500" },
  bucket: { icon: HardDrive, color: "text-orange-500" },
  vpc: { icon: Network, color: "text-green-500" },
  iam: { icon: ShieldCheck, color: "text-cyan-500" },
  bigquery: { icon: BarChart3, color: "text-amber-500" },
};

const typeLabels: Record<ResourceItem["type"], string> = {
  "cloud-run": "Cloud Run",
  redis: "Redis Cache",
  secret: "Secret",
  bucket: "Storage Bucket",
  vpc: "VPC Network",
  iam: "IAM Policy",
  bigquery: "BigQuery Dataset",
};

const statusIndicators: Record<ResourceItem["status"], { dot: string; label: string }> = {
  draft: { dot: "bg-gray-400", label: "Draft" },
  ready: { dot: "bg-green-500", label: "Ready" },
  provisioning: { dot: "bg-blue-500 animate-pulse", label: "Provisioning" },
  done: { dot: "bg-green-500", label: "Active" },
  failed: { dot: "bg-red-500", label: "Failed" },
};

export function ResourceCards({
  resources,
  onUpdateResource,
  onRemoveResource,
}: {
  resources: ResourceItem[];
  onUpdateResource: (id: string, updates: Partial<ResourceItem>) => void;
  onRemoveResource: (id: string) => void;
}) {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No resources yet</p>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Describe infrastructure in the chat — resource cards will appear here as the agent interprets your request.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Infrastructure</h3>
        <span className="text-[10px] text-muted-foreground">{resources.length} {resources.length === 1 ? "resource" : "resources"}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <AnimatePresence initial={false}>
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onUpdate={(updates) => onUpdateResource(resource.id, updates)}
              onRemove={() => onRemoveResource(resource.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResourceCard({
  resource,
  onUpdate,
  onRemove,
}: {
  resource: ResourceItem;
  onUpdate: (updates: Partial<ResourceItem>) => void;
  onRemove: () => void;
}) {
  const typeConfig = typeIcons[resource.type] || { icon: Server, color: "text-gray-500" };
  const Icon = typeConfig.icon;
  const status = statusIndicators[resource.status];
  const typeLabel = typeLabels[resource.type];
  
  // Generate realistic timestamp (2-30 minutes ago)
  const minutesAgo = Math.floor(Math.random() * 28) + 2;
  const timestamp = new Date(Date.now() - minutesAgo * 60 * 1000);
  const timeAgo = minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex flex-col items-center text-center space-y-3">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors`}>
          <Icon className={`h-6 w-6 ${typeConfig.color}`} />
        </div>
        
        {/* Content */}
        <div className="w-full space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {resource.name}
            </h4>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          </div>
          
          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{typeLabel}</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}