import { BlockId } from '../world/blocks/BlockType';

/** Items are block items for now, identified by BlockId. */
export type ItemId = BlockId;

export interface ItemStack {
  item: ItemId;
  count: number;
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

  onChange?: () => void;

  /** Add items, filling existing stacks then empty slots. Returns leftover. */
  add(item: ItemId, count: number): number {
    let remaining = count;
    // Top up existing stacks first.
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === item && s.count < STACK_MAX) {
        const room = STACK_MAX - s.count;
        const take = Math.min(room, remaining);
        s.count += take;
        remaining -= take;
      }
    }
    // Then empty slots.
    for (let i = 0; i < TOTAL_SLOTS && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(STACK_MAX, remaining);
        this.slots[i] = { item, count: take };
        remaining -= take;
      }
    }
    if (remaining !== count) this.changed();
    return remaining;
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

  private changed(): void {
    this.onChange?.();
  }
}
