import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GlobeIcon, HeartIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function SetAsDefaultBrowserSetting() {
  const [isDefault, setIsDefault] = useState<boolean | null>(null);

  const refetchDefaultBrowser = useCallback(async () => {
    const isDefaultResult = await blinker.app.getDefaultBrowser();
    setIsDefault(isDefaultResult);
  }, []);

  useEffect(() => {
    void refetchDefaultBrowser();
    window.addEventListener("focus", refetchDefaultBrowser);
    return () => window.removeEventListener("focus", refetchDefaultBrowser);
  }, [refetchDefaultBrowser]);

  const setDefaultBrowser = async () => {
    await blinker.app.setDefaultBrowser();
    await refetchDefaultBrowser();
  };

  return (
    <div className="flex flex-row items-center justify-between gap-4 p-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-0.5">
        <Label htmlFor="default-browser-button" className="text-sm font-medium">
          Default Browser
        </Label>
        <p className="text-xs text-muted-foreground">Set Blinker as your default browser.</p>
      </div>
      <div className="flex items-center gap-2">
        {isDefault === null && <Loader2Icon className="animate-spin h-5 w-5 text-muted-foreground" />}
        {isDefault === false && (
          <Button
            id="default-browser-button"
            variant="outline"
            className="h-fit py-1.5 px-3 text-sm"
            onClick={setDefaultBrowser}
          >
            <GlobeIcon className="h-4 w-4 mr-2" />
            Set to Blinker
          </Button>
        )}
        {isDefault === true && (
          <Button
            id="default-browser-button"
            variant="outline"
            className="h-fit py-1.5 px-3 text-sm cursor-default"
            disabled
          >
            <HeartIcon className="h-4 w-4 mr-2 text-green-500" />
            Blinker is Default
          </Button>
        )}
      </div>
    </div>
  );
}
