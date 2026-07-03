export type PerformanceEventKind = "mark" | "measure";

export type PerformanceEventSource = "main" | "renderer" | "ipc" | "startup" | "database" | "native";

export type PerformanceEvent = {
  id: number;
  kind: PerformanceEventKind;
  source: PerformanceEventSource;
  name: string;
  durationMs?: number;
  startedAtMs?: number;
  endedAtMs: number;
  details?: Record<string, string | number | boolean | null>;
};

export type PerformanceSnapshot = {
  createdAt: number;
  uptimeMs: number;
  events: PerformanceEvent[];
  slowest: PerformanceEvent[];
};
