import * as THREE from 'three';
import { Config } from '../core/Config';
import { BlockId } from './blocks/BlockType';

const SIZE = Config.CHUNK_SIZE;
const HEIGHT = Config.CHUNK_HEIGHT;
const VOLUME = SIZE * SIZE * HEIGHT;

/** Y-major flat index: contiguous in X, then Z, then Y. */
export function blockIndex(lx: number, ly: number, lz: number): number {
  return (ly * SIZE + lz) * SIZE + lx;
}

export function inChunkBounds(lx: number, ly: number, lz: number): boolean {
  return (
    lx >= 0 &&
    lx < SIZE &&
    lz >= 0 &&
    lz < SIZE &&
    ly >= 0 &&
    ly < HEIGHT
  );
}

/**
 * A 16 x 16 x HEIGHT column of voxels. Blocks are a flat Uint8Array of BlockId.
 * Light arrays and mesh handles are filled in by later sprints.
 */
export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  /** Sky light 0..15 per cell (separate from block light for clarity). */
  readonly skyLight: Uint8Array;
  /** Block light 0..15 per cell (from emitters). */
  readonly blockLight: Uint8Array;
  /** True once LightEngine has populated the light arrays for this state. */
  lit = false;

  /** Needs a remesh. */
  dirty = true;
  generated = false;

  mesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(VOLUME);
    this.skyLight = new Uint8Array(VOLUME);
    this.blockLight = new Uint8Array(VOLUME);
  }

  /** Combined light level (max of sky and block) at a local cell. */
  getLight(lx: number, ly: number, lz: number): number {
    if (!inChunkBounds(lx, ly, lz)) return 0;
    const i = blockIndex(lx, ly, lz);
    return Math.max(this.skyLight[i]!, this.blockLight[i]!);
  }

  getBlock(lx: number, ly: number, lz: number): BlockId {
    if (!inChunkBounds(lx, ly, lz)) return BlockId.Air;
    return this.blocks[blockIndex(lx, ly, lz)] as BlockId;
  }

  setBlock(lx: number, ly: number, lz: number, id: BlockId): void {
    if (!inChunkBounds(lx, ly, lz)) return;
    this.blocks[blockIndex(lx, ly, lz)] = id;
    this.dirty = true;
    this.lit = false;
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.transparentMesh?.geometry.dispose();
    this.mesh = null;
    this.transparentMesh = null;
  }
}
