import { getUniqueKeyFromUrl, isValidUrl } from "../helpers";
import { createWebsiteSuggestion } from "../suggestions";
import { cacheUrlTitle, getOmniboxCurrentProfileId } from "../states";
import type { OmniboxSuggestion, WebsiteSuggestion } from "../types";
import type { BookmarkEntry } from "~/types/bookmarks";

const BOOKMARK_LIMIT = 3;
const BOOKMARK_MIN_RELEVANCE = 610;
const BOOKMARK_MAX_RELEVANCE = 735;

type NormalizedBookmarkEntry = BookmarkEntry & {
  titleLower: string;
  urlLower: string;
  folderLower: string;
  uniqueUrlKey: string;
  hostname: string;
  pathAndQuery: string;
  searchTokens: string[];
};

type BookmarksCacheEntry = {
  profileId: string;
  entries: NormalizedBookmarkEntry[];
  loadedAt: number;
  refreshPromise: Promise<void> | null;
};

type PrimeBookmarksCacheOptions = {
  force?: boolean;
};

type RankedBookmarkEntry = {
  suggestion: WebsiteSuggestion;
  relevance: number;
  updatedAt: number;
  urlLength: number;
};

const bookmarksCache = new Map<string, BookmarksCacheEntry>();

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(Boolean)
    )
  );
}

function normalizeBookmarkEntry(entry: BookmarkEntry): NormalizedBookmarkEntry {
  const title = entry.title.trim();
  const titleLower = title.toLowerCase();
  const urlLower = entry.url.toLowerCase();
  const folderLower = entry.folder.toLowerCase();
  const uniqueUrlKey = getUniqueKeyFromUrl(entry.url).toLowerCase();

  if (title) {
    cacheUrlTitle(entry.url, title);
  }

  let hostname = "";
  let pathAndQuery = "";

  try {
    const parsed = new URL(entry.url);
    hostname = parsed.hostname.toLowerCase();
    pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`.toLowerCase();
  } catch {
    pathAndQuery = uniqueUrlKey;
  }

  return {
    ...entry,
    titleLower,
    urlLower,
    folderLower,
    uniqueUrlKey,
    hostname,
    pathAndQuery,
    searchTokens: Array.from(new Set([...tokenize(titleLower), ...tokenize(hostname), ...tokenize(folderLower)]))
  };
}

function getQueryTokens(inputLower: string): string[] {
  const tokens = tokenize(inputLower);
  return tokens.length > 0 ? tokens : [inputLower].filter(Boolean);
}

function hasUrlPrefixMatch(entry: NormalizedBookmarkEntry, inputLower: string): boolean {
  const urlWithHostname = `${entry.hostname}${entry.pathAndQuery}`;
  return (
    entry.urlLower.startsWith(inputLower) ||
    entry.uniqueUrlKey.startsWith(inputLower) ||
    entry.hostname.startsWith(inputLower) ||
    urlWithHostname.startsWith(inputLower)
  );
}

function matchesAllTokens(entry: NormalizedBookmarkEntry, tokens: string[]): boolean {
  return tokens.every(
    (token) =>
      entry.urlLower.includes(token) ||
      entry.titleLower.includes(token) ||
      entry.folderLower.includes(token) ||
      entry.hostname.includes(token)
  );
}

function isUrlLikeInput(input: string): boolean {
  return isValidUrl(input) !== null || /[./:]/.test(input);
}

function getBookmarkRelevance(entry: NormalizedBookmarkEntry, inputLower: string, tokens: string[]): number | null {
  if (!matchesAllTokens(entry, tokens)) {
    return null;
  }

  let score = BOOKMARK_MIN_RELEVANCE;

  if (hasUrlPrefixMatch(entry, inputLower)) {
    score += 80;
  }

  if (entry.titleLower.startsWith(inputLower)) {
    score += 60;
  }

  if (entry.searchTokens.some((token) => tokens.some((queryToken) => token.startsWith(queryToken)))) {
    score += 30;
  }

  if (entry.folderLower.includes(inputLower)) {
    score += 12;
  }

  return Math.min(BOOKMARK_MAX_RELEVANCE, score);
}

function compareBookmarks(left: RankedBookmarkEntry, right: RankedBookmarkEntry): number {
  if (right.relevance !== left.relevance) {
    return right.relevance - left.relevance;
  }
  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  if (left.urlLength !== right.urlLength) {
    return left.urlLength - right.urlLength;
  }
  return left.suggestion.url.localeCompare(right.suggestion.url);
}

function pushTopEntry(item: RankedBookmarkEntry, items: RankedBookmarkEntry[]) {
  const insertionIndex = items.findIndex((existing) => compareBookmarks(item, existing) < 0);

  if (insertionIndex === -1) {
    if (items.length < BOOKMARK_LIMIT) {
      items.push(item);
    }
    return;
  }

  items.splice(insertionIndex, 0, item);
  if (items.length > BOOKMARK_LIMIT) {
    items.length = BOOKMARK_LIMIT;
  }
}

export function primeBookmarksCache(
  profileId: string | null | undefined,
  options: PrimeBookmarksCacheOptions = {}
): Promise<void> {
  if (!profileId) {
    return Promise.resolve();
  }

  const existing = bookmarksCache.get(profileId);
  if (existing?.refreshPromise) {
    return existing.refreshPromise;
  }

  if (existing && !options.force) {
    return Promise.resolve();
  }

  const refreshPromise = flow.bookmarks
    .list()
    .then((bookmarks) => {
      bookmarksCache.set(profileId, {
        profileId,
        entries: bookmarks.map(normalizeBookmarkEntry),
        loadedAt: Date.now(),
        refreshPromise: null
      });
    })
    .catch((error: unknown) => {
      console.error("primeBookmarksCache: bookmarks lookup failed", error);
      if (existing) {
        bookmarksCache.set(profileId, {
          ...existing,
          refreshPromise: null
        });
        return;
      }

      bookmarksCache.delete(profileId);
    });

  bookmarksCache.set(profileId, {
    profileId,
    entries: existing?.entries ?? [],
    loadedAt: existing?.loadedAt ?? 0,
    refreshPromise
  });

  return refreshPromise;
}

export function getBookmarkSuggestions(trimmedInput: string): OmniboxSuggestion[] {
  const profileId = getOmniboxCurrentProfileId();
  if (!profileId) {
    return [];
  }

  const cacheEntry = bookmarksCache.get(profileId);
  if (!cacheEntry || cacheEntry.profileId !== profileId || cacheEntry.entries.length === 0) {
    return [];
  }

  const inputLower = trimmedInput.toLowerCase();
  const tokens = getQueryTokens(inputLower);
  const inputLooksLikeUrl = isUrlLikeInput(trimmedInput);
  const bestEntries: RankedBookmarkEntry[] = [];

  for (const entry of cacheEntry.entries) {
    if (inputLooksLikeUrl && !hasUrlPrefixMatch(entry, inputLower)) {
      continue;
    }

    const relevance = getBookmarkRelevance(entry, inputLower, tokens);
    if (relevance === null) {
      continue;
    }

    pushTopEntry(
      {
        suggestion: createWebsiteSuggestion(entry.url, relevance, entry.title.trim() || null, "bookmark"),
        relevance,
        updatedAt: entry.updatedAt,
        urlLength: entry.uniqueUrlKey.length
      },
      bestEntries
    );
  }

  return bestEntries.map((entry) => entry.suggestion);
}
