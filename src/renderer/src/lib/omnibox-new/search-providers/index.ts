import { googleSearchProvider } from "./google";
import { getRendererSearchEngine } from "@/lib/search-engine-runtime";
import { buildSearchUrlFromTemplate } from "~/search-engines";
import type { SearchProvider } from "./types";

function createGenericSearchProvider(): SearchProvider {
  const engine = getRendererSearchEngine();
  return {
    id: engine.id,
    label: engine.name,
    buildSearchUrl(query: string) {
      return buildSearchUrlFromTemplate(engine.searchUrl, query);
    }
  };
}

export function getSearchProvider(): SearchProvider {
  const engine = getRendererSearchEngine();
  if (engine.id === googleSearchProvider.id) {
    return googleSearchProvider;
  }

  return createGenericSearchProvider();
}
