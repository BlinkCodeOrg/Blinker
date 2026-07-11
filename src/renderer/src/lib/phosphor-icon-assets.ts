type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
type IconLoader = () => Promise<string>;

const duotoneIconLoaders = import.meta.glob("../../../../node_modules/@phosphor-icons/core/assets/duotone/*.svg", {
  query: "?raw",
  import: "default"
}) as Record<string, IconLoader>;

const loaderCache = new Map<string, IconLoader | null>();

export async function loadPhosphorIconAsset(iconName: string, weight: IconWeight): Promise<string | null> {
  const cacheKey = `${weight}:${iconName}`;
  let loader = loaderCache.get(cacheKey);

  if (loader === undefined) {
    const suffix = `/${weight}/${iconName}-${weight}.svg`;
    const loaderKey = Object.keys(duotoneIconLoaders).find((key) => key.endsWith(suffix));
    loader = loaderKey ? duotoneIconLoaders[loaderKey] : null;
    loaderCache.set(cacheKey, loader);
  }

  return loader ? loader() : null;
}
