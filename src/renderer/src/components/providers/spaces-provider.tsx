import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Space } from "~/blinker/interfaces/sessions/spaces";
import { hexToOKLCHString } from "@/lib/colors";
import { hex_is_light } from "@/lib/utils";
import type { BrowserUIType } from "@/components/browser-ui/types";
import { createPortal } from "react-dom";

interface SpacesContextValue {
  spaces: Space[];
  currentSpace: Space | null;
  isCurrentSpaceLight: boolean;
  isCurrentSpaceInternal: boolean;
  isProfileEphemeral: (profileId: string) => boolean;
  isLoading: boolean;
  revalidate: () => Promise<void>;
  setCurrentSpace: (spaceId: string) => Promise<void>;
}

const SpacesContext = createContext<SpacesContextValue | null>(null);

export const useSpaces = () => {
  const context = useContext(SpacesContext);
  if (!context) {
    throw new Error("useSpaces must be used within a SpacesProvider");
  }
  return context;
};

export function SpaceBackgroundStylesheet({ selector = ":root" }: { selector?: string }) {
  const { currentSpace } = useSpaces();

  if (!currentSpace) return null;

  const bgStart = hexToOKLCHString(currentSpace.bgStartColor || "#000000");
  const bgEnd = hexToOKLCHString(currentSpace.bgEndColor || "#000000");

  return (
    <style>
      {`
${selector} {
  --space-background-start: ${bgStart};
  --space-background-end: ${bgEnd};
}
`}
    </style>
  );
}

interface SpacesProviderProps {
  windowType: BrowserUIType;
  children: React.ReactNode;
}

const SPACES_CACHE_KEY = "BLINKER_SIDEBAR_SPACES_V1";
const SPACES_CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

type SpacesCache = {
  savedAt: number;
  spaces: Space[];
  currentSpaceId: string | null;
  areProfilesInternal: Record<string, boolean>;
  areProfilesEphemeral: Record<string, boolean>;
};

