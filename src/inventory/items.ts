import { Tile } from '../render/atlas';
import { BlockId } from '../world/blocks/BlockType';
import { BLOCKS } from '../world/blocks/blocks';

/** Items are either block items (id === BlockId) or non-block items (id >= 100). */
export type ItemId = number;

/** Non-block item ids. */
export const Item = {
  Stick: 100,
  Coal: 101,
  IronIngot: 102,
  RawIron: 103,
} as const;

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Atlas tile used as the icon / dropped-cube texture. */
  tile: number;
  /** Block placed when used, or null for non-placeable items. */
  block: BlockId | null;
}

const NON_BLOCK: ItemDef[] = [
  { id: Item.Stick, name: 'stick', tile: Tile.Stick, block: null },
  { id: Item.Coal, name: 'coal', tile: Tile.Coal, block: null },
  { id: Item.IronIngot, name: 'iron ingot', tile: Tile.IronIngot, block: null },
  { id: Item.RawIron, name: 'raw iron', tile: Tile.RawIron, block: null },
];

const ITEMS = new Map<ItemId, ItemDef>();
for (const b of BLOCKS) {
  if (b.id === BlockId.Air) continue;
  ITEMS.set(b.id, { id: b.id, name: b.name, tile: b.tiles.side, block: b.id });
}
for (const it of NON_BLOCK) ITEMS.set(it.id, it);

export const ItemRegistry = {
  get(id: ItemId): ItemDef | undefined {
    return ITEMS.get(id);
  },
  name(id: ItemId): string {
    return ITEMS.get(id)?.name ?? `#${id}`;
  },
  tile(id: ItemId): number {
    return ITEMS.get(id)?.tile ?? 0;
  },
  /** Block to place for this item, or null if it isn't placeable. */
  block(id: ItemId): BlockId | null {
    return ITEMS.get(id)?.block ?? null;
  },
  isPlaceable(id: ItemId): boolean {
    return (ITEMS.get(id)?.block ?? null) !== null;
  },
};
