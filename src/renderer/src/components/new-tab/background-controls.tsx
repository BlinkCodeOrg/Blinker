import { useState } from "react";
import { ImagePlus, RotateCcw, SlidersHorizontal, Trash2, Video } from "lucide-react";
import type { NewTabBackground, NewTabBackgroundFit } from "~/blinker/interfaces/browser/newTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { t } from "@/lib/i18n";

type BackgroundControlsProps = {
  background: NewTabBackground;
  onChange: (background: NewTabBackground) => void;
};

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground tabular-nums">
          {value}
          {max === 3 ? "x" : "%"}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} />
    </div>
  );
}

export function NewTabBackgroundControls({ background, onChange }: BackgroundControlsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<Omit<NewTabBackground, "sourceUrl" | "mediaType">>) => {
    const next = await blinker.newTab.updateBackground(patch);
    onChange(next);
  };

  const choose = async () => {
    setSaving(true);
    try {
      const next = await blinker.newTab.chooseBackground();
      if (next) onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      onChange(await blinker.newTab.clearBackground());
    } finally {
      setSaving(false);
    }
  };

  const resetFrame = () => void update({ fit: "cover", scale: 1, positionX: 50, positionY: 50, overlay: 0 });

  const fit = background.fit as NewTabBackgroundFit;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm" aria-label={t("newTab.background")}>
          <SlidersHorizontal className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newTab.background")}</DialogTitle>
          <DialogDescription>{t("newTab.backgroundDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-video">
            {background.sourceUrl ? (
              background.mediaType === "video" ? (
                <video
                  src={background.sourceUrl}
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  className="size-full object-cover"
                />
              ) : (
                <img src={background.sourceUrl} alt="" className="size-full object-cover" />
              )
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImagePlus className="size-6" />
                {t("newTab.backgroundEmpty")}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void choose()} disabled={saving} className="flex-1 gap-2">
              {background.mediaType === "video" ? <Video className="size-4" /> : <ImagePlus className="size-4" />}
              {t("newTab.chooseBackground")}
            </Button>
            {background.sourceUrl && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => void clear()}
                disabled={saving}
                aria-label={t("newTab.removeBackground")}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          {background.sourceUrl && (
            <>
              <div className="space-y-2">
                <Label>{t("newTab.backgroundFit")}</Label>
                <Select value={fit} onValueChange={(next) => void update({ fit: next as NewTabBackgroundFit })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">{t("newTab.fitCover")}</SelectItem>
                    <SelectItem value="contain">{t("newTab.fitContain")}</SelectItem>
                    <SelectItem value="stretch">{t("newTab.fitStretch")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <SliderRow
                label={t("newTab.backgroundScale")}
                value={background.scale}
                min={0.5}
                max={3}
                step={0.05}
                onChange={(scale) => void update({ scale })}
              />
              <SliderRow
                label={t("newTab.backgroundHorizontal")}
                value={background.positionX}
                min={0}
                max={100}
                onChange={(positionX) => void update({ positionX })}
              />
              <SliderRow
                label={t("newTab.backgroundVertical")}
                value={background.positionY}
                min={0}
                max={100}
                onChange={(positionY) => void update({ positionY })}
              />
              <SliderRow
                label={t("newTab.backgroundOverlay")}
                value={background.overlay}
                min={0}
                max={80}
                onChange={(overlay) => void update({ overlay })}
              />

              <Button variant="ghost" className="w-full gap-2" onClick={resetFrame}>
                <RotateCcw className="size-4" />
                {t("newTab.resetBackgroundFrame")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
