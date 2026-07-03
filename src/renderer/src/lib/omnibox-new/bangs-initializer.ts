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

const bangsDataUrl = new URL("./bangs.json", import.meta.url).href;

function setBangs(entries: BangEntry[]) {
  bangs = entries;
  bangsByTrigger = new Map(entries.map((entry) => [entry.t.toLowerCase(), entry]));
}

async function preloadBangs(): Promise<BangEntry[]> {
  if (bangs) return bangs;
  const response = await fetch(bangsDataUrl);
  if (!response.ok) {
    throw new Error(`Failed to load bangs: ${response.status} ${response.statusText}`);
  }

  const entries = (await response.json()) as BangEntry[];
  setBangs(entries);
  return entries;
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
  return bangs ?? [];
}

export function getBangByTrigger(trigger: string): BangEntry | undefined {
  if (!bangsByTrigger) {
    return undefined;
  }

  return bangsByTrigger.get(trigger.toLowerCase());
}

export async function waitForBangByTrigger(trigger: string): Promise<BangEntry | undefined> {
  const loadedBangs = await ensureBangsLoading();
  if (!bangsByTrigger) {
    setBangs(loadedBangs);
  }

  return bangsByTrigger?.get(trigger.toLowerCase());
}
