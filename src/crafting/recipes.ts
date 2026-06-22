import { BlockId } from '../world/blocks/BlockType';
import { Item, type ItemId } from '../inventory/items';

export interface RecipeOutput {
  item: ItemId;
  count: number;
}

interface ShapelessRecipe {
  kind: 'shapeless';
  ingredients: ItemId[];
  output: RecipeOutput;
}

interface ShapedRecipe {
  kind: 'shaped';
  width: number;
  height: number;
  /** Row-major cells of the minimal pattern; null = must be empty. */
  cells: (ItemId | null)[];
  output: RecipeOutput;
}

type Recipe = ShapelessRecipe | ShapedRecipe;

const W = BlockId.Wood;
const P = BlockId.Planks;
const C = BlockId.Cobblestone;
const S = Item.Stick;

/** Tool recipes per material tier (wood=planks, stone=cobble, iron=ingot). */
function toolRecipes(): ShapedRecipe[] {
  const tiers: { mat: ItemId; pick: ItemId; axe: ItemId; shovel: ItemId }[] = [
    { mat: P, pick: Item.WoodPickaxe, axe: Item.WoodAxe, shovel: Item.WoodShovel },
    { mat: C, pick: Item.StonePickaxe, axe: Item.StoneAxe, shovel: Item.StoneShovel },
    {
      mat: Item.IronIngot,
      pick: Item.IronPickaxe,
      axe: Item.IronAxe,
      shovel: Item.IronShovel,
    },
  ];
  const out: ShapedRecipe[] = [];
  for (const t of tiers) {
    const M = t.mat;
    out.push({
      kind: 'shaped',
      width: 3,
      height: 3,
      cells: [M, M, M, null, S, null, null, S, null],
      output: { item: t.pick, count: 1 },
    });
    out.push({
      kind: 'shaped',
      width: 2,
      height: 3,
      cells: [M, M, M, S, null, S],
      output: { item: t.axe, count: 1 },
    });
    out.push({
      kind: 'shaped',
      width: 1,
      height: 3,
      cells: [M, S, S],
      output: { item: t.shovel, count: 1 },
    });
  }
  return out;
}

export const RECIPES: Recipe[] = [
  // 1 log -> 4 planks
  { kind: 'shapeless', ingredients: [W], output: { item: P, count: 4 } },
  // 2 planks (vertical) -> 4 sticks
  {
    kind: 'shaped',
    width: 1,
    height: 2,
    cells: [P, P],
    output: { item: Item.Stick, count: 4 },
  },
  // 2x2 planks -> crafting table
  {
    kind: 'shaped',
    width: 2,
    height: 2,
    cells: [P, P, P, P],
    output: { item: BlockId.CraftingTable, count: 1 },
  },
  // 8 cobblestone ring (3x3, empty centre) -> furnace
  {
    kind: 'shaped',
    width: 3,
    height: 3,
    cells: [C, C, C, C, null, C, C, C, C],
    output: { item: BlockId.Furnace, count: 1 },
  },
  ...toolRecipes(),
];

/** Crop the grid to the bounding box of its non-null cells. */
function boundingBox(
  cells: (ItemId | null)[],
  size: number,
): { cells: (ItemId | null)[]; width: number; height: number } | null {
  let minR = size;
  let maxR = -1;
  let minC = size;
  let maxC = -1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] !== null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR < 0) return null; // empty grid
  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  const out: (ItemId | null)[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) out.push(cells[r * size + c]!);
  }
  return { cells: out, width, height };
}

function matchShaped(
  recipe: ShapedRecipe,
  cells: (ItemId | null)[],
  size: number,
): boolean {
  const bb = boundingBox(cells, size);
  if (!bb) return false;
  if (bb.width !== recipe.width || bb.height !== recipe.height) return false;
  for (let i = 0; i < recipe.cells.length; i++) {
    if ((bb.cells[i] ?? null) !== recipe.cells[i]) return false;
  }
  return true;
}

function matchShapeless(
  recipe: ShapelessRecipe,
  cells: (ItemId | null)[],
): boolean {
  const present = cells.filter((c): c is ItemId => c !== null).sort();
  const need = [...recipe.ingredients].sort();
  if (present.length !== need.length) return false;
  return present.every((v, i) => v === need[i]);
}

/** Find the output for a crafting grid (size x size), or null. */
export function matchRecipe(
  cells: (ItemId | null)[],
  size: number,
): RecipeOutput | null {
  for (const r of RECIPES) {
    const ok =
      r.kind === 'shaped'
        ? matchShaped(r, cells, size)
        : matchShapeless(r, cells);
    if (ok) return r.output;
  }
  return null;
}
