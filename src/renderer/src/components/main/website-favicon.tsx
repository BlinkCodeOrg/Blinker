import { GlobeIcon } from "lucide-react";
import { useState } from "react";

export function WebsiteFavicon({
  url,
  favicon,
  className,
  cacheOnly = false,
  onLoadedChange
}: {
  url: string;
  favicon?: string;
  className?: string;
  cacheOnly?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
}) {
  const [useBlinkerUtility, setUseBlinkerUtility] = useState(true);
  const [useCustomFavicon, setUseCustomFavicon] = useState(false);

  if (useBlinkerUtility) {
    const srcUrl = new URL("blinker://favicon");
    srcUrl.searchParams.set("url", url);
    return (
      <img
        src={srcUrl.toString()}
        alt="Favicon"
        className={className}
        onLoad={() => onLoadedChange?.(true)}
        onError={() => {
          onLoadedChange?.(false);
          setUseBlinkerUtility(false);
          if (!cacheOnly && favicon) {
            setUseCustomFavicon(true);
          }
        }}
      />
    );
  }

  if (!cacheOnly && useCustomFavicon && favicon) {
    return (
      <img
        src={favicon}
        alt="Favicon"
        className={className}
        onLoad={() => onLoadedChange?.(true)}
        onError={() => {
          onLoadedChange?.(false);
          setUseCustomFavicon(false);
        }}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
    );
  }

  return <GlobeIcon className={className} />;
}
