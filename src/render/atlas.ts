/**
 * Texture atlas layout. Tiles are laid out in a COLS x ROWS grid; each block
 * face references a tile by index. The actual pixels are drawn procedurally in
 * materials.ts so we don't need a binary asset.
 */
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
export const TILE_PX = 16;
export const ATLAS_W = ATLAS_COLS * TILE_PX;
export const ATLAS_H = ATLAS_ROWS * TILE_PX;

/** Tile indices into the atlas grid (row-major from top-left). */
export const Tile = {
  GrassTop: 0,
  GrassSide: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Water: 5,
  WoodTop: 6,
  WoodSide: 7,
  Leaves: 8,
  // Sprint 11 additions
  Planks: 9,
  Cobblestone: 10,
  CraftingTable: 11,
  Furnace: 12,
  Stick: 13,
  Coal: 14,
  IronIngot: 15,
  RawIron: 16,
  // Sprint 12 tool icons
  Pickaxe: 17,
  Axe: 18,
  Shovel: 19,
  Lava: 20,
  Gravel: 21,
} as const;

/**
 * UV rectangle for a tile index. Returns [u0, v0, u1, v1] with (u0,v0) at the
 * bottom-left. A small inset avoids bleeding into neighbouring tiles under
 * linear sampling at tile seams.
 */
export function tileUVRect(index: number): [number, number, number, number] {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const inset = 0.0;
  const u0 = (col + inset) / ATLAS_COLS;
  const u1 = (col + 1 - inset) / ATLAS_COLS;
  // Texture V is bottom-up; row 0 is the top row of the atlas image.
  const v1 = 1 - (row + inset) / ATLAS_ROWS;
  const v0 = 1 - (row + 1 - inset) / ATLAS_ROWS;
  return [u0, v0, u1, v1];
}
