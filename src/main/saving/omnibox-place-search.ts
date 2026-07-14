import { desc, eq } from "drizzle-orm";
import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";
import { app } from "electron";
import { getDb } from "@/saving/db";
import { bookmarks, historyUrls } from "@/saving/db/schema";
import type { OmniboxPlaceSuggestion, OmniboxPlaceSuggestionSource } from "~/blinker/interfaces/browser/omnibox";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const RECENT_HISTORY_LIMIT = 900;
const TYPED_HISTORY_LIMIT = 600;
const BOOKMARK_LIMIT = 600;
const NATIVE_RANK_THRESHOLD = 700;
const CANDIDATE_CACHE_TTL_MS = 2_500;
const MAX_CACHED_PROFILES = 8;

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

type CandidateCacheEntry = {
  expiresAt: number;
  candidates: PlaceCandidate[];
};

const candidateCache = new Map<string, CandidateCacheEntry>();

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

async function rankPlacesWithNativeRust(
  candidates: PlaceCandidate[],
  input: string,
  limit: number
): Promise<OmniboxPlaceSuggestion[] | null> {
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

  const stdout = await new Promise<string | null>((resolve) => {
    const child = spawn(rankerPath, [], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"]
    });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(null);
    }, 160);

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 64 * 1024) {
        child.kill();
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code === 0 ? Buffer.concat(chunks).toString("utf8") : null));
    child.stdin.on("error", () => finish(null));
    child.stdin.end(payload);
  });

  if (stdout === null) return null;

  const ranked: OmniboxPlaceSuggestion[] = [];
  for (const line of stdout.split(/\r?\n/)) {
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

function listPlaceCandidates(profileId: string): PlaceCandidate[] {
  const now = Date.now();
  const cached = candidateCache.get(profileId);
  if (cached && cached.expiresAt > now) return cached.candidates;

  const db = getDb();
  const historySelection = {
    url: historyUrls.url,
    title: historyUrls.title,
    visitCount: historyUrls.visitCount,
    typedCount: historyUrls.typedCount,
    recencyTime: historyUrls.lastVisitTime
  };
  const recentHistoryRows = db
    .select(historySelection)
    .from(historyUrls)
    .where(eq(historyUrls.profileId, profileId))
    .orderBy(desc(historyUrls.lastVisitTime))
    .limit(RECENT_HISTORY_LIMIT)
    .all();
  const typedHistoryRows = db
    .select(historySelection)
    .from(historyUrls)
    .where(eq(historyUrls.profileId, profileId))
    .orderBy(desc(historyUrls.typedCount), desc(historyUrls.lastVisitTime))
    .limit(TYPED_HISTORY_LIMIT)
    .all();
  const bookmarkRows = db
    .select({
      url: bookmarks.url,
      title: bookmarks.title,
      recencyTime: bookmarks.updatedAt
    })
    .from(bookmarks)
    .where(eq(bookmarks.profileId, profileId))
    .orderBy(desc(bookmarks.updatedAt), desc(bookmarks.id))
    .limit(BOOKMARK_LIMIT)
    .all();

  const historyRows = new Map<string, (typeof recentHistoryRows)[number]>();
  for (const row of recentHistoryRows) historyRows.set(row.url, row);
  for (const row of typedHistoryRows) historyRows.set(row.url, row);

  const candidates = [
    ...bookmarkRows.map((row) => ({
      url: row.url,
      title: row.title,
      source: "bookmark" as const,
      visitCount: 0,
      typedCount: 0,
      recencyTime: row.recencyTime
    })),
    ...historyRows.values().map((row) => ({
      url: row.url,
      title: row.title,
      source: "history" as const,
      visitCount: row.visitCount,
      typedCount: row.typedCount,
      recencyTime: row.recencyTime
    }))
  ];

  candidateCache.delete(profileId);
  candidateCache.set(profileId, { expiresAt: now + CANDIDATE_CACHE_TTL_MS, candidates });
  while (candidateCache.size > MAX_CACHED_PROFILES) {
    const oldestProfileId = candidateCache.keys().next().value;
    if (oldestProfileId === undefined) break;
    candidateCache.delete(oldestProfileId);
  }

  return candidates;
}

export async function searchOmniboxPlacesForProfile(
  profileId: string,
  input: string,
  requestedLimit = DEFAULT_LIMIT
): Promise<OmniboxPlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const inputLower = trimmed.toLowerCase();
  const tokens = tokenize(inputLower);
  const candidates = listPlaceCandidates(profileId).filter((candidate) => {
    const title = candidate.title.toLowerCase();
    const url = candidate.url.toLowerCase();
    return tokens.every((token) => title.includes(token) || url.includes(token));
  });

  // Rust native ranking is intentionally optional. If a compiled ranker is added
  // to the build later, only huge candidate sets should use it; the TS path stays
  // as the reliable default for normal browsing data.
  if (candidates.length >= NATIVE_RANK_THRESHOLD) {
    return (
      (await rankPlacesWithNativeRust(candidates, trimmed, limit)) ?? rankPlacesInTypeScript(candidates, trimmed, limit)
    );
  }

  return rankPlacesInTypeScript(candidates, trimmed, limit);
}
