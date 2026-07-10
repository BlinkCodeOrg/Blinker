import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { copyTextToClipboard } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PerformanceEvent, PerformanceSnapshot } from "~/types/performance";

function formatDuration(duration?: number) {
  if (duration === undefined) return "-";
  if (duration < 1) return `${Math.round(duration * 1000)}us`;
  return `${duration.toFixed(1)}ms`;
}

function formatDetails(event: PerformanceEvent) {
  if (!event.details) return "";
  return Object.entries(event.details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

function Page() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const hostnames = [
    "about",
    "new-tab",
    "bookmarks",
    "downloads",
    "history",
    "games",
    "omnibox",
    "error",
    "extensions"
  ];

  const loadSnapshot = useCallback(async () => {
    setLoadingSnapshot(true);
    try {
      setSnapshot(await blinker.app.getPerformanceSnapshot());
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const summary = useMemo(() => {
    const events = snapshot?.events ?? [];
    return {
      total: events.length,
      measures: events.filter((event) => event.kind === "measure").length,
      marks: events.filter((event) => event.kind === "mark").length,
      uptime: snapshot ? `${(snapshot.uptimeMs / 1000).toFixed(1)}s` : "-"
    };
  }, [snapshot]);

  const copySnapshot = useCallback(() => {
    if (!snapshot) return;
    copyTextToClipboard(JSON.stringify(snapshot, null, 2));
  }, [snapshot]);

  const clearSnapshot = useCallback(async () => {
    await blinker.app.clearPerformanceSnapshot();
    await loadSnapshot();
  }, [loadSnapshot]);

  return (
    <div className="w-screen min-h-screen bg-background p-8 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl w-full space-y-6"
      >
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Blinker URLs</CardTitle>
            <CardDescription>A list of available Blinker browser URLs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hostnames.map((hostname) => {
                const url = `blinker://${hostname}`;
                return (
                  <div key={url} className="p-3 rounded-md bg-muted flex justify-between items-center">
                    <span className="text-foreground font-medium">{url}</span>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => copyTextToClipboard(url)}>
                        Copy URL
                      </Button>
                      <Button variant="default" size="sm" onClick={() => window.open(url, "_blank")}>
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">Performance</CardTitle>
                <CardDescription>
                  Startup, IPC, renderer and database timings collected in this session.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={loadingSnapshot} onClick={() => void loadSnapshot()}>
                  Refresh
                </Button>
                <Button variant="outline" size="sm" disabled={!snapshot} onClick={copySnapshot}>
                  Copy JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => void clearSnapshot()}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Events</div>
                <div className="text-xl font-semibold">{summary.total}</div>
              </div>
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Measures</div>
                <div className="text-xl font-semibold">{summary.measures}</div>
              </div>
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Marks</div>
                <div className="text-xl font-semibold">{summary.marks}</div>
              </div>
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Uptime</div>
                <div className="text-xl font-semibold">{summary.uptime}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground">Slowest measurements</div>
              <div className="overflow-hidden rounded-md border border-border">
                {(snapshot?.slowest.length ?? 0) === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No slow measurements yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {snapshot!.slowest.map((event) => (
                      <div key={event.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{event.name}</span>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {event.source}
                            </span>
                          </div>
                          {formatDetails(event) ? (
                            <div className="mt-1 truncate text-xs text-muted-foreground">{formatDetails(event)}</div>
                          ) : null}
                        </div>
                        <div className="font-mono text-sm text-foreground">{formatDuration(event.durationMs)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Repository</CardTitle>
            <CardDescription>Official Blinker project source.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 rounded-md bg-muted p-3">
              <span className="text-muted-foreground">Original repository</span>
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href="https://github.com/BlinkCodeOrg/Blinker"
                rel="noreferrer"
                target="_blank"
              >
                https://github.com/BlinkCodeOrg/Blinker
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function App() {
  return (
    <>
      <title>Blinker URLs</title>
      <Page />
    </>
  );
}
export default App;
