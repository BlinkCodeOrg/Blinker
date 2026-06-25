import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";

const getAppInfo = flow.app.getAppInfo;

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <>
      <div className="text-sm font-medium text-muted-foreground pr-2 py-1.5 break-words">{label}</div>
      <div className="text-sm text-card-foreground col-span-2 pl-2 py-1.5 break-words">{value}</div>
    </>
  );
}

export function BrowserInfoCard() {
  const [appInfo, setAppInfo] = useState<Awaited<ReturnType<typeof getAppInfo>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getAppInfo()
      .then((info) => {
        setAppInfo(info);
      })
      .catch((error) => {
        console.error("Failed to fetch app info:", error);
        setAppInfo(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="rounded-lg border bg-card text-card-foreground p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold tracking-tight">{t("about.infoTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("about.infoSubtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>{t("about.loading")}</span>
        </div>
      ) : appInfo ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 border-t pt-4">
          <InfoRow label={t("about.browserName")} value="Blinker Browser" />
          <InfoRow label={t("about.version")} value={appInfo.app_version} />
          <InfoRow label={t("about.buildNumber")} value={appInfo.build_number} />
          <InfoRow label={t("about.engineVersion")} value={`Chromium ${appInfo.chrome_version}`} />
          <InfoRow label={t("about.os")} value={appInfo.os} />
          <InfoRow label={t("about.updateChannel")} value={appInfo.update_channel} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-destructive">{t("about.failed")}</div>
      )}
    </div>
  );
}
