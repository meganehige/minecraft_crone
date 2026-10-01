import { Tile } from '../../render/atlas';
import { Item } from '../../inventory/itemIds';
import { BlockId, type BlockType } from './BlockType';

type ToolType = 'pickaxe' | 'axe' | 'shovel' | null;

interface Def {
  id: BlockId;
  name: string;
  solid: boolean;
  transparent: boolean;
  emitsLight?: number;
  tiles: { top: number; bottom: number; side: number };
  renderLayer: 'opaque' | 'transparent';
  hardness: number;
  soundGroup: BlockType['soundGroup'];
  drops: number;
  toolType?: ToolType;
  requiresTool?: boolean;
  minTier?: number;
  gravity?: boolean;
  fluid?: boolean;
}

function def(d: Def): BlockType {
  return {
    emitsLight: 0,
    toolType: null,
    requiresTool: false,
    minTier: 0,
    gravity: false,
    fluid: false,
    ...d,
  };
}

/** Block definitions indexed by BlockId. Air is index 0. */
export const BLOCKS: BlockType[] = [
  def({
    id: BlockId.Air,
    name: 'air',
    solid: false,
    transparent: true,
    tiles: { top: -1, bottom: -1, side: -1 },
    renderLayer: 'opaque',
    hardness: 0,
    soundGroup: 'stone',
    drops: BlockId.Air,
  }),
  def({
    id: BlockId.Stone,
    name: 'stone',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Stone, bottom: Tile.Stone, side: Tile.Stone },
    renderLayer: 'opaque',
    hardness: 1.5,
    soundGroup: 'stone',
    drops: BlockId.Cobblestone,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 1,
  }),
  def({
    id: BlockId.Dirt,
    name: 'dirt',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Dirt, bottom: Tile.Dirt, side: Tile.Dirt },
    renderLayer: 'opaque',
    hardness: 0.5,
    soundGroup: 'dirt',
    drops: BlockId.Dirt,
    toolType: 'shovel',
  }),
  def({
    id: BlockId.Grass,
    name: 'grass',
    solid: true,
    transparent: false,
    tiles: { top: Tile.GrassTop, bottom: Tile.Dirt, side: Tile.GrassSide },
    renderLayer: 'opaque',
    hardness: 0.6,
    soundGroup: 'grass',
    drops: BlockId.Dirt,
    toolType: 'shovel',
  }),
  def({
    id: BlockId.Sand,
    name: 'sand',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Sand, bottom: Tile.Sand, side: Tile.Sand },
    renderLayer: 'opaque',
    hardness: 0.5,
    soundGroup: 'sand',
    drops: BlockId.Sand,
    toolType: 'shovel',
    gravity: true,
  }),
  def({
    id: BlockId.Water,
    name: 'water',
    solid: false,
    transparent: true,
    tiles: { top: Tile.Water, bottom: Tile.Water, side: Tile.Water },
    renderLayer: 'transparent',
    hardness: -1,
    soundGroup: 'stone',
    drops: BlockId.Air,
    fluid: true,
  }),
  def({
    id: BlockId.Wood,
    name: 'wood',
    solid: true,
    transparent: false,
    tiles: { top: Tile.WoodTop, bottom: Tile.WoodTop, side: Tile.WoodSide },
    renderLayer: 'opaque',
    hardness: 2.0,
    soundGroup: 'wood',
    drops: BlockId.Wood,
    toolType: 'axe',
  }),
  def({
    id: BlockId.Leaves,
    name: 'leaves',
    solid: true,
    transparent: true,
    tiles: { top: Tile.Leaves, bottom: Tile.Leaves, side: Tile.Leaves },
    renderLayer: 'transparent',
    hardness: 0.2,
    soundGroup: 'leaves',
    drops: BlockId.Leaves,
  }),
  def({
    id: BlockId.Planks,
    name: 'planks',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Planks, bottom: Tile.Planks, side: Tile.Planks },
    renderLayer: 'opaque',
    hardness: 2.0,
    soundGroup: 'wood',
    drops: BlockId.Planks,
    toolType: 'axe',
  }),
  def({
    id: BlockId.Cobblestone,
    name: 'cobblestone',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Cobblestone, bottom: Tile.Cobblestone, side: Tile.Cobblestone },
    renderLayer: 'opaque',
    hardness: 2.0,
    soundGroup: 'stone',
    drops: BlockId.Cobblestone,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 1,
  }),
  def({
    id: BlockId.CraftingTable,
    name: 'crafting table',
    solid: true,
    transparent: false,
    tiles: { top: Tile.CraftingTable, bottom: Tile.Planks, side: Tile.CraftingTable },
    renderLayer: 'opaque',
    hardness: 2.5,
    soundGroup: 'wood',
    drops: BlockId.CraftingTable,
    toolType: 'axe',
  }),
  def({
    id: BlockId.Furnace,
    name: 'furnace',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Furnace, bottom: Tile.Furnace, side: Tile.Furnace },
    renderLayer: 'opaque',
    hardness: 3.5,
    soundGroup: 'stone',
    drops: BlockId.Furnace,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 1,
  }),
  def({
    id: BlockId.Lava,
    name: 'lava',
    solid: false,
    transparent: true,
    emitsLight: 15,
    tiles: { top: Tile.Lava, bottom: Tile.Lava, side: Tile.Lava },
    renderLayer: 'transparent',
    hardness: -1,
    soundGroup: 'stone',
    drops: BlockId.Air,
    fluid: true,
  }),
  def({
    id: BlockId.Gravel,
    name: 'gravel',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Gravel, bottom: Tile.Gravel, side: Tile.Gravel },
    renderLayer: 'opaque',
    hardness: 0.6,
    soundGroup: 'sand',
    drops: BlockId.Gravel,
    toolType: 'shovel',
    gravity: true,
  }),
  // --- Sprint 16: ores + bedrock ---
  def({
    id: BlockId.CoalOre,
    name: 'coal ore',
    solid: true,
    transparent: false,
    tiles: { top: Tile.CoalOre, bottom: Tile.CoalOre, side: Tile.CoalOre },
    renderLayer: 'opaque',
    hardness: 3.0,
    soundGroup: 'stone',
    drops: Item.Coal,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 1, // wooden pickaxe
  }),
  def({
    id: BlockId.IronOre,
    name: 'iron ore',
    solid: true,
    transparent: false,
    tiles: { top: Tile.IronOre, bottom: Tile.IronOre, side: Tile.IronOre },
    renderLayer: 'opaque',
    hardness: 3.0,
    soundGroup: 'stone',
    drops: Item.RawIron,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 2, // stone pickaxe
  }),
  def({
    id: BlockId.GoldOre,
    name: 'gold ore',
    solid: true,
    transparent: false,
    tiles: { top: Tile.GoldOre, bottom: Tile.GoldOre, side: Tile.GoldOre },
    renderLayer: 'opaque',
    hardness: 3.0,
    soundGroup: 'stone',
    drops: Item.RawGold,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 3, // iron pickaxe
  }),
  def({
    id: BlockId.DiamondOre,
    name: 'diamond ore',
    solid: true,
    transparent: false,
    tiles: { top: Tile.DiamondOre, bottom: Tile.DiamondOre, side: Tile.DiamondOre },
    renderLayer: 'opaque',
    hardness: 3.0,
    soundGroup: 'stone',
    drops: Item.Diamond,
    toolType: 'pickaxe',
    requiresTool: true,
    minTier: 3, // iron pickaxe
  }),
  def({
    id: BlockId.Bedrock,
    name: 'bedrock',
    solid: true,
    transparent: false,
    tiles: { top: Tile.Bedrock, bottom: Tile.Bedrock, side: Tile.Bedrock },
    renderLayer: 'opaque',
    hardness: -1, // unbreakable: the world floor
    soundGroup: 'stone',
    drops: BlockId.Air,
  }),
];
