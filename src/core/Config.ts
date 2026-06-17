/**
 * Global tunables. Expanded over the course of the sprints; Sprint 0 only needs
 * rendering basics.
 */
export const Config = {
  /** Horizontal size (X and Z) of a chunk in blocks. */
  CHUNK_SIZE: 16,
  /** Vertical size of a chunk column in blocks. */
  CHUNK_HEIGHT: 128,
  /** Max light level (sky/block). */
  MAX_LIGHT: 15,

  /** Simulation tick rate (Hz). Fixed-timestep loop lands in Sprint 2. */
  TICK_RATE: 20,

  /** Sky color used as the renderer clear color / fog. */
  SKY_COLOR: 0x87ceeb,
} as const;

/** Seconds per simulation tick. */
export const TICK_DT = 1 / Config.TICK_RATE;
