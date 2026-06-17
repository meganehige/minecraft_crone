/**
 * Test/debug API exposed on `window.__game`.
 *
 * Playwright play-tests run in headless Chromium where pointer lock and real
 * input are awkward, so the game publishes a programmatic surface here. Each
 * sprint extends this object (input injection, player state, block get/set,
 * world/seed inspection, ...). Keeping it in one place makes the test contract
 * explicit.
 */
export interface GameDebugApi {
  /** True once the renderer is up and the first frame has been drawn. */
  ready: boolean;
  /** WebGL context version string, or null if unavailable. */
  webglVersion: string | null;
  /** Frames rendered so far (sanity signal that the render loop is alive). */
  frameCount: number;
}

declare global {
  interface Window {
    __game: GameDebugApi;
  }
}

export function installDebugApi(api: GameDebugApi): GameDebugApi {
  window.__game = api;
  return api;
}
