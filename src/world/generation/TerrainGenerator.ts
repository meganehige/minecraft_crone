import { Config } from '../../core/Config';
import { Chunk } from '../Chunk';
import { BlockId } from '../blocks/BlockType';
import { Noise } from './Noise';

const SIZE = Config.CHUNK_SIZE;

/**
 * Deterministic terrain from a seed: a smooth fBm height field with grass/dirt/
 * stone columns, a beach band near sea level, and water filling up to sea level.
 */
export class TerrainGenerator {
  readonly seed: string | number;
  readonly seaLevel = 30;

  private readonly base = 34;
  private readonly amplitude = 18;
  private readonly heightNoise: Noise;
  private readonly seedNum: number;

  constructor(seed: string | number) {
    this.seed = seed;
    this.heightNoise = new Noise(seed, 'height');
    this.seedNum = hashSeed(seed);
  }

  /** Surface (top solid) height for a world column. Deterministic. */
  surfaceHeight(wx: number, wz: number): number {
    const n = this.heightNoise.fbm2(wx, wz, 4, 0.5, 2.0, 1 / 96);
    return Math.floor(this.base + n * this.amplitude);
  }

  generate(chunk: Chunk): void {
    const originX = chunk.cx * SIZE;
    const originZ = chunk.cz * SIZE;
    for (let lx = 0; lx < SIZE; lx++) {
      for (let lz = 0; lz < SIZE; lz++) {
        const h = this.surfaceHeight(originX + lx, originZ + lz);
        const beach = h <= this.seaLevel + 1;
        for (let y = 0; y <= h; y++) {
          let id: BlockId;
          if (y === h) id = beach ? BlockId.Sand : BlockId.Grass;
          else if (y >= h - 3) id = beach ? BlockId.Sand : BlockId.Dirt;
          else id = BlockId.Stone;
          chunk.setBlock(lx, y, lz, id);
        }
        // Fill water up to sea level over submerged columns.
        for (let y = h + 1; y <= this.seaLevel; y++) {
          chunk.setBlock(lx, y, lz, BlockId.Water);
        }

        this.maybePlantTree(chunk, lx, lz, h);
      }
    }
    chunk.generated = true;
    chunk.dirty = true;
  }

  /** Deterministic per-column hash in [0, 1). */
  private hash(wx: number, wz: number, salt: number): number {
    let n = (Math.imul(wx, 73856093) ^ Math.imul(wz, 19349663) ^
      Math.imul(salt, 83492791) ^ this.seedNum) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * Plant a tree (wood trunk + leaf canopy) on eligible grass columns. Restricted
   * to columns at least 2 blocks from the chunk edge so the canopy stays within
   * the chunk (no cross-chunk writes needed for v1).
   */
  private maybePlantTree(
    chunk: Chunk,
    lx: number,
    lz: number,
    h: number,
  ): void {
    if (lx < 2 || lx > SIZE - 3 || lz < 2 || lz > SIZE - 3) return;
    if (h <= this.seaLevel + 1) return; // not on beaches/underwater
    if (chunk.getBlock(lx, h, lz) !== BlockId.Grass) return;

    const wx = chunk.cx * SIZE + lx;
    const wz = chunk.cz * SIZE + lz;
    if (this.hash(wx, wz, 1) > 1 / 70) return;

    const trunk = 4 + Math.floor(this.hash(wx, wz, 2) * 3); // 4..6
    const top = h + trunk;
    for (let y = h + 1; y <= top; y++) {
      chunk.setBlock(lx, y, lz, BlockId.Wood);
    }
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const r = dx * dx + dz * dz + (dy > 0 ? dy * dy : 0);
          if (r > 5) continue;
          const ly = top + dy;
          if (chunk.getBlock(lx + dx, ly, lz + dz) === BlockId.Air) {
            chunk.setBlock(lx + dx, ly, lz + dz, BlockId.Leaves);
          }
        }
      }
    }
  }
}

/** Hash an arbitrary seed to a 32-bit int. */
function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
