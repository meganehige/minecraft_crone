import type { ItemStack } from '../inventory/Inventory';
import { Item, type ItemId } from '../inventory/items';
import { BlockId } from '../world/blocks/BlockType';

const COOK_TICKS = 200; // 10 seconds at 20 TPS

/** input item -> smelted output item. */
const SMELT: Record<number, ItemId> = {
  [BlockId.Cobblestone]: BlockId.Stone,
  [Item.RawIron]: Item.IronIngot,
};

/** fuel item -> burn ticks it provides. */
const FUEL: Record<number, number> = {
  [Item.Coal]: 1600,
  [BlockId.Wood]: 300,
  [BlockId.Planks]: 300,
  [Item.Stick]: 100,
};

export interface FurnaceState {
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  cook: number; // progress ticks 0..COOK_TICKS
  burn: number; // remaining burn ticks
  burnMax: number;
}

function smeltResult(item: ItemId): ItemId | null {
  const r = SMELT[item];
  return r === undefined ? null : r;
}

function fuelTicks(item: ItemId): number {
  return FUEL[item] ?? 0;
}

/** Per-position furnace states with smelting tick logic. */
export class FurnaceManager {
  private readonly furnaces = new Map<string, FurnaceState>();

  get(key: string): FurnaceState {
    let f = this.furnaces.get(key);
    if (!f) {
      f = { input: null, fuel: null, output: null, cook: 0, burn: 0, burnMax: 0 };
      this.furnaces.set(key, f);
    }
    return f;
  }

  remove(key: string): void {
    this.furnaces.delete(key);
  }

  /** Advance all furnaces by one tick. Returns true if any state changed. */
  tick(): boolean {
    let changed = false;
    for (const f of this.furnaces.values()) {
      if (this.tickOne(f)) changed = true;
    }
    return changed;
  }

  private tickOne(f: FurnaceState): boolean {
    let changed = false;
    if (f.burn > 0) {
      f.burn -= 1;
      changed = true;
    }

    const result = f.input ? smeltResult(f.input.item) : null;
    const canOutput =
      result !== null &&
      (f.output === null ||
        (f.output.item === result && f.output.count < 64));

    // Light the furnace if it can smelt and has fuel.
    if (f.burn === 0 && result !== null && canOutput && f.fuel && fuelTicks(f.fuel.item) > 0) {
      f.burnMax = fuelTicks(f.fuel.item);
      f.burn = f.burnMax;
      f.fuel.count -= 1;
      if (f.fuel.count <= 0) f.fuel = null;
      changed = true;
    }

    if (f.burn > 0 && result !== null && canOutput && f.input) {
      f.cook += 1;
      if (f.cook >= COOK_TICKS) {
        f.cook = 0;
        f.input.count -= 1;
        if (f.input.count <= 0) f.input = null;
        if (f.output) f.output.count += 1;
        else f.output = { item: result, count: 1 };
      }
      changed = true;
    } else if (f.cook !== 0) {
      f.cook = 0;
      changed = true;
    }
    return changed;
  }
}

export { COOK_TICKS };