function readSpacesCache(): SpacesCache | null {
  try {
    const raw = localStorage.getItem(SPACES_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SpacesCache;
    if (!Array.isArray(value.spaces) || Date.now() - value.savedAt > SPACES_CACHE_MAX_AGE) return null;
    return value;
  } catch {
    return null;
  }
}

export const SpacesProvider = ({ windowType, children }: SpacesProviderProps) => {
  const initialCache = useMemo(readSpacesCache, []);
  const [allSpaces, setAllSpaces] = useState<Space[]>(() => initialCache?.spaces ?? []);
  const [areProfilesInternal, setAreProfilesInternal] = useState<Record<string, boolean>>(
    () => initialCache?.areProfilesInternal ?? {}
  );
  const [areProfilesEphemeral, setAreProfilesEphemeral] = useState<Record<string, boolean>>(
    () => initialCache?.areProfilesEphemeral ?? {}
  );
  const [currentSpace, setCurrentSpace] = useState<Space | null>(
    () => initialCache?.spaces.find((space) => space.id === initialCache.currentSpaceId) ?? null
  );
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const currentSpaceRef = useRef<Space | null>(null);
  const isReadOnlyConsumer = windowType === "none";

  // Expose only spaces whose profile is not internal to the UI
  const visibleSpaces = useMemo(
    () => allSpaces.filter((space) => !areProfilesInternal[space.profileId]),
    [allSpaces, areProfilesInternal]
  );

  // Whether the current space belongs to an internal profile (e.g. incognito)
  const isCurrentSpaceInternal = useMemo(
    () => (currentSpace ? Boolean(areProfilesInternal[currentSpace.profileId]) : false),
    [currentSpace, areProfilesInternal]
  );

  useEffect(() => {
    currentSpaceRef.current = currentSpace;
  }, [currentSpace]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SPACES_CACHE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          spaces: allSpaces,
          currentSpaceId: currentSpace?.id ?? null,
          areProfilesInternal,
          areProfilesEphemeral
        } satisfies SpacesCache)
      );
    } catch {
      // The cache is a startup hint; IPC data remains authoritative.
    }
  }, [allSpaces, areProfilesEphemeral, areProfilesInternal, currentSpace?.id]);

  const fetchSpaces = useCallback(
    async (preferredSpaceId?: string) => {
      if (!blinker) return;
      try {
        const [spaces, profiles] = await Promise.all([blinker.spaces.getSpaces(), blinker.profiles.getProfiles()]);
        const nextAreProfilesInternal = Object.fromEntries(profiles.map((profile) => [profile.id, profile.internal]));
        const nextAreProfilesEphemeral = Object.fromEntries(profiles.map((profile) => [profile.id, profile.ephemeral]));
        setAllSpaces(spaces);
        setAreProfilesInternal(nextAreProfilesInternal);
        setAreProfilesEphemeral(nextAreProfilesEphemeral);

        if (preferredSpaceId) {
          const preferredSpace = spaces.find((space) => space.id === preferredSpaceId);
          if (preferredSpace) {
            setCurrentSpace(preferredSpace);
            return;
          }
        }

        const existingCurrentSpaceId = currentSpaceRef.current?.id;
        if (existingCurrentSpaceId) {
          const updatedCurrentSpace = spaces.find((space) => space.id === existingCurrentSpaceId);
          if (updatedCurrentSpace) {
            setCurrentSpace(updatedCurrentSpace);
            return;
          }
        }

        // Get and set window space if available
        const windowSpaceId = await blinker.spaces.getUsingSpace();
        if (windowSpaceId) {
          const windowSpace = spaces.find((space) => space.id === windowSpaceId);
          if (windowSpace) {
            setCurrentSpace(windowSpace);
            return;
          }
        }

        // Get and set last used space if no window space
        const lastUsedSpace = await blinker.spaces.getLastUsedSpace();
        const fallbackSpace =
          (lastUsedSpace && spaces.find((space) => space.id === lastUsedSpace.id)) ??
          spaces.find((space) => !nextAreProfilesInternal[space.profileId]) ??
          spaces[0];

        if (fallbackSpace) {
          setCurrentSpace(fallbackSpace);
          // The restored window can reference a space that was deleted manually.
          // Persist the fallback so the next launch cannot return to the stale ID.
          if (!isReadOnlyConsumer) {
            await blinker.spaces.setUsingSpace(fallbackSpace.profileId, fallbackSpace.id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch spaces:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isReadOnlyConsumer]
  );

  const revalidate = useCallback(async () => {
    setIsLoading(true);
    await fetchSpaces();
  }, [fetchSpaces]);

  const isProfileEphemeral = useCallback(
    (profileId: string) => {
      return Boolean(areProfilesEphemeral[profileId]);
    },
    [areProfilesEphemeral]
  );

  const handleSetCurrentSpace = useCallback(
    async (spaceId: string) => {
      if (windowType !== "main") return;
      if (!blinker) return;
      const space = allSpaces.find((s) => s.id === spaceId);
      if (!space) return;
      if (space.id === currentSpaceRef.current?.id) return;

      try {
        await blinker.spaces.setUsingSpace(space.profileId, spaceId);
        setCurrentSpace(space);
      } catch (error) {
        console.error("Failed to set current space:", error);
      }
    },
    [allSpaces, windowType]
  );

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    if (isReadOnlyConsumer) return;
    if (!currentSpace) return;
    blinker.browser.loadProfile(currentSpace.profileId);
  }, [currentSpace, isReadOnlyConsumer]);

  useEffect(() => {
    const unsub = blinker.spaces.onSetWindowSpace((spaceId) => {
      const space = allSpaces.find((entry) => entry.id === spaceId);
      if (space) {
        setCurrentSpace(space);
        return;
      }

      void fetchSpaces(spaceId);
    });
    return () => unsub();
  }, [allSpaces, fetchSpaces]);

  useEffect(() => {
    const unsub = blinker.spaces.onSpacesChanged(() => {
      revalidate();
    });
    return () => unsub();
  }, [revalidate]);

  const isSpaceLight = useMemo(
    () => hex_is_light(currentSpace?.bgStartColor || "#000000"),
    [currentSpace?.bgStartColor]
  );

  // On current space change, hide omnibox
  const currentSpaceIdRef = useRef("");
  useEffect(() => {
    if (isReadOnlyConsumer) return;
    if (currentSpaceIdRef.current === currentSpace?.id) return;
    if (!currentSpace) return;
    currentSpaceIdRef.current = currentSpace.id;
    blinker.omnibox.hide();
  }, [currentSpace, isReadOnlyConsumer]);

  const contextValue = useMemo(
    () => ({
      spaces: visibleSpaces,
      currentSpace,
      isLoading,
      isCurrentSpaceLight: isSpaceLight,
      isCurrentSpaceInternal,
      isProfileEphemeral,
      revalidate,
      setCurrentSpace: handleSetCurrentSpace
    }),
    [
      visibleSpaces,
      currentSpace,
      isLoading,
      isSpaceLight,
      isCurrentSpaceInternal,
      isProfileEphemeral,
      revalidate,
      handleSetCurrentSpace
    ]
  );

  return (
    <SpacesContext.Provider value={contextValue}>
      {createPortal(<SpaceBackgroundStylesheet />, document.head)}
      {children}
    </SpacesContext.Provider>
  );
};
