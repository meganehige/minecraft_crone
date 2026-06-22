import { ItemRegistry, type ItemId } from './items';
import { matchRecipe } from '../crafting/recipes';

export type { ItemId };

export interface ItemStack {
  item: ItemId;
  count: number;
  /** Remaining durability for tools; undefined for non-tools. */
  durability?: number;
}

/** Build a fresh stack, initialising tool durability. */
export function freshStack(item: ItemId, count: number): ItemStack {
  const tool = ItemRegistry.tool(item);
  return tool ? { item, count, durability: tool.maxDurability } : { item, count };
}

export const HOTBAR_SIZE = 9;
export const MAIN_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + MAIN_SIZE; // 36
export const STACK_MAX = 64;

/**
 * Player inventory: 9 hotbar slots (0..8) + 27 main slots (9..35), stacking up
 * to 64. Also holds a "cursor" stack for click-to-move in the inventory screen.
 */
export class Inventory {
  readonly slots: (ItemStack | null)[] = new Array(TOTAL_SLOTS).fill(null);
  /** Selected hotbar index 0..8. */
  selected = 0;
  /** Stack held by the cursor while rearranging in the inventory UI. */
  cursor: ItemStack | null = null;

  /** Crafting grid cells (up to 3x3). Active area is craftSize x craftSize. */
  readonly craftSlots: (ItemStack | null)[] = new Array(9).fill(null);
  craftSize: 2 | 3 = 2;

  onChange?: () => void;

  /** Add items, filling existing stacks then empty slots. Returns leftover. */
  add(item: ItemId, count: number): number {
    const max = ItemRegistry.maxStack(item);
    let remaining = count;
    // Top up existing stacks first (no-op for non-stacking tools).
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === item && s.count < max) {
        const room = max - s.count;
        const take = Math.min(room, remaining);
        s.count += take;
        remaining -= take;
      }
    }
    // Then empty slots.
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, remaining);
        this.slots[i] = freshStack(item, take);
        remaining -= take;
      }
    }
    if (remaining !== count) this.changed();
    return remaining;
  }

  /** Damage the selected tool by one use; removes it if it breaks. Returns broke. */
  damageSelected(): boolean {
    const s = this.slots[this.selected];
    if (!s || s.durability === undefined) return false;
    s.durability -= 1;
    if (s.durability <= 0) {
      this.slots[this.selected] = null;
      this.changed();
      return true;
    }
    this.changed();
    return false;
  }

  getSelectedItem(): ItemId | null {
    return this.slots[this.selected]?.item ?? null;
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.selected = index;
    this.changed();
  }

  /** Select the first hotbar slot holding `item`, if any. */
  selectItem(item: ItemId): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (this.slots[i]?.item === item) {
        this.select(i);
        return;
      }
    }
  }

  /** Consume one item from a slot (defaults to the selected hotbar slot). */
  consumeOne(index = this.selected): boolean {
    const s = this.slots[index];
    if (!s) return false;
    s.count -= 1;
    if (s.count <= 0) this.slots[index] = null;
    this.changed();
    return true;
  }

  countOf(item: ItemId): number {
    let n = 0;
    for (const s of this.slots) if (s?.item === item) n += s.count;
    return n;
  }

  /** Click a slot with cursor semantics (pick up / drop / merge / swap). */
  clickSlot(index: number): void {
    if (index < 0 || index >= TOTAL_SLOTS) return;
    const slot = this.slots[index];
    if (this.cursor === null) {
      if (slot) {
        this.cursor = slot;
        this.slots[index] = null;
      }
    } else if (!slot) {
      this.slots[index] = this.cursor;
      this.cursor = null;
    } else if (slot.item === this.cursor.item) {
      const room = STACK_MAX - slot.count;
      const take = Math.min(room, this.cursor.count);
      slot.count += take;
      this.cursor.count -= take;
      if (this.cursor.count <= 0) this.cursor = null;
    } else {
      this.slots[index] = this.cursor;
      this.cursor = slot;
    }
    this.changed();
  }

  // --- Crafting ---

  /** Switch grid size, returning any now-unused cell contents to the inventory. */
  setCraftSize(size: 2 | 3): void {
    if (size === 2) {
      for (let i = 4; i < 9; i++) this.returnCraftCell(i);
    }
    this.craftSize = size;
    this.changed();
  }

  /** Empty the whole crafting grid back into the inventory (e.g. on close). */
  clearCraft(): void {
    for (let i = 0; i < 9; i++) this.returnCraftCell(i);
    this.changed();
  }

  private returnCraftCell(i: number): void {
    const s = this.craftSlots[i];
    if (s) {
      this.add(s.item, s.count);
      this.craftSlots[i] = null;
    }
  }

  clickCraft(i: number): void {
    if (i < 0 || i >= 9) return;
    const slot = this.craftSlots[i];
    if (this.cursor === null) {
      if (slot) {
        this.cursor = slot;
        this.craftSlots[i] = null;
      }
    } else if (!slot) {
      this.craftSlots[i] = { item: this.cursor.item, count: 1 };
      this.cursor.count -= 1;
      if (this.cursor.count <= 0) this.cursor = null;
    } else if (slot.item === this.cursor.item) {
      if (slot.count < STACK_MAX) {
        slot.count += 1;
        this.cursor.count -= 1;
        if (this.cursor.count <= 0) this.cursor = null;
      }
    } else {
      this.craftSlots[i] = this.cursor;
      this.cursor = slot;
    }
    this.changed();
  }

  /** Directly set a crafting cell (used by scripted tests). */
  setCraftCell(i: number, item: ItemId | null, count = 1): void {
    if (i < 0 || i >= 9) return;
    this.craftSlots[i] = item === null ? null : { item, count };
    this.changed();
  }

  /** The recipe output for the current grid, or null. */
  getCraftOutput(): ItemStack | null {
    const n = this.craftSize * this.craftSize;
    const cells: (ItemId | null)[] = [];
    for (let i = 0; i < n; i++) cells.push(this.craftSlots[i]?.item ?? null);
    return matchRecipe(cells, this.craftSize);
  }

  /** Craft once: consume one of each grid input and yield the output. */
  takeCraftOutput(): boolean {
    const out = this.getCraftOutput();
    if (!out) return false;
    const isTool = ItemRegistry.tool(out.item) !== undefined;
    if (this.cursor) {
      // Tools never stack onto the cursor.
      if (isTool || this.cursor.item !== out.item) return false;
      if (this.cursor.count + out.count > ItemRegistry.maxStack(out.item)) {
        return false;
      }
    }
    const n = this.craftSize * this.craftSize;
    for (let i = 0; i < n; i++) {
      const s = this.craftSlots[i];
      if (s) {
        s.count -= 1;
        if (s.count <= 0) this.craftSlots[i] = null;
      }
    }
    if (this.cursor) this.cursor.count += out.count;
    else this.cursor = freshStack(out.item, out.count);
    this.changed();
    return true;
  }

  private changed(): void {
    this.onChange?.();
  }
}
