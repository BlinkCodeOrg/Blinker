import { IPCListener } from "~/blinker/types";
import type { BasicSetting, BasicSettingCard } from "~/types/settings";

// API //
export interface BlinkerSettingsAPI {
  /**
   * Gets the value of a setting
   */
  getSetting<T extends BasicSetting>(settingId: string): Promise<T["defaultValue"]>;

  /**
   * Sets the value of a setting
   */
  setSetting: (settingId: string, value: unknown) => Promise<boolean>;

  /**
   * Gets the basic settings and cards
   */
  getBasicSettings: () => Promise<{
    settings: BasicSetting[];
    cards: BasicSettingCard[];
  }>;

  /**
   * Listens for changes to the settings */
  onSettingsChanged: IPCListener<[void]>;
}
