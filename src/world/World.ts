import * as THREE from 'three';
import { Config } from '../core/Config';
import { chunkKey, worldToChunk, worldToLocal } from '../math/coords';
import { buildChunkMesh } from '../render/ChunkMesher';
import { getMaterials } from '../render/materials';
import { Chunk, blockIndex as localIndex } from './Chunk';
import { BlockId } from './blocks/BlockType';
import type { BlockSource } from './BlockSource';
import { TerrainGenerator } from './generation/TerrainGenerator';
import { LightEngine } from '../lighting/LightEngine';
import type { SaveManager } from '../persistence/SaveManager';

const MAX_LIGHT = Config.MAX_LIGHT;

const SIZE = Config.CHUNK_SIZE;
const HEIGHT = Config.CHUNK_HEIGHT;

/**
 * The voxel world: a hash map of chunks plus the scene meshes. Implements
 * BlockSource so physics/raycasts query it in world coordinates. Generation and
 * meshing are driven externally (ChunkManager) so they can be budgeted.
 */
export class World implements BlockSource {
  readonly chunks = new Map<string, Chunk>();
  readonly generator: TerrainGenerator;

  /** Stats from the most recent mesh build (exposed for debugging/tests). */
  lastMeshStats: { faces: number; solidBlocks: number } = {
    faces: 0,
    solidBlocks: 0,
  };

  /** Notified after any setBlock (used by fluid/gravity simulators). */
  onBlockChange?: (x: number, y: number, z: number) => void;

  constructor(
    private readonly scene: THREE.Scene,
    seed: string | number,
    private readonly save?: SaveManager,
  ) {
    this.generator = new TerrainGenerator(seed);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** Create the chunk record if absent (not yet generated). */
  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= HEIGHT) return BlockId.Air;
    const chunk = this.getChunk(worldToChunk(wx), worldToChunk(wz));
    if (!chunk || !chunk.generated) return BlockId.Air;
    return chunk.getBlock(worldToLocal(wx), wy, worldToLocal(wz));
  }

  getSkyLight(wx: number, wy: number, wz: number): number {
    if (wy >= HEIGHT) return MAX_LIGHT;
    if (wy < 0) return 0;
    const chunk = this.getChunk(worldToChunk(wx), worldToChunk(wz));
    // Unloaded/ungenerated columns are treated as open sky.
    if (!chunk || !chunk.generated) return MAX_LIGHT;
    const i = localIndex(worldToLocal(wx), wy, worldToLocal(wz));
    return chunk.skyLight[i]!;
  }

  getBlockLight(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= HEIGHT) return 0;
    const chunk = this.getChunk(worldToChunk(wx), worldToChunk(wz));
    if (!chunk || !chunk.generated) return 0;
    const i = localIndex(worldToLocal(wx), wy, worldToLocal(wz));
    return chunk.blockLight[i]!;
  }

  getLight(wx: number, wy: number, wz: number): number {
    return Math.max(
      this.getSkyLight(wx, wy, wz),
      this.getBlockLight(wx, wy, wz),
    );
  }

  setBlock(wx: number, wy: number, wz: number, id: BlockId, record = true): void {
    if (wy < 0 || wy >= HEIGHT) return;
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return;
    const lx = worldToLocal(wx);
    const lz = worldToLocal(wz);
    chunk.setBlock(lx, wy, lz, id);
    // Derived changes (fluid flow, falling blocks) are not persisted as edits.
    if (record) this.save?.recordEdit(cx, cz, localIndex(lx, wy, lz), id);
    // Border edits affect the neighbouring chunk's boundary faces.
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === SIZE - 1) this.markDirty(cx, cz + 1);
    this.onBlockChange?.(wx, wy, wz);
  }

  private markDirty(cx: number, cz: number): void {
    const c = this.getChunk(cx, cz);
    if (c && c.generated) c.dirty = true;
  }

  generateChunk(chunk: Chunk): void {
    this.generator.generate(chunk);
    // Overlay persisted player edits on top of the deterministic baseline.
    this.save?.applyEdits(chunk);
    // Neighbours can now cull faces against us; remesh them.
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      this.markDirty(chunk.cx + dx, chunk.cz + dz);
    }
  }

  meshChunk(chunk: Chunk): void {
    const materials = getMaterials();
    const originX = chunk.cx * SIZE;
    const originZ = chunk.cz * SIZE;

    LightEngine.computeChunkLight(this, chunk);

    const result = buildChunkMesh(
      (lx, ly, lz) => this.getBlock(originX + lx, ly, originZ + lz),
      (lx, ly, lz) => this.getLight(originX + lx, ly, originZ + lz),
    );

    this.swapMesh(chunk, 'mesh', result.opaque, materials.opaque, originX, originZ);
    this.swapMesh(
      chunk,
      'transparentMesh',
      result.transparent,
      materials.transparent,
      originX,
      originZ,
    );
    this.lastMeshStats = result.stats;
    chunk.dirty = false;
  }

  private swapMesh(
    chunk: Chunk,
    slot: 'mesh' | 'transparentMesh',
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material,
    originX: number,
    originZ: number,
  ): void {
    const existing = chunk[slot];
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      chunk[slot] = null;
    }
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(originX, 0, originZ);
      this.scene.add(mesh);
      chunk[slot] = mesh;
    }
  }

  removeChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    if (chunk.mesh) this.scene.remove(chunk.mesh);
    if (chunk.transparentMesh) this.scene.remove(chunk.transparentMesh);
    chunk.dispose();
    this.chunks.delete(key);
  }

  get loadedCount(): number {
    return this.chunks.size;
  }
}
