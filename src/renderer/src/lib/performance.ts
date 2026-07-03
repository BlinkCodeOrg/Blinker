function arePerfLogsEnabled(): boolean {
  if (import.meta.env.DEV) return true;

  try {
    return globalThis.localStorage?.getItem("blinker:perf") === "1";
  } catch {
    return false;
  }
}

const ENABLE_PERF_LOGS = arePerfLogsEnabled();

type PerformanceDetails = Record<string, string | number | boolean | null>;

function recordRendererMeasure(label: string, duration: number, startedAtMs: number, details?: PerformanceDetails) {
  if (duration >= 8 && ENABLE_PERF_LOGS) {
    console.debug(`[perf] ${label}: ${duration.toFixed(1)}ms`);
  }

  try {
    flow?.app?.recordPerformanceEvent({
      kind: "measure",
      source: "renderer",
      name: label,
      durationMs: duration,
      startedAtMs,
      details
    });
  } catch {
    // Performance collection is best-effort and must never affect page behavior.
  }
}

export function measureSync<T>(label: string, callback: () => T, details?: PerformanceDetails): T {
  const start = performance.now();
  try {
    return callback();
  } finally {
    recordRendererMeasure(label, performance.now() - start, start, details);
  }
}

export async function measureAsync<T>(
  label: string,
  callback: () => Promise<T>,
  details?: PerformanceDetails
): Promise<T> {
  const start = performance.now();
  try {
    return await callback();
  } finally {
    recordRendererMeasure(label, performance.now() - start, start, details);
  }
}
