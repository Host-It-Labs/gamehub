export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: input === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers:
      input === undefined ? undefined : { 'Content-Type': 'application/json' },
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
