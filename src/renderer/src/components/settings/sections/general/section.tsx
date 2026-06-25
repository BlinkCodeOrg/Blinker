import { BasicSettingsCards } from "@/components/settings/sections/general/basic-settings-cards";
import { t } from "@/lib/i18n";

export function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{t("settings.general")}</h2>
        <p className="text-muted-foreground">{t("settings.generalSubtitle")}</p>
      </div>

      <BasicSettingsCards />
    </div>
  );
}
