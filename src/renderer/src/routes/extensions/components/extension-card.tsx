import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { SharedExtensionData } from "~/types/extensions";

// Keeping this for backward compatibility
export interface Extension {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  version: string;
  path?: string;
  size?: string;
  permissions?: string[];
  inspectViews?: string[];
}

interface ExtensionCardProps {
  extension: SharedExtensionData;
  isDeveloperMode: boolean;
  isProcessing: boolean;
  setExtensionEnabled: (id: string, enabled: boolean) => Promise<boolean>;
  onDetailsClick: (id: string) => void;
}

function ExtensionCard({
  extension,
  isDeveloperMode,
  isProcessing,
  setExtensionEnabled,
  onDetailsClick
}: ExtensionCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const onRemoveClick = async () => {
    setIsRemoving(true);

    const success = await blinker.extensions.uninstallExtension(extension.id);

    if (success) {
      toast.success("Extension uninstalled successfully!");
    } else {
      toast.error("Failed to uninstall extension.");
    }

    setIsRemoving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 rounded-lg flex items-start gap-4 hover:bg-primary/5 border-border border mb-2"
    >
      <div className="flex-shrink-0 w-10 h-10">
        {extension.icon ? (
          <img src={extension.icon} alt={extension.name} className="w-full h-full rounded" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded bg-destructive/15 text-destructive">
            !
          </div>
        )}
      </div>
      <div className="flex-grow space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground font-medium">{extension.name}</h3>
            {isDeveloperMode && extension.type === "unpacked" && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                Unpacked
              </span>
            )}
            {extension.errors.length > 0 && (
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                Error
              </span>
            )}
          </div>
          <Switch
            checked={extension.enabled}
            disabled={isProcessing}
            onCheckedChange={() => setExtensionEnabled(extension.id, !extension.enabled)}
            className="ml-4"
          />
        </div>
        <p className="text-muted-foreground text-sm">{extension.description || ""}</p>
        {extension.errors.map((error) => (
          <p key={error} className="text-xs text-destructive">
            {error}
          </p>
        ))}
        <div className="flex items-center space-x-4">
          <span className="text-xs text-muted-foreground">Version {extension.version}</span>
          <div className="flex space-x-2">
            {isDeveloperMode && extension.type === "unpacked" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={isProcessing || !extension.enabled}
                onClick={async () => {
                  const success = await blinker.extensions.reloadExtension(extension.id);
                  if (success) toast.success("Extension reloaded.");
                  else toast.error("Failed to reload extension.");
                }}
              >
                Reload
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onDetailsClick(extension.id)}>
              Details
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={onRemoveClick} disabled={isRemoving}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ExtensionCard;
