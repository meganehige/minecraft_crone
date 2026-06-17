import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const STONE = 1;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.getLight && !!window.__game.setBlock,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

test.describe('Sprint 5: flood-fill lighting', () => {
  test('open sky is fully lit', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    const light = await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(8, 8);
      return window.__game.getLight!(8, h + 1, 8);
    });
    expect(light, 'air above the surface sees full sky').toBe(15);
    expect(errors).toEqual([]);
  });

  test('placing a roof casts shade below (sky occlusion + BFS)', async ({
    page,
  }) => {
    await boot(page);

    const before = await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(8, 8);
      return { h, light: window.__game.getLight!(8, h + 1, 8) };
    });
    expect(before.light).toBe(15);

    // Roof directly above the sampled cell, then wait for relight + remesh.
    await page.evaluate(
      ([h, id]) => window.__game.setBlock!(8, h + 2, 8, id),
      [before.h, STONE] as const,
    );
    await page.waitForFunction(
      (h) => window.__game.getLight!(8, h + 1, 8) < 15,
      before.h,
      { timeout: 8_000 },
    );

    const after = await page.evaluate(
      (h) => window.__game.getLight!(8, h + 1, 8),
      before.h,
    );
    // No longer direct sky (so < 15), but still lit by horizontal neighbours.
    expect(after).toBeLessThan(15);
    expect(after).toBeGreaterThan(0);
  });

  test('deep underground is dark', async ({ page }) => {
    await boot(page);
    const light = await page.evaluate(() => window.__game.getLight!(8, 3, 8));
    expect(light, 'sky light does not reach deep stone').toBe(0);
  });

  test('renders shaded terrain', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(8, 8);
      window.__game.teleport!(8, h + 30, 8);
      window.__game.setView!(0.7, -0.45);
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: 'test-results/sprint5.png' });
  });
});
