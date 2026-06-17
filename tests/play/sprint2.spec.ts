import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const player = (page: Page) => page.evaluate(() => window.__game.getPlayer!());
const surfaceAt = (page: Page, x: number, z: number) =>
  page.evaluate(([px, pz]) => window.__game.surfaceHeight!(px, pz), [x, z]);

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.getPlayer && !!window.__game.surfaceHeight,
    null,
    { timeout: 20_000 },
  );
}

test.describe('Sprint 2: first-person movement & physics', () => {
  test('falls under gravity and lands on the surface', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // Stand at a block centre so the footprint stays within one column.
    const h = await surfaceAt(page, 8, 8);
    await page.evaluate((y) => window.__game.teleport!(8.5, y, 8.5), h + 8);
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });

    const p = await player(page);
    // Feet rest on top of the highest solid block (surface + 1).
    expect(Math.abs(p.y - (h + 1))).toBeLessThan(0.6);
    expect(errors).toEqual([]);
  });

  test('walks horizontally without tunnelling', async ({ page }) => {
    await boot(page);
    const h = await surfaceAt(page, 8, 8);
    await page.evaluate((y) => {
      window.__game.setView!(0, 0); // face -Z
      window.__game.teleport!(8, y, 8);
    }, h + 10);

    const before = await player(page);
    await page.evaluate(() => {
      window.__game.input!.forward = true;
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__game.input!.forward = false;
    });
    const after = await player(page);

    expect(after.z, 'moved forward in -Z').toBeLessThan(before.z - 0.5);
    expect(Math.abs(after.x - before.x), 'no sideways drift').toBeLessThan(0.4);
    expect(after.y).toBeGreaterThan(1);
  });

  test('can jump when grounded', async ({ page }) => {
    await boot(page);
    const h = await surfaceAt(page, 8, 8);
    await page.evaluate((y) => {
      window.__game.setView!(0, 0);
      window.__game.teleport!(8.5, y, 8.5);
    }, h + 8);
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });
    const restY = (await player(page)).y;

    await page.evaluate(() => {
      window.__game.input!.jump = true;
    });
    await page.waitForFunction(() => window.__game.getPlayer!().vy > 1, null, {
      timeout: 3_000,
    });
    await page.evaluate(() => {
      window.__game.input!.jump = false;
    });

    await page.waitForFunction(
      (y) => {
        const p = window.__game.getPlayer!();
        return p.onGround && Math.abs(p.y - y) < 0.4;
      },
      restY,
      { timeout: 5_000 },
    );
  });
});
