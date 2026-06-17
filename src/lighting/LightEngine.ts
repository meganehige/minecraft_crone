import { Config } from '../core/Config';
import { blockIndex } from '../world/Chunk';
import type { Chunk } from '../world/Chunk';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import type { World } from '../world/World';

const SIZE = Config.CHUNK_SIZE;
const HEIGHT = Config.CHUNK_HEIGHT;
const MAX = Config.MAX_LIGHT;

const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Flood-fill lighting for a single chunk. Sky light is seeded from the open sky
 * straight down through transparent blocks (no attenuation downward), block
 * light from emitters; both then BFS-spread with -1 attenuation per step.
 * Incoming light from already-lit neighbouring chunks is seeded at the borders,
 * so light bleeds across chunk boundaries (re-run when neighbours change).
 */
export class LightEngine {
  static computeChunkLight(world: World, chunk: Chunk): void {
    const sky = chunk.skyLight;
    const block = chunk.blockLight;
    sky.fill(0);
    block.fill(0);

    const transparent = (lx: number, ly: number, lz: number): boolean =>
      BlockRegistry.isTransparent(chunk.getBlock(lx, ly, lz));

    const skyQueue: number[] = [];
    const blockQueue: number[] = [];

    // 1. Sky columns: open sky straight down through transparent blocks.
    for (let lx = 0; lx < SIZE; lx++) {
      for (let lz = 0; lz < SIZE; lz++) {
        for (let ly = HEIGHT - 1; ly >= 0; ly--) {
          if (!transparent(lx, ly, lz)) break;
          const i = blockIndex(lx, ly, lz);
          sky[i] = MAX;
          skyQueue.push(i);
        }
      }
    }

    // 2. Block-light emitters.
    for (let ly = 0; ly < HEIGHT; ly++) {
      for (let lz = 0; lz < SIZE; lz++) {
        for (let lx = 0; lx < SIZE; lx++) {
          const emission = BlockRegistry.getLightEmission(
            chunk.getBlock(lx, ly, lz),
          );
          if (emission > 0) {
            const i = blockIndex(lx, ly, lz);
            block[i] = emission;
            blockQueue.push(i);
          }
        }
      }
    }

    // 3. Incoming light from lit neighbours, seeded at the chunk borders.
    this.seedBorders(world, chunk, sky, block, skyQueue, blockQueue, transparent);

    this.propagate(sky, skyQueue, transparent, true);
    this.propagate(block, blockQueue, transparent, false);

    chunk.lit = true;
  }

  private static seedBorders(
    world: World,
    chunk: Chunk,
    sky: Uint8Array,
    block: Uint8Array,
    skyQueue: number[],
    blockQueue: number[],
    transparent: (x: number, y: number, z: number) => boolean,
  ): void {
    const originX = chunk.cx * SIZE;
    const originZ = chunk.cz * SIZE;
    const tryEdge = (lx: number, ly: number, lz: number, ox: number, oz: number) => {
      if (!transparent(lx, ly, lz)) return;
      const ns = world.getSkyLight(originX + lx + ox, ly, originZ + lz + oz) - 1;
      const nb = world.getBlockLight(originX + lx + ox, ly, originZ + lz + oz) - 1;
      const i = blockIndex(lx, ly, lz);
      if (ns > sky[i]!) {
        sky[i] = ns;
        skyQueue.push(i);
      }
      if (nb > block[i]!) {
        block[i] = nb;
        blockQueue.push(i);
      }
    };
    for (let ly = 0; ly < HEIGHT; ly++) {
      for (let t = 0; t < SIZE; t++) {
        tryEdge(0, ly, t, -1, 0);
        tryEdge(SIZE - 1, ly, t, 1, 0);
        tryEdge(t, ly, 0, 0, -1);
        tryEdge(t, ly, SIZE - 1, 0, 1);
      }
    }
  }

  private static propagate(
    light: Uint8Array,
    queue: number[],
    transparent: (x: number, y: number, z: number) => boolean,
    isSky: boolean,
  ): void {
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++]!;
      const level = light[idx]!;
      if (level <= 0) continue;
      const lx = idx % SIZE;
      const lz = Math.floor(idx / SIZE) % SIZE;
      const ly = Math.floor(idx / (SIZE * SIZE));
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = lx + dx;
        const ny = ly + dy;
        const nz = lz + dz;
        if (nx < 0 || nx >= SIZE || nz < 0 || nz >= SIZE) continue;
        if (ny < 0 || ny >= HEIGHT) continue;
        if (!transparent(nx, ny, nz)) continue;
        // Sunlight passes straight down without attenuation.
        const next = isSky && dy === -1 && level === MAX ? MAX : level - 1;
        const ni = blockIndex(nx, ny, nz);
        if (next > light[ni]!) {
          light[ni] = next;
          queue.push(ni);
        }
      }
    }
  }
}
