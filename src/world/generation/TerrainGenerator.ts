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

  constructor(seed: string | number) {
    this.seed = seed;
    this.heightNoise = new Noise(seed, 'height');
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
      }
    }
    chunk.generated = true;
    chunk.dirty = true;
  }
}
