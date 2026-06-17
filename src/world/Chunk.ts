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

  /** Needs a remesh. */
  dirty = true;
  generated = false;

  mesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(VOLUME);
  }

  getBlock(lx: number, ly: number, lz: number): BlockId {
    if (!inChunkBounds(lx, ly, lz)) return BlockId.Air;
    return this.blocks[blockIndex(lx, ly, lz)] as BlockId;
  }

  setBlock(lx: number, ly: number, lz: number, id: BlockId): void {
    if (!inChunkBounds(lx, ly, lz)) return;
    this.blocks[blockIndex(lx, ly, lz)] = id;
    this.dirty = true;
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.transparentMesh?.geometry.dispose();
    this.mesh = null;
    this.transparentMesh = null;
  }
}
