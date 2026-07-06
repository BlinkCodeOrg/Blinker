import { and, desc, eq, or, sql } from "drizzle-orm";
import { existsSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { app } from "electron";
import { getDb } from "@/saving/db";
import { bookmarks, historyUrls } from "@/saving/db/schema";
import type { OmniboxPlaceSuggestion, OmniboxPlaceSuggestionSource } from "~/blinker/interfaces/browser/omnibox";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const SQL_PREFILTER_LIMIT = 1200;
const NATIVE_RANK_THRESHOLD = 700;

type PlaceCandidate = {
  url: string;
  title: string;
  source: OmniboxPlaceSuggestionSource;
  visitCount: number;
  typedCount: number;
  recencyTime: number;
};

type RankedPlaceCandidate = PlaceCandidate & {
  relevance: number;
};

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
    )
  ).slice(0, 4);
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getUrlKey(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}${url.search}${url.hash}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function getCandidateRelevance(candidate: PlaceCandidate, inputLower: string, tokens: string[]): number | null {
  const titleLower = candidate.title.toLowerCase();
  const urlLower = candidate.url.toLowerCase();
  const hostname = safeHostname(candidate.url);
  const urlKey = getUrlKey(candidate.url);

  if (!tokens.every((token) => titleLower.includes(token) || urlLower.includes(token) || hostname.includes(token))) {
    return null;
  }

  let score = candidate.source === "bookmark" ? 610 : 470;

  if (urlLower.startsWith(inputLower) || urlKey.startsWith(inputLower) || hostname.startsWith(inputLower)) {
    score += candidate.source === "bookmark" ? 95 : 150;
  }
  if (titleLower.startsWith(inputLower)) {
    score += 80;
  }
  if (tokens.some((token) => hostname.startsWith(token))) {
    score += 45;
  }

  const age = Date.now() - candidate.recencyTime;
  if (age < 24 * 60 * 60 * 1000) score += 120;
  else if (age < 7 * 24 * 60 * 60 * 1000) score += 80;
  else if (age < 30 * 24 * 60 * 60 * 1000) score += 40;

  score += Math.min(candidate.typedCount * 14, 160);
  score += Math.min(candidate.visitCount * 3, 100);

  return Math.min(candidate.source === "bookmark" ? 760 : 720, score);
}

function compareRankedPlaces(left: RankedPlaceCandidate, right: RankedPlaceCandidate): number {
  if (right.relevance !== left.relevance) return right.relevance - left.relevance;
  if (right.recencyTime !== left.recencyTime) return right.recencyTime - left.recencyTime;
  if (right.typedCount !== left.typedCount) return right.typedCount - left.typedCount;
  return left.url.localeCompare(right.url);
}

