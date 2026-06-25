import { BrowserInfoCard } from "./browser-info-card";
import { t } from "@/lib/i18n";

export function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{t("about.title")}</h2>
        <p className="text-muted-foreground">{t("about.subtitle")}</p>
      </div>

      <BrowserInfoCard />
    </div>
  );
}
