import { cn } from "@/lib/utils";
import { FileUp } from "lucide-react";
import { usePresence } from "motion/react";
import { type CSSProperties, type DragEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMount } from "react-use";
import { type AttachedDirection, useBrowserSidebar, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from "./provider";
import { type SidebarVariant } from "@/components/browser-ui/types";
import { useAdaptiveTopbar } from "@/components/browser-ui/adaptive-topbar";
import { SidebarInner } from "./inner";
import { type ImperativeResizablePanelWrapperHandle, PixelBasedResizablePanel } from "@/components/ui/resizable-extras";
import { PortalComponent } from "@/components/portal/portal";
import { SpaceBackgroundStylesheet } from "@/components/providers/spaces-provider";
import { SIDEBAR_ANIMATION_CSS_EASING, SIDEBAR_ANIMATION_DURATION_MS } from "~/blinker/sidebar-animation";

// Component //
const SIDEBAR_ANIMATION_STYLE: CSSProperties = {
  transitionDuration: `${SIDEBAR_ANIMATION_DURATION_MS}ms`,
  transitionTimingFunction: SIDEBAR_ANIMATION_CSS_EASING
};

const WEB_DROP_URL_PROTOCOLS = new Set(["http:", "https:", "file:", "blinker:", "chrome:", "extension:"]);

function isLocalPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);
}

function encodePathSegment(segment: string, index: number): string {
  if (index === 0 && /^[a-zA-Z]:$/.test(segment)) {
    return segment;
  }
  return encodeURIComponent(segment);
}

function localPathToFileUrl(filePath: string): string {
  const normalizedPath = filePath.trim().replace(/\\/g, "/");

  if (normalizedPath.startsWith("//")) {
    const [, , host, ...parts] = normalizedPath.split("/");
    return `file://${host}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
  }

  return `file:///${normalizedPath.split("/").map(encodePathSegment).join("/")}`;
}

function normalizeDroppedUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  if (isLocalPath(trimmedValue)) {
    return localPathToFileUrl(trimmedValue);
  }

  try {
    const url = new URL(trimmedValue);
    return WEB_DROP_URL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractUrlsFromUriList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(normalizeDroppedUrl)
    .filter((url): url is string => Boolean(url));
}

function extractUrlsFromHtml(value: string): string[] {
  const urls: string[] = [];
  const pattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    const url = normalizeDroppedUrl(match[1]);
    if (url) urls.push(url);
  }

  return urls;
}

function getFilePath(file: File): string | null {
  const path = (file as File & { path?: string }).path;
  return typeof path === "string" && path ? path : null;
}

function getDroppedUrls(dataTransfer: DataTransfer): string[] {
  const urls = new Set<string>();

  for (const file of Array.from(dataTransfer.files)) {
    const path = getFilePath(file);
    if (path) urls.add(localPathToFileUrl(path));
  }

  for (const url of extractUrlsFromUriList(dataTransfer.getData("text/uri-list"))) {
    urls.add(url);
  }

  const plainText = dataTransfer.getData("text/plain");
  for (const token of plainText.split(/\s+/)) {
    const url = normalizeDroppedUrl(token);
    if (url) urls.add(url);
  }

  for (const url of extractUrlsFromHtml(dataTransfer.getData("text/html"))) {
    urls.add(url);
  }

  return Array.from(urls);
}

function hasOpenableDrop(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.files.length > 0 ||
    dataTransfer.types.includes("text/uri-list") ||
    dataTransfer.types.includes("text/plain") ||
    dataTransfer.types.includes("text/html")
  );
}

