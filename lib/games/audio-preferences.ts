export const VOLUME_KEY = 'gamehub.volume.v3';

/** Development starts silent; a sound choice belongs to this tab's session. */
export function defaultAudioLevel(level: number) {
  return process.env.NODE_ENV === 'development' ? 0 : level;
}

function storage() {
  return process.env.NODE_ENV === 'development' ? sessionStorage : localStorage;
}

export function readAudioLevel(key = VOLUME_KEY, fallback = 0.5) {
  const defaultLevel = defaultAudioLevel(fallback);
  try {
    const level = Number(storage().getItem(key) ?? defaultLevel);
    return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : defaultLevel;
  } catch {
    return defaultLevel;
  }
}

export function saveAudioLevel(level: number, key = VOLUME_KEY) {
  try {
    storage().setItem(key, String(level));
  } catch {
    /* Sound still works when storage is unavailable. */
  }
}

/** Lucky keeps its existing boolean preference in production. */
export function readAudioMuted(key: string) {
  try {
    const saved = storage().getItem(key);
    if (saved === 'true' || saved === 'false') return saved === 'true';
    return process.env.NODE_ENV === 'development';
  } catch {
    return process.env.NODE_ENV === 'development';
  }
}

export function saveAudioMuted(muted: boolean, key: string) {
  try {
    storage().setItem(key, String(muted));
  } catch {
    /* Sound still works when storage is unavailable. */
  }
}
