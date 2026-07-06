import { createWebsiteSuggestion } from "../suggestions";
import type { OmniboxFlush } from "../helpers";
import { measureAsync } from "@/lib/performance";

export async function flushPlaceSuggestions(input: string, flush: OmniboxFlush, signal: AbortSignal): Promise<void> {
  try {
    const places = await measureAsync("renderer.omnibox.searchPlaces", () => blinker.omnibox.searchPlaces(input, 6), {
      inputLength: input.length,
      limit: 6
    });
    if (signal.aborted || places.length === 0) {
      return;
    }

    flush(places.map((place) => createWebsiteSuggestion(place.url, place.relevance, place.title, place.source)));
  } catch (error) {
    if (!signal.aborted) {
      console.error("flushPlaceSuggestions: main-process place search failed", error);
    }
  }
}
