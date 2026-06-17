import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const worldInfo = (page: Page) =>
  page.evaluate(() => window.__game.getWorldInfo!());

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.getWorldInfo, null, {
    timeout: 20_000,
  });
}

test.describe('Sprint 3: procedural multi-chunk world', () => {
  test('streams multiple chunks around the player', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // Wait for the surrounding chunks to finish generating + meshing.
    await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
      timeout: 25_000,
    });

    const info = await worldInfo(page);
    expect(info.loadedChunks, 'many chunks loaded').toBeGreaterThan(9);

    // Vantage point looking out over the landscape for a representative shot.
    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(8, 8);
      window.__game.teleport!(8, h + 30, 8);
      window.__game.setView!(0.7, -0.45);
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: 'test-results/sprint3.png' });
    expect(errors).toEqual([]);
  });

  test('generation is deterministic for the same seed', async ({ page }) => {
    await boot(page);
    const h1 = await page.evaluate(() => ({
      seed: window.__game.getWorldInfo!().seed,
      a: window.__game.surfaceHeight!(12, -7),
      b: window.__game.surfaceHeight!(40, 33),
    }));

    await page.reload();
    await boot(page);
    const h2 = await page.evaluate(() => ({
      seed: window.__game.getWorldInfo!().seed,
      a: window.__game.surfaceHeight!(12, -7),
      b: window.__game.surfaceHeight!(40, 33),
    }));

    expect(h2.seed).toBe(h1.seed);
    expect(h2.a).toBe(h1.a);
    expect(h2.b).toBe(h1.b);
  });

  test('player rests on generated terrain', async ({ page }) => {
    await boot(page);
    const h = await page.evaluate(() => window.__game.surfaceHeight!(0, 0));
    await page.evaluate((y) => window.__game.teleport!(0.5, y, 0.5), h + 8);
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });
    const p = await page.evaluate(() => window.__game.getPlayer!());
    expect(Math.abs(p.y - (h + 1))).toBeLessThan(0.8);
  });
});
