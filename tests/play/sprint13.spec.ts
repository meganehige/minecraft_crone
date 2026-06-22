import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.getHealth && !!window.__game.setCreative,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
  await page.evaluate(() => window.__game.setCreative!(false));
}

test.describe('Sprint 13: survival (health, hunger, damage)', () => {
  test('takes fall damage on a hard landing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(0, 0);
      window.__game.setHealth!(20);
      window.__game.teleport!(0.5, h + 10, 0.5); // ~10 block fall
    });
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });
    const hp = await page.evaluate(() => window.__game.getHealth!());
    expect(hp).toBeLessThan(20);
    expect(hp).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('creative mode takes no fall damage', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.setCreative!(true);
      const h = window.__game.surfaceHeight!(0, 0);
      window.__game.teleport!(0.5, h + 20, 0.5);
    });
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });
    expect(await page.evaluate(() => window.__game.getHealth!())).toBe(20);
  });

  test('starves when hunger is empty', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.setHealth!(20);
      window.__game.setHunger!(0);
    });
    await page.waitForFunction(() => window.__game.getHealth!() < 20, null, {
      timeout: 9_000,
    });
  });

  test('regenerates health when well fed', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.setHealth!(10);
      window.__game.setHunger!(20);
    });
    await page.waitForFunction(() => window.__game.getHealth!() > 10, null, {
      timeout: 6_000,
    });
  });

  test('dying respawns the player at spawn with full health', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(40, 40);
      window.__game.teleport!(40.5, h + 2, 40.5);
    });
    await page.evaluate(() => window.__game.damagePlayer!(100));
    await page.waitForFunction(() => window.__game.getPlayer!().x < 5, null, {
      timeout: 5_000,
    });
    expect(await page.evaluate(() => window.__game.getHealth!())).toBe(20);
    expect(await page.evaluate(() => window.__game.isAlive!())).toBe(true);
  });
});
