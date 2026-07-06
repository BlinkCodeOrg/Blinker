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

export const SpacesProvider = ({ windowType, children }: SpacesProviderProps) => {
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [areProfilesInternal, setAreProfilesInternal] = useState<Record<string, boolean>>({});
  const [areProfilesEphemeral, setAreProfilesEphemeral] = useState<Record<string, boolean>>({});
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        if (lastUsedSpace) {
          setCurrentSpace(lastUsedSpace);
        } else if (spaces.length > 0) {
          // If no last used space, default to first non-internal space
          const firstVisible = spaces.find((space) => !nextAreProfilesInternal[space.profileId]) ?? spaces[0];
          setCurrentSpace(firstVisible);
          if (!isReadOnlyConsumer) {
            await blinker.spaces.setUsingSpace(firstVisible.profileId, firstVisible.id);
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
