import type { Player } from '../player/Player';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import { BlockId } from '../world/blocks/BlockType';
import type { World } from '../world/World';
import { raycastVoxel, type RayHit } from './Raycast';

const REACH = 6;

export interface Ray {
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

/** Compute the look ray from a player's eye and orientation. */
export function playerRay(player: Player): Ray {
  const cp = Math.cos(player.pitch);
  return {
    ox: player.pos.x,
    oy: player.pos.y + player.eyeHeight,
    oz: player.pos.z,
    dx: -Math.sin(player.yaw) * cp,
    dy: Math.sin(player.pitch),
    dz: -Math.cos(player.yaw) * cp,
  };
}

/** Place/break blocks along the player's look ray. */
export class BlockInteraction {
  activeBlock: BlockId = BlockId.Stone;

  constructor(
    private readonly world: World,
    private readonly player: Player,
  ) {}

  raycast(): RayHit | null {
    const r = playerRay(this.player);
    return raycastVoxel(this.world, r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, REACH);
  }

  /** Break (remove) the targeted block. Returns true if something was removed. */
  break(): boolean {
    const hit = this.raycast();
    if (!hit) return false;
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.Air);
    return true;
  }

  /**
   * Place the active block against the targeted face. Refuses to place into a
   * non-air cell or one that would intersect the player's body.
   */
  place(): boolean {
    const hit = this.raycast();
    if (!hit) return false;
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz;
    if (this.world.getBlock(tx, ty, tz) !== BlockId.Air) return false;
    if (BlockRegistry.isSolid(this.activeBlock) && this.intersectsPlayer(tx, ty, tz)) {
      return false;
    }
    this.world.setBlock(tx, ty, tz, this.activeBlock);
    return true;
  }

  private intersectsPlayer(bx: number, by: number, bz: number): boolean {
    const p = this.player;
    const minX = p.pos.x - p.half;
    const maxX = p.pos.x + p.half;
    const minZ = p.pos.z - p.half;
    const maxZ = p.pos.z + p.half;
    const minY = p.pos.y;
    const maxY = p.pos.y + p.height;
    return (
      bx + 1 > minX &&
      bx < maxX &&
      bz + 1 > minZ &&
      bz < maxZ &&
      by + 1 > minY &&
      by < maxY
    );
  }
}
