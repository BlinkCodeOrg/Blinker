export type NewTabMode = "omnibox" | "tab";

// API //
export interface BlinkerNewTabAPI {
  /**
   * Opens a new tab
   */
  open: () => void;
}
