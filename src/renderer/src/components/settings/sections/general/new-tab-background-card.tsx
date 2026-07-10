import { useEffect, useState } from "react";
import { ImagePlus, Trash2, Video } from "lucide-react";
import type { NewTabBackground } from "~/blinker/interfaces/browser/newTab";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function NewTabBackgroundCard() {
  const [background, setBackground] = useState<NewTabBackground | null>(null);

  useEffect(() => {
    void blinker.newTab.getBackground().then(setBackground);
  }, []);

  const choose = async () => {
    const next = await blinker.newTab.chooseBackground();
    if (next) setBackground(next);
  };

  const clear = async () => setBackground(await blinker.newTab.clearBackground());

  return (
    <div className="remove-app-drag rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {background?.mediaType === "video" ? <Video className="size-5" /> : <ImagePlus className="size-5" />}
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-card-foreground">{t("newTab.background")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("newTab.backgroundDescription")}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void choose()} className="gap-2">
          <ImagePlus className="size-4" />
          {t("newTab.chooseBackground")}
        </Button>
        {background?.sourceUrl && (
          <Button variant="outline" size="icon" onClick={() => void clear()} aria-label={t("newTab.removeBackground")}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {background?.sourceUrl ? t("newTab.resetBackgroundFrame") : t("newTab.backgroundEmpty")}
      </p>
    </div>
  );
}
