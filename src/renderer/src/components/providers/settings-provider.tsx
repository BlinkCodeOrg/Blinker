import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { BasicSetting, BasicSettingCard } from "~/types/settings";
import { setLocalePreference } from "@/lib/i18n";

interface SettingsContextValue {
  settings: BasicSetting[];
  cards: BasicSettingCard[];
  getSetting: <T>(settingId: string) => T;
  setSetting: (settingId: string, value: unknown) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export function useSetting<T>(settingId: string): [T, (value: T) => Promise<boolean>] {
  const { getSetting, setSetting } = useSettings();
  const value = getSetting<T>(settingId);
  const set = useCallback((newValue: T) => setSetting(settingId, newValue), [settingId, setSetting]);
  return [value, set];
}

interface SettingsProviderProps {
  children: React.ReactNode;
}

function syncRendererSetting(settingId: string, value: unknown) {
  if (settingId === "appLanguage" && typeof value === "string") {
    setLocalePreference(value);
  }
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [settings, setSettings] = useState<BasicSetting[]>([]);
  const [cards, setCards] = useState<BasicSettingCard[]>([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, unknown>>({});

  const fetchSettings = useCallback(async () => {
    if (!flow) return;

    const { settings: fetchedSettings, cards: fetchedCards } = await flow.settings.getBasicSettings();
    setSettings(fetchedSettings);
    setCards(fetchedCards);

    const promises = fetchedSettings.map(async (setting) => {
      const value = await flow.settings.getSetting(setting.id);
      syncRendererSetting(setting.id, value);
      setSettingsValues((prev) => ({ ...prev, [setting.id]: value }));
    });

    await Promise.all(promises);
  }, []);

  const revalidate = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const unsub = flow.settings.onSettingsChanged(() => {
      revalidate();
    });
    return () => unsub();
  }, [revalidate]);

  const getSetting = useCallback(
    (settingId: string) => {
      return settingsValues[settingId];
    },
    [settingsValues]
  );

  const setSetting = useCallback(async (settingId: string, value: unknown) => {
    const saved = await flow.settings.setSetting(settingId, value);
    if (saved) {
      syncRendererSetting(settingId, value);
      setSettingsValues((prev) => ({ ...prev, [settingId]: value }));
    }
    return saved;
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        cards,
        getSetting: getSetting as <T>(settingId: string) => T,
        setSetting
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
