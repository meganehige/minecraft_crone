import type { SoundManager } from '../audio/SoundManager';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import { BlockId } from '../world/blocks/BlockType';
import type { World } from '../world/World';
import type { RayHit } from './Raycast';

const DIG_SOUND_INTERVAL = 0.18; // seconds between mining "hit" sounds

export interface MiningTarget {
  x: number;
  y: number;
  z: number;
}

/**
 * Timed block breaking (hold to mine). Each tick adds progress to the targeted
 * block based on its hardness (break seconds = hardness * 1.5); the cracking
 * overlay reads the 0..9 stage. On completion it fires the break sound, invokes
 * `onBreak` (drops hook for a later sprint), then clears the block.
 */
export class MiningController {
  progress = 0; // 0..1 on the current target
  active = false;

  private targetKey: string | null = null;
  private tx = 0;
  private ty = 0;
  private tz = 0;
  private digTimer = 0;

  constructor(
    private readonly world: World,
    private readonly getHit: () => RayHit | null,
    private readonly sound: SoundManager,
    private readonly onBreak: (x: number, y: number, z: number, id: BlockId) => void,
  ) {}

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.reset();
  }

  private reset(): void {
    this.progress = 0;
    this.targetKey = null;
    this.digTimer = 0;
  }

  update(dt: number): void {
    if (!this.active) return;

    const hit = this.getHit();
    if (!hit) {
      this.reset();
      return;
    }
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    if (!BlockRegistry.isBreakable(id)) {
      this.reset();
      return;
    }

    const key = `${hit.x},${hit.y},${hit.z}`;
    if (key !== this.targetKey) {
      this.targetKey = key;
      this.tx = hit.x;
      this.ty = hit.y;
      this.tz = hit.z;
      this.progress = 0;
      this.digTimer = 0;
    }

    const breakTime = Math.max(0.05, BlockRegistry.getHardness(id) * 1.5);
    this.progress += dt / breakTime;

    this.digTimer -= dt;
    if (this.digTimer <= 0) {
      this.sound.playDig(BlockRegistry.getSoundGroup(id));
      this.digTimer = DIG_SOUND_INTERVAL;
    }

    if (this.progress >= 1) {
      this.sound.playBreak(BlockRegistry.getSoundGroup(id));
      this.onBreak(this.tx, this.ty, this.tz, id);
      this.world.setBlock(this.tx, this.ty, this.tz, BlockId.Air);
      this.reset();
    }
  }

  /** Cracking overlay stage 0..9, or -1 when not mining. */
  getStage(): number {
    if (this.targetKey === null) return -1;
    return Math.max(0, Math.min(9, Math.floor(this.progress * 10)));
  }

  getTarget(): MiningTarget | null {
    if (this.targetKey === null) return null;
    return { x: this.tx, y: this.ty, z: this.tz };
  }
}
