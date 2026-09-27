import manifest from '@/lib/games/arena/assets.json';

/**
 * Arena's downloads: high-resolution textures, the GLB models and the card
 * portraits. The first visit fetches everything with byte progress and keeps
 * it in Cache Storage; later visits read it from there. Files carry content
 * hashes, so a new build simply adds new entries and the stale ones are
 * deleted here.
 */
export type Tier = 'hq' | 'lite';
export type AssetFile = { path: string; bytes: number };
type TextureSet = {
  albedo: { hq: AssetFile; lite: AssetFile };
  normal: AssetFile;
  orm: AssetFile;
};
export type ArenaManifest = {
  textures: Record<string, TextureSet>;
  models: Record<string, AssetFile>;
  cards: Record<string, AssetFile>;
};
export const arenaManifest = manifest as ArenaManifest;

const CACHE = 'gamehub-arena';

/** Every file one tier needs, textures first so the ground can appear. */
export function filesFor(tier: Tier): AssetFile[] {
  const out: AssetFile[] = [];
  for (const set of Object.values(arenaManifest.textures))
    out.push(set.albedo[tier], set.normal, set.orm);
  out.push(...Object.values(arenaManifest.models));
  out.push(...Object.values(arenaManifest.cards));
  return out;
}

export const totalBytes = (files: AssetFile[]) =>
  files.reduce((sum, f) => sum + f.bytes, 0);

async function openCache() {
  try {
    if (typeof caches === 'undefined') return null;
    return await caches.open(CACHE);
  } catch {
    return null;
  }
}

async function fetchWithProgress(
  path: string,
  onBytes: (n: number) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  if (!response.body) {
    const blob = await response.blob();
    onBytes(blob.size);
    return { blob, type: response.headers.get('Content-Type') ?? '' };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.byteLength);
  }
  return {
    blob: new Blob(chunks as BlobPart[], {
      type: response.headers.get('Content-Type') ?? '',
    }),
    type: response.headers.get('Content-Type') ?? '',
  };
}

export type Progress = { loaded: number; total: number; cached: boolean };

/** Downloads in progress, shared by the background prefetch and the game. */
const inflight = new Map<string, Promise<Blob>>();

function getFile(
  cache: Cache | null,
  file: AssetFile,
  onBytes: (n: number, fromCache: boolean) => void,
  signal?: AbortSignal,
) {
  const running = inflight.get(file.path);
  if (running)
    return running.then((blob) => {
      onBytes(file.bytes, false);
      return blob;
    });
  const job = (async () => {
    const hit = cache ? await cache.match(file.path).catch(() => null) : null;
    if (hit) {
      const blob = await hit.blob();
      onBytes(file.bytes, true);
      return blob;
    }
    let counted = 0;
    const { blob, type } = await fetchWithProgress(
      file.path,
      (n) => {
        counted += n;
        onBytes(n, false);
      },
      signal,
    );
    // Files may be compressed in transit; settle on the listed size.
    onBytes(file.bytes - counted, false);
    if (cache)
      await cache
        .put(
          file.path,
          new Response(blob, {
            headers: { 'Content-Type': type || blob.type },
          }),
        )
        .catch(() => {});
    return blob;
  })();
  inflight.set(file.path, job);
  job.then(
    () => inflight.delete(file.path),
    () => inflight.delete(file.path),
  );
  return job;
}

/** Load every file, reporting bytes as they arrive. Returns blobs by path. */
export async function loadFiles(
  files: AssetFile[],
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
) {
  const cache = await openCache();
  const total = totalBytes(files);
  let loaded = 0;
  let fromCache = 0;
  const blobs = new Map<string, Blob>();
  // A few downloads at a time keeps progress smooth on slow links.
  const queue = [...files];
  async function worker() {
    for (let file = queue.shift(); file; file = queue.shift()) {
      signal?.throwIfAborted();
      const blob = await getFile(
        cache,
        file,
        (n, hit) => {
          loaded += n;
          if (hit) fromCache++;
          onProgress({ loaded, total, cached: fromCache === files.length });
        },
        signal,
      );
      blobs.set(file.path, blob);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (cache) void prune(cache);
  return blobs;
}

/** Drop cached files that no current build refers to. */
async function prune(cache: Cache) {
  try {
    const keep = new Set(
      [...filesFor('hq'), ...filesFor('lite')].map((f) => f.path),
    );
    for (const request of await cache.keys()) {
      const path = new URL(request.url).pathname;
      if (!keep.has(path)) await cache.delete(request);
    }
  } catch {
    // Pruning is housekeeping only.
  }
}

/** Whether everything for a tier is already on this device. */
export async function isCached(tier: Tier) {
  const cache = await openCache();
  if (!cache) return false;
  for (const f of filesFor(tier))
    if (!(await cache.match(f.path).catch(() => null))) return false;
  return true;
}

/** Warm the cache in the background (from the setup box) without blocking. */
let warming: Promise<unknown> | null = null;
export function prefetch(tier: Tier) {
  warming ??= loadFiles(filesFor(tier), () => {}).catch(() => {
    warming = null;
  });
  return warming;
}
