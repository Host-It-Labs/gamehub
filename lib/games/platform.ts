/** Web adapter; replace orientation/fullscreen methods with native APIs in Tauri later. */
export async function enterGame() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* iOS and embedded browsers may not support fullscreen. */
  }
  try {
    await (
      screen.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      }
    ).lock?.('landscape');
  } catch {
    /* The rotate prompt handles unsupported web orientation locking. */
  }
}
export async function leaveGame() {
  try {
    screen.orientation?.unlock();
  } catch {
    /* Optional platform API. */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* Optional platform API. */
  }
}
