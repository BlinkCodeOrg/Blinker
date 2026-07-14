import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

const HISTORY_ROWS = 100_000;
const BOOKMARK_ROWS = 2_000;
const TAB_ROWS = 500;
const PROFILE_ID = "load-test-profile";

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}

function measure(callback) {
  const startedAt = performance.now();
  const result = callback();
  return { duration: performance.now() - startedAt, result };
}

const db = new DatabaseSync(":memory:");
db.exec(`
  PRAGMA journal_mode = MEMORY;
  PRAGMA synchronous = OFF;
  CREATE TABLE history_urls (
    id INTEGER PRIMARY KEY,
    profile_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    visit_count INTEGER NOT NULL,
    typed_count INTEGER NOT NULL,
    last_visit_time INTEGER NOT NULL
  );
  CREATE INDEX idx_history_urls_profile_last_visit
    ON history_urls (profile_id, last_visit_time);
  CREATE INDEX idx_history_urls_profile_typed_last
    ON history_urls (profile_id, typed_count, last_visit_time);
  CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY,
    profile_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_bookmarks_profile_updated
    ON bookmarks (profile_id, updated_at);
  CREATE TABLE tabs (
    id INTEGER PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    nav_history TEXT NOT NULL
  );
`);

const insertHistory = db.prepare("INSERT INTO history_urls VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertBookmark = db.prepare("INSERT INTO bookmarks VALUES (?, ?, ?, ?, ?)");
const insertTab = db.prepare("INSERT INTO tabs VALUES (?, ?, ?, ?, ?)");
const now = Date.now();

db.exec("BEGIN");
for (let index = 1; index <= HISTORY_ROWS; index += 1) {
  insertHistory.run(
    index,
    PROFILE_ID,
    `https://example-${index % 10_000}.test/page/${index}`,
    `History page ${index}`,
    index % 120,
    index % 20,
    now - index * 1_000
  );
}
for (let index = 1; index <= BOOKMARK_ROWS; index += 1) {
  insertBookmark.run(index, PROFILE_ID, `https://bookmark-${index}.test`, `Bookmark ${index}`, now - index * 2_000);
}
const navigationEntries = JSON.stringify(
  Array.from({ length: 12 }, (_, index) => ({ url: `https://restore-${index}.test`, title: `Page ${index}` }))
);
for (let index = 1; index <= TAB_ROWS; index += 1) {
  insertTab.run(index, PROFILE_ID, `Tab ${index}`, `https://tab-${index}.test`, navigationEntries);
}
db.exec("COMMIT");

const recentHistory = db.prepare(`
  SELECT url, title, visit_count, typed_count, last_visit_time
  FROM history_urls
  WHERE profile_id = ?
  ORDER BY last_visit_time DESC
  LIMIT 900
`);
const typedHistory = db.prepare(`
  SELECT url, title, visit_count, typed_count, last_visit_time
  FROM history_urls
  WHERE profile_id = ?
  ORDER BY typed_count DESC, last_visit_time DESC
  LIMIT 600
`);
const recentBookmarks = db.prepare(`
  SELECT url, title, updated_at
  FROM bookmarks
  WHERE profile_id = ?
  ORDER BY updated_at DESC, id DESC
  LIMIT 600
`);

function loadCandidatePool() {
  const history = new Map();
  for (const row of recentHistory.all(PROFILE_ID)) history.set(row.url, row);
  for (const row of typedHistory.all(PROFILE_ID)) history.set(row.url, row);
  return [...recentBookmarks.all(PROFILE_ID), ...history.values()];
}

const coldDurations = [];
let candidates = [];
for (let iteration = 0; iteration < 50; iteration += 1) {
  const sample = measure(loadCandidatePool);
  coldDurations.push(sample.duration);
  candidates = sample.result;
}

const inputs = ["example", "history 42", "bookmark", "page 999", "test/page"];
const warmDurations = [];
for (let iteration = 0; iteration < 500; iteration += 1) {
  const input = inputs[iteration % inputs.length].toLowerCase();
  const tokens = input.split(/[^a-z0-9]+/).filter(Boolean);
  warmDurations.push(
    measure(() =>
      candidates
        .filter((candidate) => {
          const text = `${candidate.title} ${candidate.url}`.toLowerCase();
          return tokens.every((token) => text.includes(token));
        })
        .slice(0, 20)
    ).duration
  );
}

const restore = measure(() =>
  db
    .prepare("SELECT title, url, nav_history FROM tabs WHERE profile_id = ?")
    .all(PROFILE_ID)
    .map((tab) => ({ ...tab, navHistory: JSON.parse(tab.nav_history) }))
);

const report = {
  fixture: { historyRows: HISTORY_ROWS, bookmarkRows: BOOKMARK_ROWS, tabRows: TAB_ROWS },
  candidatePoolSize: candidates.length,
  candidateQueryMs: {
    median: Number(percentile(coldDurations, 0.5).toFixed(2)),
    p95: Number(percentile(coldDurations, 0.95).toFixed(2)),
    max: Number(Math.max(...coldDurations).toFixed(2))
  },
  cachedSearchMs: {
    median: Number(percentile(warmDurations, 0.5).toFixed(2)),
    p95: Number(percentile(warmDurations, 0.95).toFixed(2)),
    max: Number(Math.max(...warmDurations).toFixed(2))
  },
  restoreTabsMs: Number(restore.duration.toFixed(2)),
  restoredTabs: restore.result.length
};

console.log(JSON.stringify(report, null, 2));

if (report.candidateQueryMs.p95 > 50 || report.cachedSearchMs.p95 > 8 || report.restoreTabsMs > 100) {
  console.error("Browser load test exceeded its performance budget.");
  process.exitCode = 1;
}
