/**
 * Numeric item ids, kept in their own dependency-free module.
 *
 * Block definitions need to name the items that ores drop, and the item
 * registry is built from the block table — importing `items.ts` from
 * `blocks.ts` would be a cycle, so the raw ids live here where both can reach
 * them without one.
 */

/** Items are block items (id === BlockId) or non-block items (id >= 100). */
export type ItemId = number;

/** Non-block item ids. */
export const Item = {
  Stick: 100,
  Coal: 101,
  IronIngot: 102,
  RawIron: 103,
  // Sprint 16: ore drops
  Diamond: 104,
  RawGold: 105,
  GoldIngot: 106,
  // Sprint 17: food
  Porkchop: 107,
  CookedPorkchop: 108,
  // Tools: pickaxe 110-113, axe 120-123, shovel 130-133 (tier order wood..diamond).
  WoodPickaxe: 110,
  StonePickaxe: 111,
  IronPickaxe: 112,
  DiamondPickaxe: 113,
  WoodAxe: 120,
  StoneAxe: 121,
  IronAxe: 122,
  DiamondAxe: 123,
  WoodShovel: 130,
  StoneShovel: 131,
  IronShovel: 132,
  DiamondShovel: 133,
} as const;
