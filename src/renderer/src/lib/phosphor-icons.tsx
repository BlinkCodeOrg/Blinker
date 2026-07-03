import { IconEntry, icons } from "@phosphor-icons/core";
import { ComponentProps, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const PhosphorIcons = icons as unknown as IconEntry[];

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
type IconLoader = () => Promise<string>;
type PhosphorIconProps = Omit<ComponentProps<"span">, "id" | "color"> & {
  id: string;
  fallbackId?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  weight?: IconWeight;
};

const iconNameByPascalName = new Map(PhosphorIcons.map((icon) => [icon.pascal_name, icon.name]));
const iconSvgCache = new Map<string, string>();
const iconLoaderPathCache = new Map<string, IconLoader | null>();
const fallbackDotSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128 32a96 96 0 1 0 96 96 96.11 96.11 0 0 0-96-96Zm0 168a72 72 0 1 1 72-72 72.08 72.08 0 0 1-72 72Z" opacity="0.22"/><path d="M128 84a44 44 0 1 0 44 44 44.05 44.05 0 0 0-44-44Zm0 64a20 20 0 1 1 20-20 20 20 0 0 1-20 20Z"/></svg>';
const duotoneIconLoaders = import.meta.glob("/node_modules/@phosphor-icons/core/assets/duotone/*.svg", {
  query: "?raw",
  import: "default"
}) as Record<string, IconLoader>;

function getIconName(id: string): string {
  return (
    iconNameByPascalName.get(id) ??
    id
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/_/g, "-")
      .toLowerCase()
  );
}

function getIconLoader(id: string, weight: IconWeight): IconLoader | null {
  const iconName = getIconName(id);
  const cacheKey = `${weight}:${iconName}`;
  if (iconLoaderPathCache.has(cacheKey)) {
    return iconLoaderPathCache.get(cacheKey) ?? null;
  }

  const suffix = `/${weight}/${iconName}-${weight}.svg`;
  const loaderKey = Object.keys(duotoneIconLoaders).find((key) => key.endsWith(suffix));
  const loader = loaderKey ? duotoneIconLoaders[loaderKey] : null;
  iconLoaderPathCache.set(cacheKey, loader);
  return loader;
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

    const loader = getIconLoader(id, weight) ?? (fallbackId ? getIconLoader(fallbackId, weight) : null);
    if (!loader) {
      setSvg("");
      return;
    }

    loader()
      .then((markup) => {
        if (cancelled) return;
        iconSvgCache.set(cacheKey, markup);
        setSvg(markup);
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
