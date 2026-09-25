export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const DEV_SESSION = 'gamehub.dev-session.v1';
/** Development only: a tab opened as an extra test player carries its own
 *  guest session, because every localhost tab shares the one cookie. */
export function devSession(): string | null {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined')
    return null;
  try {
    const fromLink = /#dev-session=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (fromLink) {
      sessionStorage.setItem(DEV_SESSION, fromLink[1]);
      history.replaceState(null, '', window.location.pathname);
    }
    return sessionStorage.getItem(DEV_SESSION);
  } catch {
    return null;
  }
}
/** Appends the tab's dev session to URLs that cannot carry headers (SSE). */
export function withDevSession(path: string) {
  const dev = devSession();
  return dev ? `${path}?dev_session=${dev}` : path;
}
export async function api<T>(path: string, input?: unknown): Promise<T> {
  const dev = devSession();
  const response = await fetch(path, {
    method: input === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(dev ? { 'X-Gamehub-Dev-Session': dev } : {}),
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const value = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new ApiError(response.status, value.error ?? 'Request failed.');
  return value as T;
}
export function rememberedName() {
  try {
    return localStorage.getItem('gamehub.guest-name.v1') ?? '';
  } catch {
    return '';
  }
}
export function rememberName(name: string) {
  try {
    localStorage.setItem('gamehub.guest-name.v1', name);
  } catch {
    /* Optional device preference. */
  }
}

export function requestId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
    n.toString(16).padStart(8, '0'),
  ).join('');
}
const joins = new Map<string, Promise<unknown>>();
export function joinTable<T>(invite: string, name: string): Promise<T> {
  const existing = joins.get(invite);
  if (existing) return existing as Promise<T>;
  const promise = api<T>(`/api/tables/${invite}/join`, {
    name: name || undefined,
  }).finally(() => joins.delete(invite));
  joins.set(invite, promise);
  return promise;
}

/** Where Folio and Relic go back to: the table that sent the players there,
 *  otherwise home. A removed table sends its link home in turn. */
export function returnPath() {
  try {
    return sessionStorage.getItem('gamehub.return-table') ?? '/';
  } catch {
    return '/';
  }
}
