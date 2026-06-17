import { chunkKey, worldToChunk } from '../math/coords';
import type { World } from './World';

const RENDER_DISTANCE = 4;
const UNLOAD_MARGIN = 2;
const GEN_BUDGET = 2;
const MESH_BUDGET = 2;

/**
 * Schedules chunk generation and meshing around the player with a per-frame
 * budget so work is spread across frames instead of hitching. Nearest chunks
 * are prioritised.
 */
export class ChunkManager {
  private pcx = Number.NaN;
  private pcz = Number.NaN;

  constructor(private readonly world: World) {}

  /** Recompute the desired loaded set when the player crosses a chunk border. */
  update(playerX: number, playerZ: number): void {
    const cx = worldToChunk(playerX);
    const cz = worldToChunk(playerZ);
    if (cx === this.pcx && cz === this.pcz) return;
    this.pcx = cx;
    this.pcz = cz;

    // Ensure chunk records exist within render distance.
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        this.world.ensureChunk(cx + dx, cz + dz);
      }
    }

    // Unload chunks beyond the margin.
    const maxDist = RENDER_DISTANCE + UNLOAD_MARGIN;
    for (const chunk of [...this.world.chunks.values()]) {
      if (
        Math.abs(chunk.cx - cx) > maxDist ||
        Math.abs(chunk.cz - cz) > maxDist
      ) {
        this.world.removeChunk(chunk.cx, chunk.cz);
      }
    }
  }

  /** Do up to a frame's worth of generation + meshing, nearest first. */
  processQueues(): void {
    if (Number.isNaN(this.pcx)) return;

    const ungenerated = [];
    const dirty = [];
    for (const chunk of this.world.chunks.values()) {
      if (Math.abs(chunk.cx - this.pcx) > RENDER_DISTANCE) continue;
      if (Math.abs(chunk.cz - this.pcz) > RENDER_DISTANCE) continue;
      if (!chunk.generated) ungenerated.push(chunk);
      else if (chunk.dirty) dirty.push(chunk);
    }

    const dist = (c: { cx: number; cz: number }) =>
      Math.abs(c.cx - this.pcx) + Math.abs(c.cz - this.pcz);
    ungenerated.sort((a, b) => dist(a) - dist(b));
    dirty.sort((a, b) => dist(a) - dist(b));

    for (let i = 0; i < GEN_BUDGET && i < ungenerated.length; i++) {
      this.world.generateChunk(ungenerated[i]!);
    }
    for (let i = 0; i < MESH_BUDGET && i < dirty.length; i++) {
      this.world.meshChunk(dirty[i]!);
    }
  }

  /** Are all in-range chunks generated and meshed? Useful for tests. */
  isSettled(): boolean {
    if (Number.isNaN(this.pcx)) return false;
    for (const chunk of this.world.chunks.values()) {
      if (Math.abs(chunk.cx - this.pcx) > RENDER_DISTANCE) continue;
      if (Math.abs(chunk.cz - this.pcz) > RENDER_DISTANCE) continue;
      if (!chunk.generated || chunk.dirty) return false;
    }
    return true;
  }

  hasKey(cx: number, cz: number): boolean {
    return this.world.chunks.has(chunkKey(cx, cz));
  }
}
