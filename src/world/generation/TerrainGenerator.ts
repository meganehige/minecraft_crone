import { Config } from '../../core/Config';
import { Chunk } from '../Chunk';
import { BlockId } from '../blocks/BlockType';
import { Noise } from './Noise';

const SIZE = Config.CHUNK_SIZE;

/**
 * Ore veins: how many seed points to try per chunk, the blob size grown from
 * each, and the depth band the ore is found in. Rarer, more valuable ores sit
 * deeper and spawn in smaller, fewer veins.
 */
interface OreSpec {
  id: BlockId;
  attempts: number;
  size: number;
  minY: number;
  maxY: number;
}

const ORES: OreSpec[] = [
  { id: BlockId.CoalOre, attempts: 12, size: 10, minY: 6, maxY: 52 },
  { id: BlockId.IronOre, attempts: 9, size: 7, minY: 5, maxY: 40 },
  { id: BlockId.GoldOre, attempts: 3, size: 5, minY: 4, maxY: 28 },
  { id: BlockId.DiamondOre, attempts: 2, size: 4, minY: 2, maxY: 15 },
];

/** Carve a cell when both cave noise fields are near zero (see isCave). */
const CAVE_THRESHOLD = 0.022;
/** Keep this many solid blocks under the surface so caves never break through. */
const CAVE_SURFACE_MARGIN = 5;
/** Lowest carvable level: y=0 is bedrock, y=1 stays as its floor. */
const CAVE_MIN_Y = 2;

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
  private readonly caveA: Noise;
  private readonly caveB: Noise;
  private readonly seedNum: number;

  constructor(seed: string | number) {
    this.seed = seed;
    this.heightNoise = new Noise(seed, 'height');
    this.caveA = new Noise(seed, 'caveA');
    this.caveB = new Noise(seed, 'caveB');
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
          if (y === 0) id = BlockId.Bedrock; // unbreakable world floor
          else if (y === h) id = beach ? BlockId.Sand : BlockId.Grass;
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

    // Ores first so caves can later cut through a vein and expose it, the way
    // you find ore in a cave wall rather than only by digging blind.
    this.scatterOres(chunk);
    this.carveCaves(chunk);

    chunk.generated = true;
    chunk.dirty = true;
  }

  /**
   * Hollow out cave systems. Two independent 3D noise fields are sampled and a
   * cell is carved where BOTH are close to zero: the intersection of two
   * iso-surfaces is a curve, so this traces winding tunnels instead of the
   * round blobs a single threshold would give. Y is sampled at a lower
   * frequency than X/Z so tunnels run mostly horizontally.
   */
  private carveCaves(chunk: Chunk): void {
    const originX = chunk.cx * SIZE;
    const originZ = chunk.cz * SIZE;
    for (let lx = 0; lx < SIZE; lx++) {
      for (let lz = 0; lz < SIZE; lz++) {
        const wx = originX + lx;
        const wz = originZ + lz;
        const top = this.surfaceHeight(wx, wz) - CAVE_SURFACE_MARGIN;
        for (let y = CAVE_MIN_Y; y <= top; y++) {
          const cur = chunk.getBlock(lx, y, lz);
          if (cur === BlockId.Air || cur === BlockId.Bedrock) continue;
          if (this.isCave(wx, y, wz)) chunk.setBlock(lx, y, lz, BlockId.Air);
        }
      }
    }
  }

  /** True where the two cave fields both pass near zero. Deterministic. */
  private isCave(wx: number, y: number, wz: number): boolean {
    const fxz = 1 / 30;
    const fy = 1 / 18; // squashed: wider tunnels than they are tall
    const a = this.caveA.sample3(wx * fxz, y * fy, wz * fxz);
    const b = this.caveB.sample3(wx * fxz, y * fy, wz * fxz);
    return a * a + b * b < CAVE_THRESHOLD;
  }

  /**
   * Seed ore veins in the chunk. Each attempt picks a deterministic start cell
   * inside the ore's depth band and grows a small blob from it by random walk,
   * only ever replacing stone.
   */
  private scatterOres(chunk: Chunk): void {
    const originX = chunk.cx * SIZE;
    const originZ = chunk.cz * SIZE;
    for (let o = 0; o < ORES.length; o++) {
      const spec = ORES[o]!;
      for (let i = 0; i < spec.attempts; i++) {
        const salt = 1000 + o * 97 + i * 7;
        let lx = Math.floor(this.hash(originX, originZ, salt) * SIZE);
        let lz = Math.floor(this.hash(originX, originZ, salt + 1) * SIZE);
        const span = spec.maxY - spec.minY + 1;
        let y = spec.minY + Math.floor(this.hash(originX, originZ, salt + 2) * span);

        for (let n = 0; n < spec.size; n++) {
          if (chunk.getBlock(lx, y, lz) === BlockId.Stone) {
            chunk.setBlock(lx, y, lz, spec.id);
          }
          // Step one cell along a deterministically chosen axis.
          const r = this.hash(originX + n, originZ + i, salt + 3);
          const dir = Math.floor(r * 6);
          if (dir === 0) lx += 1;
          else if (dir === 1) lx -= 1;
          else if (dir === 2) lz += 1;
          else if (dir === 3) lz -= 1;
          else if (dir === 4) y += 1;
          else y -= 1;
          lx = Math.max(0, Math.min(SIZE - 1, lx));
          lz = Math.max(0, Math.min(SIZE - 1, lz));
          y = Math.max(spec.minY, Math.min(spec.maxY, y));
        }
      }
    }
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
