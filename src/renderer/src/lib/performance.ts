function arePerfLogsEnabled(): boolean {
  if (import.meta.env.DEV) return true;

  try {
    return globalThis.localStorage?.getItem("blinker:perf") === "1";
  } catch {
    return false;
  }
}

const ENABLE_PERF_LOGS = arePerfLogsEnabled();

export function measureSync<T>(label: string, callback: () => T): T {
  if (!ENABLE_PERF_LOGS) return callback();

  const start = performance.now();
  try {
    return callback();
  } finally {
    const duration = performance.now() - start;
    if (duration >= 8) {
      console.debug(`[perf] ${label}: ${duration.toFixed(1)}ms`);
    }
  }
}
