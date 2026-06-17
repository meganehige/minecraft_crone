import * as THREE from 'three';
import { Config } from '../core/Config';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import { BlockId } from '../world/blocks/BlockType';
import { tileUVRect } from './atlas';

const SIZE = Config.CHUNK_SIZE;
const HEIGHT = Config.CHUNK_HEIGHT;

interface FaceDef {
  /** Neighbour offset to test for occlusion. */
  dir: readonly [number, number, number];
  /** 4 corner offsets, CCW as seen from outside. */
  corners: ReadonlyArray<readonly [number, number, number]>;
  normal: readonly [number, number, number];
  /** Which tile group to sample. */
  tile: 'top' | 'bottom' | 'side';
}

const FACES: readonly FaceDef[] = [
  {
    dir: [0, 1, 0],
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    normal: [0, 1, 0],
    tile: 'top',
  },
  {
    dir: [0, -1, 0],
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    normal: [0, -1, 0],
    tile: 'bottom',
  },
  {
    dir: [0, 0, -1],
    corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    normal: [0, 0, -1],
    tile: 'side',
  },
  {
    dir: [0, 0, 1],
    corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    normal: [0, 0, 1],
    tile: 'side',
  },
  {
    dir: [-1, 0, 0],
    corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    normal: [-1, 0, 0],
    tile: 'side',
  },
  {
    dir: [1, 0, 0],
    corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    normal: [1, 0, 0],
    tile: 'side',
  },
];

export type BlockGetter = (lx: number, ly: number, lz: number) => BlockId;
export type LightGetter = (lx: number, ly: number, lz: number) => number;

const MAX_LIGHT = Config.MAX_LIGHT;
const MIN_BRIGHTNESS = 0.08;

/** Fixed per-face shading (top brightest, bottom darkest) for depth cues. */
function faceShade(normalY: number): number {
  if (normalY > 0) return 1.0;
  if (normalY < 0) return 0.5;
  return 0.8;
}

/** Combine a 0..15 light level with face shading into a 0..1 brightness. */
function brightness(light: number, normalY: number): number {
  const l = MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * (light / MAX_LIGHT);
  return l * faceShade(normalY);
}

export interface MeshResult {
  opaque: THREE.BufferGeometry | null;
  transparent: THREE.BufferGeometry | null;
  stats: { faces: number; solidBlocks: number };
}

/** Should the face between `self` and `neighbour` be emitted? */
function shouldRenderFace(self: BlockId, neighbour: BlockId): boolean {
  if (neighbour === BlockId.Air) return true;
  if (!BlockRegistry.isTransparent(neighbour)) return false;
  // Neighbour is transparent: cull shared faces between same transparent type.
  if (neighbour === self) return false;
  return true;
}

interface Buffers {
  pos: number[];
  norm: number[];
  uv: number[];
  color: number[];
  idx: number[];
  vcount: number;
}

function emptyBuffers(): Buffers {
  return { pos: [], norm: [], uv: [], color: [], idx: [], vcount: 0 };
}

function tileFor(id: BlockId, group: 'top' | 'bottom' | 'side'): number {
  return BlockRegistry.get(id).tiles[group];
}

function pushFace(
  b: Buffers,
  face: FaceDef,
  x: number,
  y: number,
  z: number,
  tileIndex: number,
  light: number,
): void {
  const [u0, v0, u1, v1] = tileUVRect(tileIndex);
  const uvCorners: ReadonlyArray<readonly [number, number]> = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const bri = brightness(light, face.normal[1]);
  for (let i = 0; i < 4; i++) {
    const c = face.corners[i]!;
    b.pos.push(x + c[0], y + c[1], z + c[2]);
    b.norm.push(face.normal[0], face.normal[1], face.normal[2]);
    const uv = uvCorners[i]!;
    b.uv.push(uv[0], uv[1]);
    b.color.push(bri, bri, bri);
  }
  const o = b.vcount;
  b.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  b.vcount += 4;
}

function toGeometry(b: Buffers): THREE.BufferGeometry | null {
  if (b.vcount === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Build opaque + transparent geometry for a chunk, emitting only faces that
 * border air or a different transparent block (hidden-face culling).
 *
 * `getBlock` may be queried outside [0,SIZE)/[0,HEIGHT) so neighbouring chunks
 * can suppress boundary faces; out-of-world reads should return Air.
 */
export function buildChunkMesh(
  getBlock: BlockGetter,
  getLight: LightGetter,
): MeshResult {
  const opaque = emptyBuffers();
  const transparent = emptyBuffers();
  let faces = 0;
  let solidBlocks = 0;

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < SIZE; z++) {
      for (let x = 0; x < SIZE; x++) {
        const id = getBlock(x, y, z);
        if (id === BlockId.Air) continue;
        solidBlocks++;
        const layer = BlockRegistry.get(id).renderLayer;
        const buffers = layer === 'transparent' ? transparent : opaque;
        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          const nb = getBlock(nx, ny, nz);
          if (!shouldRenderFace(id, nb)) continue;
          // Sample light from the (visible) neighbour cell the face opens into.
          const light = getLight(nx, ny, nz);
          pushFace(buffers, face, x, y, z, tileFor(id, face.tile), light);
          faces++;
        }
      }
    }
  }

  return {
    opaque: toGeometry(opaque),
    transparent: toGeometry(transparent),
    stats: { faces, solidBlocks },
  };
}
