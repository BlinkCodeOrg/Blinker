import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab } from "@/components/providers/tabs-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { SiteControlExtensions } from "@/components/browser-ui/browser-sidebar/_components/site-controls/extensions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  CameraIcon,
  ExpandIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  LockIcon,
  MousePointer2Icon,
  Settings2Icon,
  ShieldAlertIcon,
  Volume2Icon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SitePermissionEntry, SitePermissionSetting } from "~/types/site-permissions";

const permissionRows = [
  { permission: "camera", label: "permission.cameraTitle", icon: CameraIcon },
  { permission: "microphone", label: "permission.microphoneTitle", icon: Volume2Icon },
  { permission: "geolocation", label: "permission.geolocationTitle", icon: LocateFixedIcon },
  { permission: "notifications", label: "permission.notificationsTitle", icon: BellIcon },
  { permission: "midiSysex", label: "permission.midiSysexTitle", icon: Volume2Icon },
  { permission: "pointerLock", label: "permission.pointerLockTitle", icon: MousePointer2Icon },
  { permission: "fullscreen", label: "permission.fullscreenTitle", icon: ExpandIcon }
] as const;

function getOrigin(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function SiteControls() {
  const { isCurrentSpaceLight } = useSpaces();
  const focusedTab = useFocusedTab();
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<SitePermissionEntry[]>([]);
  const origin = useMemo(() => getOrigin(focusedTab?.url ?? ""), [focusedTab?.url]);
  const profileId = focusedTab?.profileId;

  const loadPermissions = useCallback(async () => {
    if (!profileId || !origin) return setPermissions([]);
    const entries = await blinker.sitePermissions.list(profileId);
    setPermissions(entries.filter((entry) => entry.origin === origin));
  }, [origin, profileId]);

  useEffect(() => {
    if (open) void loadPermissions();
  }, [loadPermissions, open]);

  useEffect(() => blinker.sitePermissions.onChanged(() => void loadPermissions()), [loadPermissions]);

  const settingFor = (permission: string): SitePermissionSetting =>
    permissions.find((entry) => entry.permission === permission)?.setting ?? "ask";

  const updatePermission = async (permission: string, setting: SitePermissionSetting) => {
    if (!profileId || !origin) return;
    await blinker.sitePermissions.set(profileId, { origin, permission, setting });
    await loadPermissions();
  };

  if (!focusedTab) return null;
  const secure = origin?.startsWith("https://") ?? false;
  const hostname = origin ? new URL(origin).hostname : t("siteControls.internalPage");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("siteControls.title")}
        className={cn(
          "size-6 flex items-center justify-center rounded-md relative shrink-0",
          "hover:bg-black/15 dark:hover:bg-white/20 transition-colors duration-150"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Settings2Icon strokeWidth={2} className="size-4" />
        {permissions.some((entry) => entry.setting === "allow") && (
          <span className="absolute right-0 top-0 size-1.5 rounded-full bg-emerald-400" />
        )}
      </PopoverTrigger>
      <PopoverContent
        variant="translucent"
        className="w-80 select-none flex flex-col gap-3"
        positionerClassName={cn(isCurrentSpaceLight ? "" : "dark")}
      >
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-full p-2", secure ? "bg-emerald-500/15" : "bg-amber-500/15")}>
            {secure ? (
              <LockIcon className="size-4 text-emerald-400" />
            ) : (
              <ShieldAlertIcon className="size-4 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{hostname}</p>
            <p className="text-xs text-white/60">
              {secure ? t("siteControls.secureConnection") : t("siteControls.notSecure")}
            </p>
          </div>
        </div>

        {origin && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-white/60">{t("siteControls.permissions")}</p>
              {permissionRows.map(({ permission, label, icon: Icon }) => {
                const setting = settingFor(permission);
                return (
                  <div key={permission} className="flex h-8 items-center gap-2">
                    <Icon className={cn("size-4", setting === "allow" && "text-emerald-400")} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t(label)}</span>
                    <Select
                      value={setting}
                      onValueChange={(value) => void updatePermission(permission, value as SitePermissionSetting)}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ask">{t("permissions.ask")}</SelectItem>
                        <SelectItem value="allow">{t("permissions.allow")}</SelectItem>
                        <SelectItem value="block">{t("permissions.block")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Separator />
        <SiteControlExtensions setOpen={setOpen} />
        <Button
          variant="ghost"
          className="h-8 justify-start"
          onClick={() => {
            blinker.tabs.newTab("blinker://settings/#permissions", true);
            setOpen(false);
          }}
        >
          <ExternalLinkIcon className="size-4" />
          {t("siteControls.openSettings")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
