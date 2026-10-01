import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const COAL_ORE = 14;
const BEDROCK = 18;
const ITEM_COAL = 101;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.countBlocks, null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 30_000,
  });
}

test.describe('Sprint 16: ores, caves & bedrock', () => {
  test('bedrock floors the world and is unbreakable', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // Every column in the spawn chunk is bedrock at y=0 and not at y=1.
    const counts = await page.evaluate(() => ({
      floor: window.__game.countBlocks!(18, 0, 0, 0, 15, 0, 15),
      above: window.__game.countBlocks!(18, 0, 1, 0, 15, 1, 15),
    }));
    expect(counts.floor).toBe(16 * 16);
    expect(counts.above).toBe(0);

    // Aim at a bedrock block from inside the world and try to mine it.
    await page.evaluate(() => {
      window.__game.setBlock!(8, 1, 8, 0); // clear the cell above
      window.__game.setBlock!(8, 2, 8, 0);
      window.__game.teleport!(8.5, 2, 8.5);
      window.__game.setView!(0, -Math.PI / 2 + 0.0001);
      window.__game.setFrozen!(true);
      window.__game.setMining!(true);
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__game.setMining!(false));
    expect(await page.evaluate(() => window.__game.getBlock!(8, 0, 8))).toBe(BEDROCK);
    expect(errors).toEqual([]);
  });

  test('ores are generated in their depth bands', async ({ page }) => {
    await boot(page);
    // Scan a 3x3-chunk slab of the underground around spawn.
    const found = await page.evaluate(() => ({
      coal: window.__game.countBlocks!(14, -16, 2, -16, 31, 52, 31),
      iron: window.__game.countBlocks!(15, -16, 2, -16, 31, 40, 31),
      gold: window.__game.countBlocks!(16, -16, 2, -16, 31, 28, 31),
      diamond: window.__game.countBlocks!(17, -16, 1, -16, 31, 15, 31),
      // Diamond must not appear up near the surface.
      diamondHigh: window.__game.countBlocks!(17, -16, 30, -16, 31, 60, 31),
      goldHigh: window.__game.countBlocks!(16, -16, 40, -16, 31, 60, 31),
    }));
    expect(found.coal, 'coal ore present').toBeGreaterThan(0);
    expect(found.iron, 'iron ore present').toBeGreaterThan(0);
    expect(found.gold, 'gold ore present').toBeGreaterThan(0);
    expect(found.diamond, 'diamond ore present').toBeGreaterThan(0);
    // Rarity ordering: coal is the most common of the four.
    expect(found.coal).toBeGreaterThan(found.diamond);
    expect(found.diamondHigh).toBe(0);
    expect(found.goldHigh).toBe(0);
  });

  test('caves hollow out the underground without breaching the surface', async ({
    page,
  }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      const x0 = -16;
      const x1 = 31;
      const z0 = -16;
      const z1 = 31;
      const air = window.__game.countBlocks!(0, x0, 6, z0, x1, 24, z1);
      const total = (x1 - x0 + 1) * (24 - 6 + 1) * (z1 - z0 + 1);
      // Surface columns must still be solid right under the top block.
      let breached = 0;
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          const h = window.__game.surfaceHeight!(x, z);
          for (let d = 0; d < 5; d++) {
            if (window.__game.getBlock!(x, h - d, z) === 0) breached++;
          }
        }
      }
      return { air, total, breached };
    });
    // Some underground air, but nowhere near everything.
    expect(r.air, 'caves carved some air').toBeGreaterThan(0);
    expect(r.air / r.total, 'caves are sparse').toBeLessThan(0.35);
    expect(r.breached, 'surface shell intact').toBe(0);
  });

  test('mining coal ore drops coal, and needs a pickaxe', async ({ page }) => {
    await boot(page);
    // Dry platform high up: a coal ore block on a stone floor.
    const h = await page.evaluate(() => {
      const py = 100;
      window.__game.setBlock!(8, py - 1, 8, 1);
      window.__game.setBlock!(8, py, 8, 14); // coal ore
      window.__game.teleport!(8.5, py + 3, 8.5);
      window.__game.setView!(0, -Math.PI / 2 + 0.0001);
      window.__game.setFrozen!(true);
      return py;
    });

    // Bare-handed: the block breaks but nothing drops (requiresTool).
    await page.evaluate(() => window.__game.setMining!(true));
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
      timeout: 15_000,
    });
    await page.evaluate(() => window.__game.setMining!(false));
    expect(await page.evaluate(() => window.__game.getItemEntityCount!())).toBe(0);

    // With a wooden pickaxe it drops a coal item.
    await page.evaluate((y) => {
      window.__game.setBlock!(8, y, 8, 14);
      window.__game.giveItem!(110, 1); // wooden pickaxe
      window.__game.setActiveBlock!(110);
      window.__game.setMining!(true);
    }, h);
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
      timeout: 15_000,
    });
    await page.evaluate(() => window.__game.setMining!(false));
    await page.waitForFunction(() => window.__game.getItemEntityCount!() > 0, null, {
      timeout: 3_000,
    });

    // Collect it: the drop is coal (an item), not the ore block.
    await page.evaluate((y) => {
      window.__game.setFrozen!(false);
      window.__game.teleport!(8.5, y + 1, 8.5);
    }, h);
    await page.waitForFunction(
      (coal) => window.__game.getInventoryCount!(coal) >= 1,
      ITEM_COAL,
      { timeout: 6_000 },
    );
    expect(
      await page.evaluate((ore) => window.__game.getInventoryCount!(ore), COAL_ORE),
      'the ore block itself never drops',
    ).toBe(0);
  });

  test('diamond tools can be crafted from mined diamonds', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(104, 3); // diamonds
      window.__game.giveItem!(100, 2); // sticks
      window.__game.toggleInventory!();
      window.__game.setCraftSize!(3);
      const D = 104;
      const S = 100;
      [D, D, D, null, S, null, null, S, null].forEach((v, i) =>
        window.__game.setCraftCell!(i, v),
      );
    });
    const out = await page.evaluate(() => window.__game.getCraftOutput!());
    expect(out?.item).toBe(113); // diamond pickaxe
    expect(await page.evaluate(() => window.__game.takeCraftOutput!())).toBe(true);
    expect(await page.evaluate(() => window.__game.getCursor!()?.item)).toBe(113);
  });
});