export function BrowserSidebar({
  direction,
  variant,
  order,
  skipEntryAnimation = false
}: {
  direction: AttachedDirection;
  variant: SidebarVariant;
  order: number;
  skipEntryAnimation?: boolean;
}) {
  const isFloating = variant === "floating";

  const { isVisible, startAnimation, stopAnimation, recordedSidebarSizeRef, notifySidebarResize, mode } =
    useBrowserSidebar();
  const { topbarHeight } = useAdaptiveTopbar();

  const panelRef = useRef<ImperativeResizablePanelWrapperHandle>(null);
  const dragDepthRef = useRef(0);
  const [isExternalDragOver, setExternalDragOver] = useState(false);

  const openDroppedItems = useCallback((event: DragEvent<HTMLDivElement>) => {
    const urls = getDroppedUrls(event.dataTransfer);
    if (urls.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    urls.forEach((url, index) => {
      void blinker.tabs.newTab(url, index === 0);
    });
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasOpenableDrop(event.dataTransfer)) return;

    event.preventDefault();
    dragDepthRef.current += 1;
    setExternalDragOver(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasOpenableDrop(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setExternalDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasOpenableDrop(event.dataTransfer)) return;

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setExternalDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setExternalDragOver(false);
      openDroppedItems(event);
    },
    [openDroppedItems]
  );

  // AnimatePresence Controller (from motion/react) //
  // Declared early because isPresent is used in the animation readiness gate.
  const [isPresent, safeToRemove] = usePresence();
  const removingRef = useRef(false);

  // Animation Readiness //
  // Ensure the browser paints the initial off-screen position before enabling
  // the CSS transition. For portal windows (separate WebContentsViews), we
  // must use the *portal's* requestAnimationFrame — the main window's rAF
  // does not align with the portal's paint cycle, which can cause the
  // transition to have no "from" state (sidebar pops in with no animation).
  // We force a synchronous reflow on the animated element, then double-rAF
  // on the element's own window to guarantee the off-screen layout is
  // painted before enabling the transition.
  //
  // When skipEntryAnimation is true (attached→floating transition), the
  // sidebar should appear in-place instantly — no slide-in needed.
  //
  // isPresent is included in the dependency array so this effect re-runs
  // when AnimatePresence re-uses the same component instance (e.g. the
  // user hovers away then re-hovers before the exit finishes). Without
  // this, isAnimationReady stays true from the first entry and the
  // re-entry pops in with no slide animation.
  const animatedRef = useRef<HTMLDivElement>(null);
  const [isAnimationReady, setAnimationReady] = useState(skipEntryAnimation);
  useLayoutEffect(() => {
    // During exit, leave isAnimationReady untouched so the slide-out
    // transition can finish naturally.
    if (!isPresent) return;

    if (skipEntryAnimation) {
      setAnimationReady(true);
      return;
    }

    // Reset for fresh entry or re-entry (same instance reused by AnimatePresence).
    setAnimationReady(false);

    const el = animatedRef.current;
    if (el) {
      void el.getBoundingClientRect(); // force reflow in the portal's document
    }
    // Use the element's owning window — critical for portal windows
    const win = el?.ownerDocument?.defaultView ?? window;
    let innerRafId: number;
    // Double-rAF: first frame paints the off-screen position,
    // second frame is safe to enable the transition.
    const outerRafId = win.requestAnimationFrame(() => {
      innerRafId = win.requestAnimationFrame(() => {
        setAnimationReady(true);
      });
    });
    return () => {
      win.cancelAnimationFrame(outerRafId);
      if (innerRafId !== undefined) win.cancelAnimationFrame(innerRafId);
    };
  }, [skipEntryAnimation, isPresent]);

  // Combine all visibility signals.
  // For attached sidebars, include isPresent so AnimatePresence exit triggers
  // the collapse animation (needed during attached→floating where the context
  // isVisible stays true because isFloating keeps it true).
  // For floating sidebars, do NOT include isPresent — the floating sidebar's
  // exit is either instant (→attached: just disappear, attached takes over)
  // or driven by isVisible going false (→hidden: slide out naturally).
  const currentlyVisible = isFloating ? isVisible && isAnimationReady : isVisible && isAnimationReady && isPresent;

  useEffect(() => {
    // Remove from DOM after being removed from React
    if (!isPresent) {
      if (removingRef.current) return;
      removingRef.current = true;

      // Attached ↔ Floating: the other variant takes over in-place,
      // so skip the exit animation and remove immediately.
      const isSwappingVariants =
        (isFloating && mode.startsWith("attached")) || (!isFloating && mode.startsWith("floating"));
      if (isSwappingVariants) {
        safeToRemove();
        return;
      }

      const animId = startAnimation();
      setTimeout(() => {
        if (removingRef.current) {
          safeToRemove();
          stopAnimation(animId);
        }
      }, SIDEBAR_ANIMATION_DURATION_MS);
    } else {
      removingRef.current = false;
    }
  }, [isPresent, safeToRemove, startAnimation, stopAnimation, isFloating, mode]);

  useMount(() => {
    // Register animation as started when the component is mounted, and wait until animation is complete.
    // Skip when entry animation is skipped (attached→floating transition) — the sidebar
    // appears in-place and the main process should snap bounds, not interpolate.
    if (skipEntryAnimation) return;
    const animId = startAnimation();
    setTimeout(() => {
      stopAnimation(animId);
    }, SIDEBAR_ANIMATION_DURATION_MS);
  });

  // Sidebar Panel Size //
  // When the panel is resized (drag), notify the provider so BrowserContent
  // can send updated layout params to the main process.
  const updateSidebarSize = useCallback(() => {
    const currentPanelSize = panelRef.current?.getSizePixels();
    if (currentPanelSize) {
      notifySidebarResize(currentPanelSize);
    }
  }, [notifySidebarResize]);

  // Keep persisted sidebar size up-to-date without polling.
  useEffect(() => {
    const onWindowResize = () => updateSidebarSize();
    const onPointerUp = () => updateSidebarSize();

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [updateSidebarSize]);

  useEffect(() => {
    const rafId = requestAnimationFrame(updateSidebarSize);
    return () => cancelAnimationFrame(rafId);
  }, [updateSidebarSize]);

  // Render Component //

  const content = (
    <div
      data-space-background-scope={isFloating ? "" : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative w-full h-full max-h-screen remove-app-drag",
        "transition-transform",
        "flex flex-col",
        isFloating && "rounded-lg border border-sidebar-border/50 sidebar-floating-bg backdrop-blur-sm"
      )}
      style={SIDEBAR_ANIMATION_STYLE}
    >
      {isFloating && <SpaceBackgroundStylesheet selector="[data-space-background-scope]" />}
      <div
        className={cn(
          "m-2.5 mb-0 flex-1 min-h-0",
          "flex flex-col",
          "select-none",
          direction === "left" && !isFloating && "mr-0",
          direction === "right" && !isFloating && "ml-0"
        )}
      >
        <SidebarInner direction={direction} variant={variant} />
      </div>
      {isExternalDragOver && (
        <div className="pointer-events-none absolute inset-2 z-elevated flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/30 bg-black/45 text-center text-white shadow-2xl backdrop-blur-sm">
          <FileUp className="size-7" />
          <div className="px-3 text-xs font-medium leading-snug">Drop to open in a new tab</div>
        </div>
      )}
    </div>
  );

  if (isFloating) {
    return (
      <PortalComponent
        className="fixed"
        style={{
          top: topbarHeight,
          [direction === "left" ? "left" : "right"]: 0,
          width: recordedSidebarSizeRef.current + 30,
          height: `calc(100vh - ${topbarHeight}px)`
        }}
        visible={true}
        layerType="floatingSidebar"
      >
        <div
          ref={animatedRef}
          id="sidebar"
          className={cn(
            "h-full overflow-hidden p-2",
            "transition-transform",
            currentlyVisible ? "translate-x-0" : direction === "left" ? "-translate-x-full" : "translate-x-full",
            topbarHeight > 0 && `pt-[max(0px,calc(8px-${topbarHeight}px))]`
          )}
          style={SIDEBAR_ANIMATION_STYLE}
        >
          {content}
        </div>
      </PortalComponent>
    );
  }

  const attachedClassName = cn(
    "h-full overflow-hidden w-[calc(var(--panel-size)+30px)]",
    "transition-[margin]",
    direction === "left" && (currentlyVisible ? "ml-0" : "-ml-[var(--panel-size)]"),
    direction === "right" && (currentlyVisible ? "mr-0" : "-mr-[var(--panel-size)]"),
    // Remove flex so the sidebar hiding animation can play correctly
    !currentlyVisible && "!flex-[unset]"
  );

  const attachedStyle = {
    "--panel-size": `${recordedSidebarSizeRef.current}px`,
    ...SIDEBAR_ANIMATION_STYLE
  } as CSSProperties;

  return (
    <PixelBasedResizablePanel
      id="sidebar"
      wrapperRef={panelRef}
      order={order}
      defaultSizePixels={recordedSidebarSizeRef.current}
      className={attachedClassName}
      style={attachedStyle}
      minSizePixels={MIN_SIDEBAR_WIDTH}
      maxSizePixels={MAX_SIDEBAR_WIDTH}
      onResize={updateSidebarSize}
    >
      {content}
    </PixelBasedResizablePanel>
  );
}
