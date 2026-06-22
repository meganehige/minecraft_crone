import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const AIR = 0;
const STONE = 1;
const WATER = 5;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.setBlock, null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

const getBlock = (page: Page, x: number, y: number, z: number) =>
  page.evaluate(([px, py, pz]) => window.__game.getBlock!(px, py, pz), [x, y, z]);

test.describe('Sprint 14: fluids & gravity blocks', () => {
  test('sand falls until it rests on the ground', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    const h = await page.evaluate(() => window.__game.surfaceHeight!(8, 8));
    // Clear the column above the surface (in case a tree grew here), then drop
    // sand a few blocks up with air beneath it.
    await page.evaluate((top) => {
      for (let y = top; y >= top - 5; y--) window.__game.setBlock!(8, y, 8, 0);
    }, h + 6);
    await page.evaluate((y) => window.__game.setBlock!(8, y, 8, 4), h + 4);

    // It should fall to rest directly on the surface (y = h + 1).
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 4, h + 1, {
      timeout: 5_000,
    });
    expect(await getBlock(page, 8, h + 4, 8)).toBe(AIR);
    expect(errors).toEqual([]);
  });

  test('water flows downward to fill a gap', async ({ page }) => {
    await boot(page);
    const h = await page.evaluate(() => window.__game.surfaceHeight!(8, 20));
    // Place a water source up in the air; it should flow down to the surface.
    await page.evaluate((y) => window.__game.setBlock!(8, y, 20, 5), h + 4);
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 20) === 5, h + 1, {
      timeout: 5_000,
    });
    expect(await getBlock(page, 8, h + 1, 20)).toBe(WATER);
  });

  test('water spreads horizontally across a flat floor', async ({ page }) => {
    await boot(page);
    const h = await page.evaluate(() => window.__game.surfaceHeight!(8, 40));
    const floor = h + 1;
    // Lay a small stone floor and drop a water source on one end.
    await page.evaluate(
      ([y, stone]) => {
        for (let dx = 0; dx <= 3; dx++) window.__game.setBlock!(8 + dx, y, 40, stone);
      },
      [floor, STONE],
    );
    await page.evaluate((y) => window.__game.setBlock!(8, y + 1, 40, 5), floor);

    // Water should spread along the floor to the far end.
    await page.waitForFunction(
      (y) => window.__game.getBlock!(11, y + 1, 40) === 5,
      floor,
      { timeout: 6_000 },
    );
    expect(await getBlock(page, 9, floor + 1, 40)).toBe(WATER);
  });
});
