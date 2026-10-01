import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const DIRT = 2;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.giveItem && !!window.__game.getItemEntityCount,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

test.describe('Sprint 10: drops, item entities & inventory', () => {
  test('mining a block drops a collectable item that fills the inventory', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // Dry platform high up (no water): dirt on a stone floor; aim down and mine.
    const h = await page.evaluate(() => {
      const py = 100;
      window.__game.setBlock!(8, py - 1, 8, 1); // stone floor
      window.__game.setBlock!(8, py, 8, 2); // dirt (drops itself)
      window.__game.teleport!(8.5, py + 3, 8.5);
      window.__game.setView!(0, -Math.PI / 2 + 0.0001);
      window.__game.setFrozen!(true);
      return py;
    });

    await page.evaluate(() => window.__game.setMining!(true));
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
      timeout: 8_000,
    });
    await page.evaluate(() => window.__game.setMining!(false));

    // A dropped item entity now exists.
    await page.waitForFunction(() => window.__game.getItemEntityCount!() > 0, null, {
      timeout: 2_000,
    });

    // Stand on the drop and unfreeze so it is collected.
    await page.evaluate(
      (y) => {
        window.__game.setFrozen!(false);
        window.__game.teleport!(8.5, y + 1, 8.5);
      },
      h,
    );
    await page.waitForFunction(() => window.__game.getInventoryCount!(2) >= 1, null, {
      timeout: 6_000,
    });
    expect(await page.evaluate(() => window.__game.getItemEntityCount!())).toBe(0);
    expect(errors).toEqual([]);
  });

  test('placing consumes from the inventory; empty cannot place', async ({
    page,
  }) => {
    await boot(page);
    // Dry high platform (no water): a floor block to place onto.
    const h = await page.evaluate(() => {
      const py = 100;
      window.__game.setBlock!(20, py, 20, 1); // stone floor
      window.__game.teleport!(20.5, py + 3, 20.5);
      window.__game.setView!(0, -Math.PI / 2 + 0.0001);
      window.__game.setFrozen!(true);
      return py;
    });

    // Empty hotbar slot -> cannot place.
    await page.evaluate(() => window.__game.selectSlot!(0));
    expect(await page.evaluate(() => window.__game.placeBlock!())).toBe(false);

    // Give dirt, select it, place onto the floor's top face -> count -1.
    await page.evaluate(() => {
      window.__game.giveItem!(2, 3);
      window.__game.setActiveBlock!(2);
    });
    const before = await page.evaluate(() => window.__game.getInventoryCount!(2));
    expect(await page.evaluate(() => window.__game.placeBlock!())).toBe(true);
    const after = await page.evaluate(() => window.__game.getInventoryCount!(2));
    expect(after).toBe(before - 1);
    expect(await page.evaluate((y) => window.__game.getBlock!(20, y + 1, 20), h)).toBe(
      DIRT,
    );
  });

  test('inventory screen toggles and stacks items', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__game.giveItem!(1, 80)); // > one stack
    // 80 stone => 64 + 16 across two slots.
    expect(await page.evaluate(() => window.__game.getInventoryCount!(1))).toBe(80);

    expect(await page.evaluate(() => window.__game.isInventoryOpen!())).toBe(false);
    await page.evaluate(() => window.__game.toggleInventory!());
    expect(await page.evaluate(() => window.__game.isInventoryOpen!())).toBe(true);
    await expect(page.locator('[data-testid="inventory-screen"]')).toBeVisible();
    await page.screenshot({ path: 'test-results/sprint10.png' });
    await page.evaluate(() => window.__game.toggleInventory!());
    expect(await page.evaluate(() => window.__game.isInventoryOpen!())).toBe(false);
  });
});
