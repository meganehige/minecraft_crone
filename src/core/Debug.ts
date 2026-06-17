import type { InputState } from '../player/Controls';

export interface PlayerSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  yaw: number;
  pitch: number;
}

/**
 * Test/debug API exposed on `window.__game`.
 *
 * Playwright play-tests run in headless Chromium where pointer lock and real
 * input are awkward, so the game publishes a programmatic surface here. Each
 * sprint extends this object. Keeping it in one place makes the test contract
 * explicit.
 */
export interface GameDebugApi {
  /** True once the renderer is up and the first frame has been drawn. */
  ready: boolean;
  /** WebGL context version string, or null if unavailable. */
  webglVersion: string | null;
  /** Frames rendered so far (sanity signal that the render loop is alive). */
  frameCount: number;
  /** Stats from the most recent chunk mesh build (Sprint 1+). */
  chunkStats?: { faces: number; solidBlocks: number };

  // --- Sprint 2: input / player control ---
  /** Mutable movement intent; tests set these booleans directly. */
  input?: InputState;
  /** Set look direction (radians). */
  setView?: (yaw: number, pitch: number) => void;
  /** Teleport the player to a feet-centre position and zero velocity. */
  teleport?: (x: number, y: number, z: number) => void;
  /** Read current player state. */
  getPlayer?: () => PlayerSnapshot;

  // --- Sprint 3: world / terrain ---
  /** Deterministic surface (top solid) height for a world column. */
  surfaceHeight?: (x: number, z: number) => number;
  /** World streaming info. */
  getWorldInfo?: () => {
    seed: string | number;
    loadedChunks: number;
    settled: boolean;
  };
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
