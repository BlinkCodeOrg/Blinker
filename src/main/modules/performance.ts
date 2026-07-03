import { performance } from "node:perf_hooks";
import type { PerformanceEvent, PerformanceEventSource, PerformanceSnapshot } from "~/types/performance";

const MAX_EVENTS = 600;
const SLOW_EVENT_THRESHOLD_MS = 8;

const events: PerformanceEvent[] = [];
let nextId = 1;
const processStartedAt = performance.timeOrigin;

function sanitizeDetails(details?: Record<string, unknown>): PerformanceEvent["details"] {
  if (!details) return undefined;

  const sanitized: NonNullable<PerformanceEvent["details"]> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function pushEvent(event: Omit<PerformanceEvent, "id">) {
  events.push({ ...event, id: nextId++ });
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function markPerformance(
  name: string,
  source: PerformanceEventSource = "main",
  details?: Record<string, unknown>
) {
  pushEvent({
    kind: "mark",
    source,
    name,
    endedAtMs: performance.now(),
    details: sanitizeDetails(details)
  });
}

export function recordPerformanceMeasure(
  name: string,
  durationMs: number,
  source: PerformanceEventSource = "main",
  details?: Record<string, unknown>,
  startedAtMs?: number
) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  pushEvent({
    kind: "measure",
    source,
    name,
    durationMs,
    startedAtMs,
    endedAtMs: startedAtMs === undefined ? performance.now() : startedAtMs + durationMs,
    details: sanitizeDetails(details)
  });
}

export async function measurePerformance<T>(
  name: string,
  source: PerformanceEventSource,
  callback: () => Promise<T>,
  details?: Record<string, unknown>
): Promise<T> {
  const startedAtMs = performance.now();
  try {
    return await callback();
  } finally {
    recordPerformanceMeasure(name, performance.now() - startedAtMs, source, details, startedAtMs);
  }
}

export function measurePerformanceSync<T>(
  name: string,
  source: PerformanceEventSource,
  callback: () => T,
  details?: Record<string, unknown>
): T {
  const startedAtMs = performance.now();
  try {
    return callback();
  } finally {
    recordPerformanceMeasure(name, performance.now() - startedAtMs, source, details, startedAtMs);
  }
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  const copied = [...events];
  const slowest = copied
    .filter((event) => event.kind === "measure" && (event.durationMs ?? 0) >= SLOW_EVENT_THRESHOLD_MS)
    .sort((left, right) => (right.durationMs ?? 0) - (left.durationMs ?? 0))
    .slice(0, 30);

  return {
    createdAt: Date.now(),
    uptimeMs: performance.now(),
    events: copied,
    slowest
  };
}

export function clearPerformanceEvents() {
  events.length = 0;
  markPerformance("perf.clear", "main");
}

markPerformance("process.start", "startup", {
  timeOrigin: Math.round(processStartedAt),
  pid: process.pid
});
