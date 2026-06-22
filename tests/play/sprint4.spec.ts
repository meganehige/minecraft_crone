import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const AIR = 0;
const STONE = 1;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.raycast && !!window.__game.getBlock,
    null,
    { timeout: 20_000 },
  );
}

// Look straight down from above a block centre.
async function aimDown(page: Page): Promise<number> {
  return page.evaluate(() => {
    const h = window.__game.surfaceHeight!(8, 8);
    window.__game.teleport!(8.5, h + 3, 8.5);
    window.__game.setView!(0, -Math.PI / 2 + 0.0001);
    window.__game.setFrozen!(true); // keep the player still while we interact
    return h;
  });
}

test.describe('Sprint 4: block break & place', () => {
  test('raycast hits the ground below', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    const h = await aimDown(page);

    const hit = await page.evaluate(() => window.__game.raycast!());
    expect(hit).not.toBeNull();
    expect(hit!.x).toBe(8);
    expect(hit!.z).toBe(8);
    expect(hit!.y).toBe(h);
    expect(hit!.ny, 'hit the top face').toBe(1);
    expect(errors).toEqual([]);
  });

  test('breaks the targeted block', async ({ page }) => {
    await boot(page);
    const h = await aimDown(page);

    const before = await page.evaluate(
      (y) => window.__game.getBlock!(8, y, 8),
      h,
    );
    expect(before).not.toBe(AIR);

    const removed = await page.evaluate(() => window.__game.breakBlock!());
    expect(removed).toBe(true);

    const after = await page.evaluate((y) => window.__game.getBlock!(8, y, 8), h);
    expect(after).toBe(AIR);
  });

  test('places the active block against a face', async ({ page }) => {
    await boot(page);
    const h = await aimDown(page);

    // Break the top block so the ray now hits y=h-1; placing fills y=h.
    await page.evaluate(() => window.__game.breakBlock!());
    await page.evaluate(() => {
      window.__game.giveItem!(1, 10); // stone into inventory
      window.__game.setActiveBlock!(1);
    });

    const placed = await page.evaluate(() => window.__game.placeBlock!());
    expect(placed).toBe(true);

    const block = await page.evaluate((y) => window.__game.getBlock!(8, y, 8), h);
    expect(block).toBe(STONE);

    // Let the chunk remesh, then capture.
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/sprint4.png' });
  });
});
