import type { Vector3 } from 'three';
import { isSolidAt, type BlockSource } from '../world/BlockSource';

const EPS = 1e-3;

/**
 * Move an axis-aligned box (player) through the voxel grid, resolving collisions
 * one axis at a time in the order Y, X, Z. The box is described by its feet-
 * centre `pos` (x/z centred, y at the feet), a horizontal half-extent and a
 * height. `vel` and `pos` are mutated in place; returns whether the box is
 * resting on the ground after the move.
 */
export function moveAndCollide(
  src: BlockSource,
  pos: Vector3,
  vel: Vector3,
  half: number,
  height: number,
  dt: number,
): boolean {
  let onGround = false;

  // --- Y axis ---
  pos.y += vel.y * dt;
  {
    const minX = pos.x - half;
    const maxX = pos.x + half;
    const minZ = pos.z - half;
    const maxZ = pos.z + half;
    if (vel.y < 0) {
      const vy = Math.floor(pos.y + EPS);
      if (anySolidXZ(src, minX, maxX, minZ, maxZ, vy)) {
        pos.y = vy + 1 + EPS;
        vel.y = 0;
        onGround = true;
      }
    } else if (vel.y > 0) {
      const vy = Math.floor(pos.y + height - EPS);
      if (anySolidXZ(src, minX, maxX, minZ, maxZ, vy)) {
        pos.y = vy - height - EPS;
        vel.y = 0;
      }
    }
  }

  // --- X axis ---
  pos.x += vel.x * dt;
  resolveHorizontal(src, pos, vel, half, height, 'x');

  // --- Z axis ---
  pos.z += vel.z * dt;
  resolveHorizontal(src, pos, vel, half, height, 'z');

  return onGround;
}

function resolveHorizontal(
  src: BlockSource,
  pos: Vector3,
  vel: Vector3,
  half: number,
  height: number,
  axis: 'x' | 'z',
): void {
  const v = vel[axis];
  if (v === 0) return;

  const y0 = Math.floor(pos.y + EPS);
  const y1 = Math.floor(pos.y + height - EPS);
  const other = axis === 'x' ? 'z' : 'x';
  const o0 = Math.floor(pos[other] - half + EPS);
  const o1 = Math.floor(pos[other] + half - EPS);

  if (v > 0) {
    const c = Math.floor(pos[axis] + half - EPS);
    if (anySolidColumn(src, axis, c, y0, y1, o0, o1)) {
      pos[axis] = c - half - EPS;
      vel[axis] = 0;
    }
  } else {
    const c = Math.floor(pos[axis] - half + EPS);
    if (anySolidColumn(src, axis, c, y0, y1, o0, o1)) {
      pos[axis] = c + 1 + half + EPS;
      vel[axis] = 0;
    }
  }
}

function anySolidXZ(
  src: BlockSource,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  y: number,
): boolean {
  const x0 = Math.floor(minX + EPS);
  const x1 = Math.floor(maxX - EPS);
  const z0 = Math.floor(minZ + EPS);
  const z1 = Math.floor(maxZ - EPS);
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      if (isSolidAt(src, x, y, z)) return true;
    }
  }
  return false;
}

function anySolidColumn(
  src: BlockSource,
  axis: 'x' | 'z',
  axisCoord: number,
  y0: number,
  y1: number,
  o0: number,
  o1: number,
): boolean {
  for (let y = y0; y <= y1; y++) {
    for (let o = o0; o <= o1; o++) {
      const wx = axis === 'x' ? axisCoord : o;
      const wz = axis === 'x' ? o : axisCoord;
      if (isSolidAt(src, wx, y, wz)) return true;
    }
  }
  return false;
}
