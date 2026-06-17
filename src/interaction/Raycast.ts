import { isSolidAt, type BlockSource } from '../world/BlockSource';

export interface RayHit {
  /** Solid voxel that was hit. */
  x: number;
  y: number;
  z: number;
  /** Face normal pointing back toward the ray origin (place target = voxel + normal). */
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Amanatides & Woo voxel traversal: march a ray through the grid one cell at a
 * time and return the first solid voxel plus the face it was entered through.
 */
export function raycastVoxel(
  src: BlockSource,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): RayHit | null {
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX =
    dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) / Math.abs(dx) : Infinity;
  let tMaxY =
    dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) / Math.abs(dy) : Infinity;
  let tMaxZ =
    dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) / Math.abs(dz) : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // Camera should be in air; if it starts inside a solid, report no usable hit.
  if (isSolidAt(src, x, y, z)) return null;

  while (t <= maxDist) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if (t > maxDist) break;
    if (isSolidAt(src, x, y, z)) {
      return { x, y, z, nx, ny, nz };
    }
  }
  return null;
}
