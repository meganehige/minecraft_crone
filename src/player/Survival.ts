import type { Player } from './Player';
import { BlockId } from '../world/blocks/BlockType';
import type { BlockSource } from '../world/BlockSource';

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
const MAX_BREATH = 15; // seconds underwater before drowning
const VOID_Y = -10;

/**
 * Player survival state: health, hunger (with hidden saturation/exhaustion),
 * breath, and environmental damage (fall, drowning, lava, void) plus natural
 * regeneration. Disabled in creative mode.
 */
export class Survival {
  health = MAX_HEALTH;
  hunger = MAX_HUNGER;
  saturation = 5;
  exhaustion = 0;
  breath = MAX_BREATH;
  creative = false;
  alive = true;

  private regenTimer = 0;
  private starveTimer = 0;
  private drownTimer = 0;
  private lavaTimer = 0;

  reset(): void {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.exhaustion = 0;
    this.breath = MAX_BREATH;
    this.alive = true;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.lavaTimer = 0;
  }

  damage(amount: number): void {
    if (this.creative || !this.alive || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.alive = false;
  }

  heal(amount: number): void {
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  addExhaustion(n: number): void {
    if (this.creative) return;
    this.exhaustion += n;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }

  /** Apply fall damage from a landing of the given distance (blocks). */
  applyFall(distance: number): void {
    const dmg = Math.floor(distance - 3);
    if (dmg > 0) this.damage(dmg);
  }

  tick(dt: number, player: Player, world: BlockSource): void {
    if (this.creative) {
      this.health = MAX_HEALTH;
      this.hunger = MAX_HUNGER;
      this.breath = MAX_BREATH;
      return;
    }
    if (!this.alive) return;

    if (player.movedThisTick) this.addExhaustion(0.01);
    if (player.jumpedThisTick) this.addExhaustion(0.05);

    const px = Math.floor(player.pos.x);
    const pz = Math.floor(player.pos.z);
    const headY = Math.floor(player.pos.y + player.eyeHeight);
    const feetY = Math.floor(player.pos.y + 0.1);
    const headBlock = world.getBlock(px, headY, pz);
    const feetBlock = world.getBlock(px, feetY, pz);

    // Drowning: head submerged in water.
    if (headBlock === BlockId.Water) {
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1) {
          this.drownTimer -= 1;
          this.damage(2);
        }
      }
    } else {
      this.breath = MAX_BREATH;
      this.drownTimer = 0;
    }

    // Lava: standing in lava burns fast.
    if (feetBlock === BlockId.Lava || headBlock === BlockId.Lava) {
      this.lavaTimer += dt;
      if (this.lavaTimer >= 0.5) {
        this.lavaTimer -= 0.5;
        this.damage(2);
      }
    } else {
      this.lavaTimer = 0;
    }

    // Void.
    if (player.pos.y < VOID_Y) this.damage(4);

    // Starvation / regeneration.
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer -= 4;
        if (this.health > 1) this.damage(1);
      }
    } else if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2) {
        this.regenTimer -= 2;
        this.heal(1);
        this.addExhaustion(6);
      }
    }
  }
}
