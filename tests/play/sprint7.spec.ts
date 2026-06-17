import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const WOOD = 6;
const LEAVES = 7;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.setDaylight && !!window.__game.sampleBrightness,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

test.describe('Sprint 7: trees & day/night', () => {
  test('generates trees (wood trunks + leaf canopies)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    const counts = await page.evaluate(
      ([wood, leaves]) => {
        let w = 0;
        let l = 0;
        for (let x = -30; x <= 30; x++) {
          for (let z = -30; z <= 30; z++) {
            for (let y = 28; y <= 90; y++) {
              const b = window.__game.getBlock!(x, y, z);
              if (b === wood) w++;
              else if (b === leaves) l++;
            }
          }
        }
        return { w, l };
      },
      [WOOD, LEAVES],
    );

    expect(counts.w, 'some wood generated').toBeGreaterThan(0);
    expect(counts.l, 'some leaves generated').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('day is brighter than night', async ({ page }) => {
    await boot(page);

    // Look at the terrain from a fixed vantage so the framebuffer is stable.
    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(8, 8);
      window.__game.teleport!(8, h + 20, 8);
      window.__game.setView!(0.7, -0.4);
      window.__game.setFrozen!(true);
    });

    await page.evaluate(() => window.__game.setDaylight!(1));
    await page.waitForTimeout(120);
    const day = await page.evaluate(() => window.__game.sampleBrightness!());
    await page.screenshot({ path: 'test-results/sprint7-day.png' });

    await page.evaluate(() => window.__game.setDaylight!(0));
    await page.waitForTimeout(120);
    const night = await page.evaluate(() => window.__game.sampleBrightness!());
    await page.screenshot({ path: 'test-results/sprint7-night.png' });

    expect(day, 'daytime is well lit').toBeGreaterThan(0.4);
    expect(night, 'night is dark').toBeLessThan(day - 0.2);
  });
});
