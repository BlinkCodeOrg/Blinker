import { useSettings } from "@/components/providers/settings-provider";
import type { BasicSetting, BasicSettingCard } from "~/types/settings";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ResetOnboardingCard } from "@/components/settings/sections/general/reset-onboarding-card";
import { UpdateCard } from "@/components/settings/sections/general/update-card";
import { ProfileBackupCard } from "@/components/settings/sections/general/profile-backup-card";
import { NewTabBackgroundCard } from "@/components/settings/sections/general/new-tab-background-card";
import { SetAsDefaultBrowserSetting } from "@/components/settings/sections/general/set-as-default-browser-setting";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAllSearchEngines,
  getCustomSearchEngineSettingId,
  isValidSearchUrlTemplate,
  parseCustomSearchEngines,
  serializeCustomSearchEngines
} from "~/search-engines";
import { FolderOpen, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const cardTranslationKeys: Record<string, { title: string; subtitle: string }> = {
  "autoUpdate,syncTabsAcrossWindows,appLanguage,defaultSearchEngine,customSearchEngines,downloadDirectory,contentBlocker,internal_setAsDefaultBrowser":
    {
      title: "card.general.title",
      subtitle: "card.general.subtitle"
    },
  newTabMode: {
    title: "card.newTab.title",
    subtitle: "card.newTab.subtitle"
  },
  commandPaletteOpacity: {
    title: "card.commandPalette.title",
    subtitle: "card.commandPalette.subtitle"
  },
  "browserInterfaceMode,sidebarSide,showSiteConnection,showSitePermissions": {
    title: "card.sidebar.title",
    subtitle: "card.sidebar.subtitle"
  },
  "archiveTabAfter,sleepTabAfter": {
    title: "card.performance.title",
    subtitle: "card.performance.subtitle"
  },
  enableBlinkerPdfViewer: {
    title: "card.experimental.title",
    subtitle: "card.experimental.subtitle"
  },
  enableMv2Extensions: {
    title: "card.advanced.title",
    subtitle: "card.advanced.subtitle"
  }
};

function getSettingLabel(setting: BasicSetting) {
  return t(`setting.${setting.id}`);
}

function getOptionLabel(optionId: string, fallback: string) {
  return t(`setting.option.${optionId}`) || fallback;
}

function getCardLabels(card: BasicSettingCard) {
  const keys = cardTranslationKeys[card.settings.join(",")];
  if (!keys) {
    return { title: card.title, subtitle: card.subtitle };
  }

  return { title: t(keys.title), subtitle: t(keys.subtitle) };
}

function DownloadDirectoryInput() {
  const [directory, setDirectory] = useState("");

  const refresh = async () => {
    setDirectory(await blinker.downloads.getDownloadDirectory());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const choose = async () => {
    const selected = await blinker.downloads.chooseDownloadDirectory();
    if (selected) setDirectory(selected);
  };

  const reset = async () => {
    setDirectory(await blinker.downloads.resetDownloadDirectory());
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="max-w-[260px] truncate text-xs text-muted-foreground">{directory}</span>
      <Button variant="outline" size="sm" onClick={() => void choose()} className="gap-2">
        <FolderOpen className="size-3.5" />
        {t("setting.chooseDownloadFolder")}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => void reset()} aria-label={t("setting.resetDownloadFolder")}>
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}

function createCustomSearchEngineId(name: string, existingIds: Set<string>) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const randomId = typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36);
  const baseId = slug || `engine-${randomId}`;
  let id = baseId;
  let counter = 2;

  while (existingIds.has(id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  return id;
}

function DefaultSearchEngineInput() {
  const { getSetting, setSetting } = useSettings();
  const customSearchEnginesRaw = getSetting<string>("customSearchEngines") ?? "[]";
  const selectedEngine = getSetting<string>("defaultSearchEngine") ?? "google";
  const searchEngines = getAllSearchEngines(customSearchEnginesRaw);
  const value = searchEngines.some((engine) => engine.id === selectedEngine) ? selectedEngine : "google";

  return (
    <div className="w-auto">
      <Select value={value} onValueChange={(nextValue) => void setSetting("defaultSearchEngine", nextValue)}>
        <SelectTrigger className="w-full min-w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="remove-app-drag z-popover">
          {searchEngines.map((engine) => (
            <SelectItem key={engine.id} value={engine.id}>
              {engine.isCustom ? engine.name : getOptionLabel(engine.id, engine.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CustomSearchEnginesManager() {
  const { getSetting, setSetting } = useSettings();
  const customSearchEnginesRaw = getSetting<string>("customSearchEngines") ?? "[]";
  const defaultSearchEngine = getSetting<string>("defaultSearchEngine") ?? "google";
  const customSearchEngines = parseCustomSearchEngines(customSearchEnginesRaw);
  const [name, setName] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addEngine = async () => {
    const nextName = name.trim();
    const nextSearchUrl = searchUrl.trim();
    const existingIds = new Set(customSearchEngines.map((engine) => engine.id));
    const existingNames = new Set(customSearchEngines.map((engine) => engine.name.toLowerCase()));

    if (!nextName) {
      setError(t("searchEngines.nameRequired"));
      return;
    }

    if (!isValidSearchUrlTemplate(nextSearchUrl)) {
      setError(t("searchEngines.urlInvalid"));
      return;
    }

    if (existingNames.has(nextName.toLowerCase())) {
      setError(t("searchEngines.duplicate"));
      return;
    }

    const nextEngines = [
      ...customSearchEngines,
      {
        id: createCustomSearchEngineId(nextName, existingIds),
        name: nextName,
        searchUrl: nextSearchUrl
      }
    ];

    const saved = await setSetting("customSearchEngines", serializeCustomSearchEngines(nextEngines));
    if (saved) {
      setName("");
      setSearchUrl("");
      setError(null);
    }
  };

  const deleteEngine = async (engineId: string) => {
    const nextEngines = customSearchEngines.filter((engine) => engine.id !== engineId);
    const saved = await setSetting("customSearchEngines", serializeCustomSearchEngines(nextEngines));
    if (saved && defaultSearchEngine === getCustomSearchEngineSettingId(engineId)) {
      await setSetting("defaultSearchEngine", "google");
    }
  };

  return (
    <div className="w-full rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Search className="size-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-card-foreground">{t("searchEngines.customTitle")}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{t("searchEngines.customDescription")}</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(120px,0.8fr)_minmax(220px,1.5fr)_auto]">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder={t("searchEngines.namePlaceholder")}
        />
        <Input
          value={searchUrl}
          onChange={(event) => {
            setSearchUrl(event.target.value);
            setError(null);
          }}
          placeholder={t("searchEngines.urlPlaceholder")}
          className="md:col-span-2"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted-foreground">{t("searchEngines.placeholderHint")}</p>
        <Button onClick={() => void addEngine()} className="gap-2">
          <Plus className="size-4" />
          {t("searchEngines.add")}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-4 space-y-2">
        {customSearchEngines.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {t("searchEngines.empty")}
          </div>
        ) : (
          customSearchEngines.map((engine) => (
            <div
              key={engine.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-card-foreground">{engine.name}</div>
                <div className="truncate text-xs text-muted-foreground">{engine.searchUrl}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void deleteEngine(engine.id)}
                aria-label={t("searchEngines.delete")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SettingsInput({ setting }: { setting: BasicSetting }) {
  const { getSetting, setSetting } = useSettings();

  const handleSettingChange = (value: BasicSetting["defaultValue"]) => {
    setSetting(setting.id, value);
  };

  if (setting.id === "downloadDirectory") {
    return <DownloadDirectoryInput />;
  }

  if (setting.id === "defaultSearchEngine") {
    return <DefaultSearchEngineInput />;
  }

  if (setting.type === "enum") {
    const settingValue = getSetting<string>(setting.id);
    return (
      <div className={cn(setting.showName === false ? "w-full" : "w-auto")}>
        <Select value={settingValue} onValueChange={handleSettingChange}>
          <SelectTrigger className="w-full min-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="remove-app-drag z-popover">
            {setting.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {getOptionLabel(option.id, option.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  } else if (setting.type === "boolean") {
    const settingValue = getSetting<boolean>(setting.id);
    return <Switch checked={settingValue} onCheckedChange={handleSettingChange} />;
  }

  return null;
}

export function BasicSettingsCard({ card, transparent }: { card: BasicSettingCard; transparent?: boolean }) {
  const { settings } = useSettings();
  const cardLabels = getCardLabels(card);

  if (card.title === "INTERNAL_UPDATE") {
    return <UpdateCard />;
  } else if (card.title === "INTERNAL_BACKUP") {
    return <ProfileBackupCard />;
  } else if (card.title === "INTERNAL_NEW_TAB_BACKGROUND") {
    return <NewTabBackgroundCard />;
  } else if (card.title === "INTERNAL_ONBOARDING") {
    return <ResetOnboardingCard />;
  }

  return (
    <TooltipProvider>
      <div className={cn("remove-app-drag rounded-lg border p-6", transparent ? "bg-muted/30" : "bg-card")}>
        <div className="mb-4">
          <h3 className="text-xl font-semibold tracking-tight text-card-foreground">{cardLabels.title}</h3>
          {cardLabels.subtitle && <p className="text-sm text-muted-foreground mt-1">{cardLabels.subtitle}</p>}
        </div>
        <div className="space-y-4">
          {card.settings.map((settingId) => {
            if (settingId === "internal_setAsDefaultBrowser") {
              return <SetAsDefaultBrowserSetting key={settingId} />;
            }

            const setting = settings.find((s) => s.id === settingId);
            if (!setting) return null;

            if (setting.id === "customSearchEngines") {
              return <CustomSearchEnginesManager key={setting.id} />;
            }

            const settingDescription = (setting as BasicSetting & { description?: string }).description || null;

            return (
              <div
                key={setting.id}
                className="flex flex-row items-center justify-between gap-4 p-3 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-0.5">
                  <Label htmlFor={setting.id} className="text-sm font-medium">
                    {getSettingLabel(setting)}
                  </Label>
                  {setting.showName !== false && settingDescription && (
                    <p className="text-xs text-muted-foreground">{settingDescription}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SettingsInput setting={setting} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function BasicSettingsCards() {
  const { cards } = useSettings();

  return (
    <div className="space-y-6">
      {cards.map((card, index) => (
        <BasicSettingsCard key={index} card={card} />
      ))}
    </div>
  );
}
