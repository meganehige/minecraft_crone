import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Block / item ids (see BlockType.ts and items.ts).
const WOOD = 6;
const PLANKS = 8;
const COBBLE = 9;
const CRAFTING_TABLE = 10;
const FURNACE = 11;
const STONE = 1;
const STICK = 100;
const COAL = 101;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.setCraftCell && !!window.__game.setFurnace,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

async function craft2(
  page: Page,
  cells: (number | null)[],
): Promise<{ item: number; count: number } | null> {
  return page.evaluate((c) => {
    window.__game.setCraftSize!(2);
    for (let i = 0; i < 4; i++) window.__game.setCraftCell!(i, c[i] ?? null);
    return window.__game.getCraftOutput!();
  }, cells);
}

test.describe('Sprint 11: crafting & smelting', () => {
  test('2x2 recipes: planks, sticks, crafting table', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // 1 log -> 4 planks (shapeless)
    expect(await craft2(page, [WOOD, null, null, null])).toEqual({
      item: PLANKS,
      count: 4,
    });
    // 2 planks vertical (cells 0 and 2) -> 4 sticks (shaped)
    expect(await craft2(page, [PLANKS, null, PLANKS, null])).toEqual({
      item: STICK,
      count: 4,
    });
    // 2x2 planks -> crafting table
    expect(await craft2(page, [PLANKS, PLANKS, PLANKS, PLANKS])).toEqual({
      item: CRAFTING_TABLE,
      count: 1,
    });

    // Actually craft the table: output goes to the cursor.
    const ok = await page.evaluate(() => window.__game.takeCraftOutput!());
    expect(ok).toBe(true);
    expect(await page.evaluate(() => window.__game.getCursor!())).toEqual({
      item: CRAFTING_TABLE,
      count: 1,
    });
    expect(errors).toEqual([]);
  });

  test('3x3 recipe: cobblestone ring -> furnace', async ({ page }) => {
    await boot(page);
    const out = await page.evaluate(
      ([cobble]) => {
        window.__game.setCraftSize!(3);
        const ring = [0, 1, 2, 3, 5, 6, 7, 8];
        for (const i of ring) window.__game.setCraftCell!(i, cobble);
        window.__game.setCraftCell!(4, null); // empty centre
        return window.__game.getCraftOutput!();
      },
      [COBBLE],
    );
    expect(out).toEqual({ item: FURNACE, count: 1 });
  });

  test('furnace smelts cobblestone into stone using fuel', async ({ page }) => {
    await boot(page);
    await page.evaluate(
      ([cobble, coal]) => window.__game.setFurnace!(2, 40, 2, cobble, 1, coal, 1),
      [COBBLE, COAL],
    );
    // Smelting takes 200 ticks (~10s at 20 TPS).
    await page.waitForFunction(
      () => window.__game.getFurnaceOutput!(2, 40, 2) !== null,
      null,
      { timeout: 20_000 },
    );
    const out = await page.evaluate(() => window.__game.getFurnaceOutput!(2, 40, 2));
    expect(out!.item).toBe(STONE);
    expect(out!.count).toBeGreaterThanOrEqual(1);
  });
});
