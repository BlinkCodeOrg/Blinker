import { SiteControlExtensions } from "@/components/browser-ui/browser-sidebar/_components/site-controls/extensions";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab } from "@/components/providers/tabs-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  BanIcon,
  BellIcon,
  CameraIcon,
  CheckIcon,
  CircleHelpIcon,
  ExpandIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  LockIcon,
  MousePointer2Icon,
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

type PermissionRow = (typeof permissionRows)[number];

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
  const [selectedPermission, setSelectedPermission] = useState<PermissionRow | null>(null);
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

  useEffect(() => {
    if (!open) return;
    return blinker.sitePermissions.onChanged(() => void loadPermissions());
  }, [loadPermissions, open]);

  useEffect(() => setSelectedPermission(null), [origin]);

  const settingFor = (permission: string): SitePermissionSetting =>
    permissions.find((entry) => entry.permission === permission)?.setting ?? "ask";

  const updatePermission = async (permission: string, setting: SitePermissionSetting) => {
    if (!profileId || !origin) return;
    await blinker.sitePermissions.set(profileId, { origin, permission, setting });
    await loadPermissions();
    setSelectedPermission(null);
  };

  if (!focusedTab) return null;
  const secure = origin?.startsWith("https://") ?? false;
  const hostname = origin ? new URL(origin).hostname : t("siteControls.internalPage");
  const SelectedPermissionIcon = selectedPermission?.icon;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSelectedPermission(null);
      }}
    >
      <PopoverTrigger
        aria-label={t("siteControls.title")}
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-md",
          "transition-colors duration-150 hover:bg-black/15 dark:hover:bg-white/20"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {secure ? <LockIcon strokeWidth={2} className="size-3.5" /> : <ShieldAlertIcon className="size-3.5" />}
        {permissions.some((entry) => entry.setting === "allow") && (
          <span className="absolute right-0 top-0 size-1.5 rounded-full bg-emerald-400" />
        )}
      </PopoverTrigger>
      <PopoverContent
        variant="translucent"
        className="flex w-[19rem] select-none flex-col gap-3"
        positionerClassName={cn(isCurrentSpaceLight ? "" : "dark")}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-full p-2", secure ? "bg-emerald-500/15" : "bg-amber-500/15")}>
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

        {origin && !selectedPermission && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/55">{t("siteControls.permissions")}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {permissionRows.map((row) => {
                  const setting = settingFor(row.permission);
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.permission}
                      type="button"
                      className="group flex min-w-0 items-center gap-2 rounded-lg bg-white/5 px-2 py-2 text-left transition-colors hover:bg-white/10"
                      onClick={() => setSelectedPermission(row)}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5",
                          setting === "allow" && "bg-emerald-500/15 text-emerald-400",
                          setting === "block" && "bg-red-500/15 text-red-400"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{t(row.label)}</span>
                        <span
                          className={cn(
                            "block text-[10px] text-white/45",
                            setting === "allow" && "text-emerald-400/80",
                            setting === "block" && "text-red-400/80"
                          )}
                        >
                          {setting === "allow"
                            ? t("permissions.allow")
                            : setting === "block"
                              ? t("permissions.block")
                              : t("permissions.ask")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {origin && selectedPermission && SelectedPermissionIcon && (
          <>
            <Separator />
            <div className="space-y-3">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
                onClick={() => setSelectedPermission(null)}
              >
                <ArrowLeftIcon className="size-3.5" />
                {t("siteControls.back")}
              </button>
              <div className="flex items-center gap-2">
                <SelectedPermissionIcon className="size-4" />
                <span className="text-sm font-semibold">{t(selectedPermission.label)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { setting: "ask", label: "permissions.ask", icon: CircleHelpIcon },
                    { setting: "allow", label: "permissions.allow", icon: CheckIcon },
                    { setting: "block", label: "permissions.block", icon: BanIcon }
                  ] as const
                ).map(({ setting, label, icon: Icon }) => {
                  const active = settingFor(selectedPermission.permission) === setting;
                  return (
                    <button
                      key={setting}
                      type="button"
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-1 py-2.5 text-[10px] transition-colors hover:bg-white/10",
                        active && "border-white/30 bg-white/15",
                        setting === "allow" && active && "border-emerald-400/40 text-emerald-300",
                        setting === "block" && active && "border-red-400/40 text-red-300"
                      )}
                      onClick={() => void updatePermission(selectedPermission.permission, setting)}
                    >
                      <Icon className="size-4" />
                      {t(label)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!selectedPermission && <Separator />}
        {!selectedPermission && <SiteControlExtensions setOpen={setOpen} />}
        {!selectedPermission && (
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
        )}
      </PopoverContent>
    </Popover>
  );
}
