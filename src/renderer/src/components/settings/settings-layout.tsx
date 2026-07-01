import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { SettingsSidebar } from "./settings-sidebar";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AppUpdatesProvider } from "@/components/providers/app-updates-provider";
import {
  Globe,
  DockIcon,
  UsersIcon,
  OrbitIcon,
  BlocksIcon,
  Info,
  KeyboardIcon,
  KeyRound,
  Import,
  ShieldCheck
} from "lucide-react";
import { ShortcutsProvider } from "@/components/providers/shortcuts-provider";
import { LANGUAGE_CHANGED_EVENT, t } from "@/lib/i18n";

const GeneralSettings = lazy(() =>
  import("@/components/settings/sections/general/section").then((module) => ({ default: module.GeneralSettings }))
);
const IconSettings = lazy(() =>
  import("@/components/settings/sections/icon/section").then((module) => ({ default: module.IconSettings }))
);
const AboutSettings = lazy(() =>
  import("@/components/settings/sections/about/section").then((module) => ({ default: module.AboutSettings }))
);
const ProfilesSettings = lazy(() =>
  import("@/components/settings/sections/profiles/section").then((module) => ({ default: module.ProfilesSettings }))
);
const SpacesSettings = lazy(() =>
  import("@/components/settings/sections/spaces/section").then((module) => ({ default: module.SpacesSettings }))
);
const ExternalAppsSettings = lazy(() =>
  import("@/components/settings/sections/external-apps/section").then((module) => ({
    default: module.ExternalAppsSettings
  }))
);
const ShortcutsSettings = lazy(() =>
  import("@/components/settings/sections/shortcuts/section").then((module) => ({ default: module.ShortcutsSettings }))
);
const PasswordsSettings = lazy(() =>
  import("@/components/settings/sections/passwords/section").then((module) => ({ default: module.PasswordsSettings }))
);
const ImportDataSettings = lazy(() =>
  import("@/components/settings/sections/import-data/section").then((module) => ({
    default: module.ImportDataSettings
  }))
);
const PermissionsSettings = lazy(() =>
  import("@/components/settings/sections/permissions/section").then((module) => ({
    default: module.PermissionsSettings
  }))
);

function SettingsSectionFallback() {
  return <div className="h-32 animate-pulse rounded-lg border bg-card/60" />;
}

export function SettingsLayout() {
  const [activeSection, setActiveSection] = useState(() => window.location.hash.replace("#", "") || "general");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [languageRevision, setLanguageRevision] = useState(0);

  useEffect(() => {
    const handleLanguageChanged = () => setLanguageRevision((revision) => revision + 1);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, handleLanguageChanged);
    return () => window.removeEventListener(LANGUAGE_CHANGED_EVENT, handleLanguageChanged);
  }, []);

  const sections = [
    { id: "general", label: t("settings.general"), icon: <Globe className="h-4 w-4 mr-2" /> },
    { id: "import-data", label: t("settings.importData"), icon: <Import className="h-4 w-4 mr-2" /> },
    { id: "passwords", label: t("settings.passwords"), icon: <KeyRound className="h-4 w-4 mr-2" /> },
    { id: "permissions", label: t("permissions.title"), icon: <ShieldCheck className="h-4 w-4 mr-2" /> },
    { id: "icons", label: t("settings.icon"), icon: <DockIcon className="h-4 w-4 mr-2" /> },
    { id: "profiles", label: t("settings.profiles"), icon: <UsersIcon className="h-4 w-4 mr-2" /> },
    { id: "spaces", label: t("settings.spaces"), icon: <OrbitIcon className="h-4 w-4 mr-2" /> },
    { id: "external-apps", label: t("settings.externalApps"), icon: <BlocksIcon className="h-4 w-4 mr-2" /> },
    { id: "shortcuts", label: t("settings.shortcuts"), icon: <KeyboardIcon className="h-4 w-4 mr-2" /> },
    { id: "about", label: t("settings.about"), icon: <Info className="h-4 w-4 mr-2" /> }
  ];

  const navigateToSpaces = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(null);
    setActiveSection("spaces");
  }, []);

  const navigateToSpace = useCallback((profileId: string, spaceId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(spaceId);
    setActiveSection("spaces");
  }, []);

  const ActiveSectionComponent = useMemo(() => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "passwords":
        return <PasswordsSettings />;
      case "permissions":
        return <PermissionsSettings />;
      case "import-data":
        return <ImportDataSettings />;
      case "icons":
        return <IconSettings />;
      case "about":
        return <AboutSettings />;
      case "profiles":
        return <ProfilesSettings navigateToSpaces={navigateToSpaces} navigateToSpace={navigateToSpace} />;
      case "spaces":
        return <SpacesSettings initialSelectedProfile={selectedProfileId} initialSelectedSpace={selectedSpaceId} />;
      case "external-apps":
        return <ExternalAppsSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      default:
        return <GeneralSettings />;
    }
  }, [activeSection, navigateToSpace, navigateToSpaces, selectedProfileId, selectedSpaceId, languageRevision]);

  return (
    <AppUpdatesProvider>
      <ShortcutsProvider>
        <SettingsProvider>
          <div className="select-none flex flex-col h-screen bg-background text-gray-600 dark:text-gray-300">
            <title>{t("settings.title")}</title>
            <div className="flex flex-1 overflow-hidden">
              <SettingsSidebar activeSection={activeSection} setActiveSection={setActiveSection} sections={sections} />
              <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-6 md:p-8">
                  <div className="mx-auto max-w-4xl">
                    <Suspense fallback={<SettingsSectionFallback />}>{ActiveSectionComponent}</Suspense>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </SettingsProvider>
      </ShortcutsProvider>
    </AppUpdatesProvider>
  );
}
