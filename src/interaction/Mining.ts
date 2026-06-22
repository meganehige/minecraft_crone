import type { SoundManager } from '../audio/SoundManager';
import { BlockRegistry } from '../world/blocks/BlockRegistry';
import { BlockId } from '../world/blocks/BlockType';
import type { World } from '../world/World';
import type { ItemStack, ItemId } from '../inventory/Inventory';
import { ItemRegistry } from '../inventory/items';
import type { RayHit } from './Raycast';

const DIG_SOUND_INTERVAL = 0.18; // seconds between mining "hit" sounds

export interface MiningTarget {
  x: number;
  y: number;
  z: number;
}

/**
 * Timed block breaking (hold to mine). Break time depends on hardness and the
 * held tool (correct tool tier speeds it up); whether the block drops depends on
 * "requires tool" + tier rules. Breaking consumes one durability from the held
 * tool. The cracking overlay reads the 0..9 stage.
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
    private readonly getHeld: () => ItemStack | null,
    private readonly onBreak: (x: number, y: number, z: number, drop: ItemId | null) => void,
    private readonly damageHeld: () => void,
    private readonly isCreative: () => boolean = () => false,
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

  /** Seconds to break a block with the currently held item. */
  private breakSeconds(id: BlockId): number {
    if (this.isCreative()) return 0.0001; // instant break in creative
    const hardness = BlockRegistry.getHardness(id);
    const tool = this.heldTool();
    const speed =
      tool && tool.type === BlockRegistry.getToolType(id) ? tool.multiplier : 1;
    return Math.max(0.05, (hardness * 1.5) / speed);
  }

  private heldTool() {
    const held = this.getHeld();
    return held ? ItemRegistry.tool(held.item) : undefined;
  }

  private canHarvest(id: BlockId): boolean {
    if (!BlockRegistry.requiresTool(id)) return true;
    const tool = this.heldTool();
    return (
      !!tool &&
      tool.type === BlockRegistry.getToolType(id) &&
      tool.tier >= BlockRegistry.getMinTier(id)
    );
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

    this.progress += dt / this.breakSeconds(id);

    this.digTimer -= dt;
    if (this.digTimer <= 0) {
      this.sound.playDig(BlockRegistry.getSoundGroup(id));
      this.digTimer = DIG_SOUND_INTERVAL;
    }

    if (this.progress >= 1) {
      this.sound.playBreak(BlockRegistry.getSoundGroup(id));
      const drop = this.isCreative()
        ? null
        : this.canHarvest(id)
          ? BlockRegistry.getDrop(id)
          : null;
      this.onBreak(this.tx, this.ty, this.tz, drop);
      this.world.setBlock(this.tx, this.ty, this.tz, BlockId.Air);
      if (!this.isCreative()) this.damageHeld();
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
