import { ComponentProps, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
type PhosphorIconProps = Omit<ComponentProps<"span">, "id" | "color"> & {
  id: string;
  fallbackId?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  weight?: IconWeight;
};

const iconSvgCache = new Map<string, string>();
let iconAssetsModule: Promise<typeof import("./phosphor-icon-assets")> | null = null;
const fallbackDotSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128 32a96 96 0 1 0 96 96 96.11 96.11 0 0 0-96-96Zm0 168a72 72 0 1 1 72-72 72.08 72.08 0 0 1-72 72Z" opacity="0.22"/><path d="M128 84a44 44 0 1 0 44 44 44.05 44.05 0 0 0-44-44Zm0 64a20 20 0 1 1 20-20 20 20 0 0 1-20 20Z"/></svg>';

function getIconName(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function loadIcon(id: string, weight: IconWeight) {
  iconAssetsModule ??= import("./phosphor-icon-assets");
  return iconAssetsModule.then(({ loadPhosphorIconAsset }) => loadPhosphorIconAsset(getIconName(id), weight));
}

function normalizeSize(size: number | string | undefined) {
  if (typeof size === "number") return `${size}px`;
  return size;
}

export function PhosphorIcon({
  id,
  fallbackId,
  className,
  color,
  size,
  strokeWidth,
  style,
  weight = "duotone",
  ...props
}: PhosphorIconProps) {
  const [svg, setSvg] = useState(() => iconSvgCache.get(`${weight}:${getIconName(id)}`) ?? "");
  const dimension = normalizeSize(size);
  void strokeWidth;

  useEffect(() => {
    let cancelled = false;
    const iconName = getIconName(id);
    const cacheKey = `${weight}:${iconName}`;
    const cached = iconSvgCache.get(cacheKey);
    if (cached) {
      setSvg(cached);
      return;
    }

    loadIcon(id, weight)
      .then((markup) => {
        if (cancelled) return;
        if (markup) {
          iconSvgCache.set(cacheKey, markup);
          setSvg(markup);
          return;
        }

        if (!fallbackId) {
          setSvg("");
          return;
        }

        return loadIcon(fallbackId, weight).then((fallbackMarkup) => {
          if (!cancelled) setSvg(fallbackMarkup ?? "");
        });
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackId, id, weight]);

  return (
    <span
      {...props}
      className={cn("inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full", className)}
      style={{ width: dimension, height: dimension, color, ...style }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : fallbackId ? { __html: fallbackDotSvg } : undefined}
    />
  );
}

export function SpaceIcon({ ...props }: ComponentProps<typeof PhosphorIcon>) {
  return <PhosphorIcon fallbackId="DotOutline" weight="duotone" {...props} />;
}
