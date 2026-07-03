import { PageBounds, IPCListener } from "~/flow/types";

export type OmniboxOpenIn = "current" | "new_tab";
export type OmniboxShadowPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type OmniboxOpenState = {
  currentInput: string;
  openIn: OmniboxOpenIn;
  sequence: number;
  shadowPadding: OmniboxShadowPadding;
};

export type OmniboxOpenParams = {
  currentInput?: string;
  openIn?: OmniboxOpenIn;
};

export type OmniboxPlaceSuggestionSource = "history" | "bookmark";

export type OmniboxPlaceSuggestion = {
  url: string;
  title: string | null;
  relevance: number;
  source: OmniboxPlaceSuggestionSource;
};

// API //
export interface FlowOmniboxAPI {
  /**
   * Shows the omnibox
   */
  show: (bounds: PageBounds | null, params: OmniboxOpenParams | null) => void;

  /**
   * Gets the current omnibox open state.
   */
  getState: () => Promise<OmniboxOpenState | null>;

  /**
   * Listens for omnibox open-state changes.
   */
  onStateChanged: IPCListener<[OmniboxOpenState]>;

  /**
   * Searches larger history/bookmark datasets outside of the renderer.
   */
  searchPlaces: (input: string, limit?: number) => Promise<OmniboxPlaceSuggestion[]>;

  /**
   * Hides the omnibox
   */
  hide: () => void;
}
