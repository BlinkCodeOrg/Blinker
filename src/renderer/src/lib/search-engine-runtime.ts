import {
  DEFAULT_SEARCH_ENGINE_ID,
  buildSearchUrlForEngine,
  getSearchEngineById,
  type SearchEngineDefinition
} from "~/search-engines";

interface RendererSearchEngineSettings {
  defaultSearchEngine: unknown;
  customSearchEngines: unknown;
}

let currentSettings: RendererSearchEngineSettings = {
  defaultSearchEngine: DEFAULT_SEARCH_ENGINE_ID,
  customSearchEngines: "[]"
};

export function setRendererSearchEngineSettings(settings: Partial<RendererSearchEngineSettings>) {
  currentSettings = {
    ...currentSettings,
    ...settings
  };
}

export function getRendererSearchEngine(): SearchEngineDefinition {
  return getSearchEngineById(currentSettings.defaultSearchEngine, currentSettings.customSearchEngines);
}

export function createRendererSearchUrl(query: string): string {
  return buildSearchUrlForEngine(currentSettings.defaultSearchEngine, currentSettings.customSearchEngines, query);
}
