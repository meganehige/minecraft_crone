/** Stable numeric ids for block types. Stored directly in chunk arrays. */
export enum BlockId {
  Air = 0,
  Stone = 1,
  Dirt = 2,
  Grass = 3,
  Sand = 4,
  Water = 5,
  Wood = 6,
  Leaves = 7,
  Planks = 8,
  Cobblestone = 9,
  CraftingTable = 10,
  Furnace = 11,
}

export type RenderLayer = 'opaque' | 'transparent';

/** Material sound family for break/place/step audio. */
export type SoundGroup =
  | 'stone'
  | 'dirt'
  | 'grass'
  | 'sand'
  | 'wood'
  | 'leaves';

export interface BlockType {
  id: BlockId;
  name: string;
  /** Collides with entities. */
  solid: boolean;
  /** Lets neighbour faces render through it (air, water, leaves). */
  transparent: boolean;
  /** Block-light emission 0..15 (0 for most). */
  emitsLight: number;
  /** Atlas tile indices per face group. */
  tiles: { top: number; bottom: number; side: number };
  renderLayer: RenderLayer;
  /** Break difficulty; base break seconds = hardness * 1.5. -1 = unbreakable. */
  hardness: number;
  /** Material family for sounds. */
  soundGroup: SoundGroup;
  /** Block id dropped when broken (defaults handled in the registry). */
  drops: BlockId;
}

