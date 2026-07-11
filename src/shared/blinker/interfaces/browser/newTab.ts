export type NewTabMode = "omnibox" | "tab";

export type NewTabBackgroundFit = "cover" | "contain" | "stretch";

export type NewTabBackground = {
  sourceUrl: string | null;
  mediaType: "image" | "video" | null;
  fit: NewTabBackgroundFit;
  scale: number;
  positionX: number;
  positionY: number;
  overlay: number;
  blur: number;
};

// API //
export interface BlinkerNewTabAPI {
  /**
   * Opens a new tab
   */
  open: () => void;

  getBackground: () => Promise<NewTabBackground>;
  chooseBackground: () => Promise<NewTabBackground | null>;
  updateBackground: (patch: Partial<Omit<NewTabBackground, "sourceUrl" | "mediaType">>) => Promise<NewTabBackground>;
  clearBackground: () => Promise<NewTabBackground>;
}
