export const DEFAULT_SEARCH_ENGINE_ID = "google";
export const CUSTOM_SEARCH_ENGINE_PREFIX = "custom:";

export interface SearchEngineDefinition {
  id: string;
  name: string;
  searchUrl: string;
  isCustom?: boolean;
}

export interface CustomSearchEngine {
  id: string;
  name: string;
  searchUrl: string;
}

export const BUILT_IN_SEARCH_ENGINES: SearchEngineDefinition[] = [
  {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q={query}"
  },
  {
    id: "yandex",
    name: "Yandex",
    searchUrl: "https://yandex.ru/search/?text={query}"
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q={query}"
  },
  {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q={query}"
  }
];

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function hasSearchPlaceholder(searchUrl: string): boolean {
  return searchUrl.includes("{query}") || searchUrl.includes("%s");
}

export function buildSearchUrlFromTemplate(searchUrl: string, query: string): string {
  const encodedQuery = encodeURIComponent(query);

  if (searchUrl.includes("{query}")) {
    return searchUrl.replaceAll("{query}", encodedQuery);
  }

  if (searchUrl.includes("%s")) {
    return searchUrl.replaceAll("%s", encodedQuery);
  }

  const url = new URL(searchUrl);
  url.searchParams.set("q", query);
  return url.toString();
}

export function isValidSearchUrlTemplate(value: string): boolean {
  const searchUrl = value.trim();
  if (!searchUrl || !/^https?:\/\//i.test(searchUrl)) {
    return false;
  }

  try {
    const resolvedUrl = buildSearchUrlFromTemplate(searchUrl, "blinker test");
    const url = new URL(resolvedUrl);
    return ["http:", "https:"].includes(url.protocol) && (hasSearchPlaceholder(searchUrl) || url.searchParams.has("q"));
  } catch {
    return false;
  }
}

export function parseCustomSearchEngines(rawValue: unknown): CustomSearchEngine[] {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const engines: CustomSearchEngine[] = [];
    const seenIds = new Set<string>();

    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      const id = normalizeString(record.id, 80);
      const name = normalizeString(record.name, 80);
      const searchUrl = normalizeString(record.searchUrl, 500);

      if (!id || !name || !isValidSearchUrlTemplate(searchUrl) || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      engines.push({ id, name, searchUrl });
    }

    return engines;
  } catch {
    return [];
  }
}

export function serializeCustomSearchEngines(engines: CustomSearchEngine[]): string {
  return JSON.stringify(
    engines.map((engine) => ({
      id: engine.id,
      name: engine.name.trim(),
      searchUrl: engine.searchUrl.trim()
    }))
  );
}

export function getCustomSearchEngineSettingId(engineId: string): string {
  return `${CUSTOM_SEARCH_ENGINE_PREFIX}${engineId}`;
}

export function getAllSearchEngines(rawCustomSearchEngines: unknown): SearchEngineDefinition[] {
  const customEngines = parseCustomSearchEngines(rawCustomSearchEngines).map((engine) => ({
    id: getCustomSearchEngineSettingId(engine.id),
    name: engine.name,
    searchUrl: engine.searchUrl,
    isCustom: true
  }));

  return [...BUILT_IN_SEARCH_ENGINES, ...customEngines];
}

export function getSearchEngineById(engineId: unknown, rawCustomSearchEngines: unknown): SearchEngineDefinition {
  const normalizedEngineId = typeof engineId === "string" && engineId ? engineId : DEFAULT_SEARCH_ENGINE_ID;
  return (
    getAllSearchEngines(rawCustomSearchEngines).find((engine) => engine.id === normalizedEngineId) ??
    BUILT_IN_SEARCH_ENGINES[0]
  );
}

export function buildSearchUrlForEngine(engineId: unknown, rawCustomSearchEngines: unknown, query: string): string {
  const engine = getSearchEngineById(engineId, rawCustomSearchEngines);
  return buildSearchUrlFromTemplate(engine.searchUrl, query);
}
