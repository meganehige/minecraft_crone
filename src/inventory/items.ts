import { Tile } from '../render/atlas';
import { BlockId } from '../world/blocks/BlockType';
import { BLOCKS } from '../world/blocks/blocks';

/** Items are block items (id === BlockId) or non-block items (id >= 100). */
export type ItemId = number;

export type ToolType = 'pickaxe' | 'axe' | 'shovel';

export interface ToolInfo {
  type: ToolType;
  /** 1 = wood, 2 = stone, 3 = iron, 4 = diamond. */
  tier: number;
  /** Digging speed multiplier when used on a matching block. */
  multiplier: number;
  maxDurability: number;
}

/** Non-block item ids. */
export const Item = {
  Stick: 100,
  Coal: 101,
  IronIngot: 102,
  RawIron: 103,
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

export interface ItemDef {
  id: ItemId;
  name: string;
  tile: number;
  /** Block placed when used, or null for non-placeable items. */
  block: BlockId | null;
  maxStack: number;
  tool?: ToolInfo;
}

const TIER_NAMES = ['', 'wooden', 'stone', 'iron', 'diamond'];
const TIER_MULT = [0, 2, 4, 6, 8];
const TIER_DURABILITY = [0, 59, 131, 250, 1561];
const TYPE_TILE: Record<ToolType, number> = {
  pickaxe: Tile.Pickaxe,
  axe: Tile.Axe,
  shovel: Tile.Shovel,
};

const NON_BLOCK: ItemDef[] = [
  { id: Item.Stick, name: 'stick', tile: Tile.Stick, block: null, maxStack: 64 },
  { id: Item.Coal, name: 'coal', tile: Tile.Coal, block: null, maxStack: 64 },
  { id: Item.IronIngot, name: 'iron ingot', tile: Tile.IronIngot, block: null, maxStack: 64 },
  { id: Item.RawIron, name: 'raw iron', tile: Tile.RawIron, block: null, maxStack: 64 },
];

/** Build the 12 tool defs (pickaxe/axe/shovel × wood/stone/iron/diamond). */
function buildTools(): ItemDef[] {
  const out: ItemDef[] = [];
  const types: { type: ToolType; base: number }[] = [
    { type: 'pickaxe', base: 110 },
    { type: 'axe', base: 120 },
    { type: 'shovel', base: 130 },
  ];
  for (const { type, base } of types) {
    for (let tier = 1; tier <= 4; tier++) {
      out.push({
        id: base + (tier - 1),
        name: `${TIER_NAMES[tier]} ${type}`,
        tile: TYPE_TILE[type],
        block: null,
        maxStack: 1,
        tool: {
          type,
          tier,
          multiplier: TIER_MULT[tier]!,
          maxDurability: TIER_DURABILITY[tier]!,
        },
      });
    }
  }
  return out;
}

const ITEMS = new Map<ItemId, ItemDef>();
for (const b of BLOCKS) {
  if (b.id === BlockId.Air) continue;
  ITEMS.set(b.id, { id: b.id, name: b.name, tile: b.tiles.side, block: b.id, maxStack: 64 });
}
for (const it of NON_BLOCK) ITEMS.set(it.id, it);
for (const t of buildTools()) ITEMS.set(t.id, t);

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
  block(id: ItemId): BlockId | null {
    return ITEMS.get(id)?.block ?? null;
  },
  isPlaceable(id: ItemId): boolean {
    return (ITEMS.get(id)?.block ?? null) !== null;
  },
  maxStack(id: ItemId): number {
    return ITEMS.get(id)?.maxStack ?? 64;
  },
  tool(id: ItemId): ToolInfo | undefined {
    return ITEMS.get(id)?.tool;
  },
};
