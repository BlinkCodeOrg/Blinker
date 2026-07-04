import { AddressBar } from "@/components/browser-ui/browser-sidebar/_components/address-bar";
import { BottomExtrasMenu } from "@/components/browser-ui/browser-sidebar/_components/bottom/bottom-extras-menu";
import { DownloadsButton } from "@/components/browser-ui/browser-sidebar/_components/downloads-button";
import { NavigationControls, NavButton } from "@/components/browser-ui/browser-sidebar/_components/navigation-controls";
import { SpaceSwitcher } from "@/components/browser-ui/browser-sidebar/_components/bottom/space-switcher";
import { useAdaptiveTopbar } from "@/components/browser-ui/adaptive-topbar";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useTabsGroups } from "@/components/providers/tabs-provider";
import { cn, craftActiveFaviconURL } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "motion/react";
import { FileIcon, PlusIcon, XIcon } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TabData } from "~/types/tabs";

function TopbarTab({ tab, isFocused, isSpaceLight }: { tab: TabData; isFocused: boolean; isSpaceLight: boolean }) {
  const [cachedFaviconUrl, setCachedFaviconUrl] = useState<string | null>(tab.faviconURL);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const noFavicon = !cachedFaviconUrl || faviconFailed;

  useEffect(() => {
    setCachedFaviconUrl(tab.faviconURL);
    setFaviconFailed(false);
  }, [tab.faviconURL]);

  const switchToTab = useCallback(() => {
    void flow.tabs.switchToTab(tab.id);
  }, [tab.id]);

  const closeTab = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void flow.tabs.closeTab(tab.id);
    },
    [tab.id]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button === 0) switchToTab();
      if (event.button === 1) {
        event.preventDefault();
        void flow.tabs.closeTab(tab.id);
      }
    },
    [switchToTab, tab.id]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      flow.tabs.showContextMenu(tab.id);
    },
    [tab.id]
  );

  return (
    <motion.button
      type="button"
      layout="position"
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "group/tab relative h-8 min-w-28 max-w-52 flex-1 overflow-hidden rounded-lg px-2",
        "flex items-center gap-2 text-left transition-[background-color,color,box-shadow]",
        !isFocused && "text-black/70 hover:bg-black/10 dark:text-white/70 dark:hover:bg-white/10",
        isFocused &&
          "bg-white/85 text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:bg-white/15 dark:text-white dark:shadow-none"
      )}
      title={tab.title || t("topbar.untitled")}
      whileTap={{ scale: 0.985 }}
    >
      <span className="size-4 shrink-0 overflow-hidden rounded-sm">
        {!noFavicon ? (
          <img
            src={craftActiveFaviconURL(tab.id, cachedFaviconUrl)}
            alt=""
            className={cn("size-full object-contain", tab.asleep && "grayscale opacity-70")}
            style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <span
            className={cn(
              "flex size-full items-center justify-center rounded-sm",
              isSpaceLight ? "bg-black/10 text-black/45" : "bg-white/10 text-white/45"
            )}
          >
            <FileIcon className="size-3" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{tab.title || t("topbar.untitled")}</span>
      <span
        role="button"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={closeTab}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity",
          "hover:bg-black/10 group-hover/tab:opacity-100 dark:hover:bg-white/10",
          isFocused && "opacity-80"
        )}
      >
        <XIcon className="size-3.5" />
      </span>
    </motion.button>
  );
}

const MemoTopbarTab = memo(
  TopbarTab,
  (prev, next) => prev.tab === next.tab && prev.isFocused === next.isFocused && prev.isSpaceLight === next.isSpaceLight
);

function TopbarTabs() {
  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const { getTabGroups, getFocusedTab } = useTabsGroups();

  const focusedTab = currentSpace ? getFocusedTab(currentSpace.id) : null;
  const tabs = useMemo(() => {
    if (!currentSpace) return [];
    return getTabGroups(currentSpace.id).flatMap((group) => group.tabs);
  }, [currentSpace, getTabGroups]);

  const openNewTab = useCallback(() => {
    void flow.newTab.open();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <motion.div layout className="flex min-w-max items-center gap-1">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <MemoTopbarTab
                key={tab.id}
                tab={tab}
                isFocused={focusedTab?.id === tab.id}
                isSpaceLight={isCurrentSpaceLight}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      <NavButton icon={<PlusIcon className="size-4" />} onClick={openNewTab} />
    </div>
  );
}

export function BrowserTopbar() {
  const { setContentTopOffset } = useAdaptiveTopbar();
  const { isCurrentSpaceLight } = useSpaces();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const report = () => setContentTopOffset(el.offsetHeight);
    report();

    const resizeObserver = new ResizeObserver(report);
    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
      setContentTopOffset(0);
    };
  }, [setContentTopOffset]);

  return (
    <div
      ref={ref}
      className={cn(
        "remove-app-drag w-full min-w-0 px-2 pb-2",
        "flex flex-col gap-1.5",
        !isCurrentSpaceLight && "dark"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="shrink-0">
          <NavigationControls />
        </div>
        <div className="min-w-[240px] flex-1">
          <AddressBar />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <BottomExtrasMenu />
          <SpaceSwitcher />
          <DownloadsButton />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <TopbarTabs />
      </div>
    </div>
  );
}