function getNativeRankerPath(): string | null {
  const executableName = process.platform === "win32" ? "blinker-omnibox-ranker.exe" : "blinker-omnibox-ranker";
  const candidates = [
    path.join(process.resourcesPath, "native", executableName),
    path.join(app.getAppPath(), "native", "bin", executableName),
    path.join(app.getAppPath(), "native", "omnibox-ranker", "target", "release", executableName)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function escapeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

function rankPlacesWithNativeRust(
  candidates: PlaceCandidate[],
  input: string,
  limit: number
): OmniboxPlaceSuggestion[] | null {
  const rankerPath = getNativeRankerPath();
  if (!rankerPath) return null;

  const payload = [
    input,
    String(limit),
    ...candidates.map((candidate) =>
      [
        escapeTsv(candidate.url),
        escapeTsv(candidate.title),
        candidate.source,
        candidate.visitCount,
        candidate.typedCount,
        candidate.recencyTime
      ].join("\t")
    )
  ].join("\n");

  const result = spawnSync(rankerPath, {
    input: payload,
    encoding: "utf8",
    timeout: 160,
    windowsHide: true,
    maxBuffer: 64 * 1024
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const ranked: OmniboxPlaceSuggestion[] = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line) continue;
    const [indexRaw, relevanceRaw] = line.split("\t");
    const index = Number(indexRaw);
    const relevance = Number(relevanceRaw);
    const candidate = candidates[index];
    if (!candidate || !Number.isFinite(relevance)) continue;
    ranked.push({
      url: candidate.url,
      title: candidate.title || null,
      relevance,
      source: candidate.source
    });
  }

  return ranked.length > 0 ? ranked : null;
}

function rankPlacesInTypeScript(candidates: PlaceCandidate[], input: string, limit: number): OmniboxPlaceSuggestion[] {
  const inputLower = input.toLowerCase();
  const tokens = tokenize(inputLower);
  const ranked: RankedPlaceCandidate[] = [];

  for (const candidate of candidates) {
    const relevance = getCandidateRelevance(candidate, inputLower, tokens);
    if (relevance === null) continue;

    const item: RankedPlaceCandidate = { ...candidate, relevance };
    const insertionIndex = ranked.findIndex((existing) => compareRankedPlaces(item, existing) < 0);

    if (insertionIndex === -1) {
      if (ranked.length < limit) ranked.push(item);
      continue;
    }

    ranked.splice(insertionIndex, 0, item);
    if (ranked.length > limit) ranked.length = limit;
  }

  return ranked.map((item) => ({
    url: item.url,
    title: item.title || null,
    relevance: item.relevance,
    source: item.source
  }));
}

function listPlaceCandidates(profileId: string, input: string): PlaceCandidate[] {
  const db = getDb();
  const tokens = tokenize(input);
  if (tokens.length === 0) return [];

  const historySearch = or(
    ...tokens.map(
      (token) => sql`instr(lower(${historyUrls.url}), ${token}) > 0 OR instr(lower(${historyUrls.title}), ${token}) > 0`
    )
  );
  const bookmarkSearch = or(
    ...tokens.map(
      (token) =>
        sql`instr(lower(${bookmarks.url}), ${token}) > 0 OR instr(lower(${bookmarks.title}), ${token}) > 0 OR instr(lower(${bookmarks.folder}), ${token}) > 0`
    )
  );

  const historyRows = db
    .select({
      url: historyUrls.url,
      title: historyUrls.title,
      visitCount: historyUrls.visitCount,
      typedCount: historyUrls.typedCount,
      recencyTime: historyUrls.lastVisitTime
    })
    .from(historyUrls)
    .where(and(eq(historyUrls.profileId, profileId), historySearch))
    .orderBy(desc(historyUrls.typedCount), desc(historyUrls.lastVisitTime))
    .limit(SQL_PREFILTER_LIMIT)
    .all();

  const bookmarkRows = db
    .select({
      url: bookmarks.url,
      title: bookmarks.title,
      recencyTime: bookmarks.updatedAt
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.profileId, profileId), bookmarkSearch))
    .orderBy(desc(bookmarks.updatedAt), desc(bookmarks.id))
    .limit(Math.min(SQL_PREFILTER_LIMIT, 600))
    .all();

  return [
    ...bookmarkRows.map((row) => ({
      url: row.url,
      title: row.title,
      source: "bookmark" as const,
      visitCount: 0,
      typedCount: 0,
      recencyTime: row.recencyTime
    })),
    ...historyRows.map((row) => ({
      url: row.url,
      title: row.title,
      source: "history" as const,
      visitCount: row.visitCount,
      typedCount: row.typedCount,
      recencyTime: row.recencyTime
    }))
  ];
}

export function searchOmniboxPlacesForProfile(
  profileId: string,
  input: string,
  requestedLimit = DEFAULT_LIMIT
): OmniboxPlaceSuggestion[] {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const candidates = listPlaceCandidates(profileId, trimmed);

  // Rust native ranking is intentionally optional. If a compiled ranker is added
  // to the build later, only huge candidate sets should use it; the TS path stays
  // as the reliable default for normal browsing data.
  if (candidates.length >= NATIVE_RANK_THRESHOLD) {
    return rankPlacesWithNativeRust(candidates, trimmed, limit) ?? rankPlacesInTypeScript(candidates, trimmed, limit);
  }

  return rankPlacesInTypeScript(candidates, trimmed, limit);
}
