export type BangEntry = {
  /** category */
  c?: string;
  /** subcategory */
  sc?: string;
  /** domain */
  d: string;
  /** relevance */
  r: number;
  /** display name / site name */
  s: string;
  /** bang trigger text */
  t: string;
  /** search url template, with {{{s}}} replaced with the search query */
  u: string;
};

let bangs: BangEntry[] | undefined;
let bangsPromise: Promise<BangEntry[]> | undefined;
let bangsByTrigger: Map<string, BangEntry> | undefined;

function setBangs(entries: BangEntry[]) {
  bangs = entries;
  bangsByTrigger = new Map(entries.map((entry) => [entry.t.toLowerCase(), entry]));
}

async function preloadBangs(): Promise<BangEntry[]> {
  if (bangs) return bangs;
  const bangsModule = (await import("./bangs")) as unknown as { bangs: BangEntry[] };
  setBangs(bangsModule.bangs);
  return bangsModule.bangs;
}

function ensureBangsLoading() {
  if (bangs) return Promise.resolve(bangs);
  if (!bangsPromise) {
    bangsPromise = preloadBangs().finally(() => {
      bangsPromise = undefined;
    });
  }
  return bangsPromise;
}

export async function waitForBangsLoad() {
  if (bangs) return bangs;
  return await ensureBangsLoading();
}

export function getBangs() {
  if (bangs) return bangs;
  void ensureBangsLoading();
  return [];
}

export function getBangByTrigger(trigger: string): BangEntry | undefined {
  if (!bangsByTrigger) {
    void ensureBangsLoading();
    return undefined;
  }

  return bangsByTrigger.get(trigger.toLowerCase());
}

function preloadBangsWhenIdle() {
  if (typeof window === "undefined") return;

  const preload = () => {
    void ensureBangsLoading();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload, { timeout: 4000 });
    return;
  }

  globalThis.setTimeout(preload, 2000);
}

preloadBangsWhenIdle();
