import { test, expect } from '@playwright/test';

const player = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__game.getPlayer!());

test.describe('Sprint 2: first-person movement & physics', () => {
  test('falls under gravity and lands on the ground', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.waitForFunction(() => !!window.__game?.getPlayer, null, {
      timeout: 20_000,
    });

    // Drop from above the centre of the hill (top solid block y=8 -> rest y≈9).
    await page.evaluate(() => window.__game.teleport!(8, 14, 8));
    await page.waitForFunction(
      () => window.__game.getPlayer!().onGround === true,
      null,
      { timeout: 10_000 },
    );

    const p = await player(page);
    expect(p.y, 'rests on the hill top').toBeGreaterThan(8.8);
    expect(p.y).toBeLessThan(9.4);
    expect(errors).toEqual([]);
  });

  test('does not fall through the ground and can walk', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game?.getPlayer, null, {
      timeout: 20_000,
    });

    await page.evaluate(() => {
      window.__game.setView!(0, 0); // face -Z
      window.__game.teleport!(8, 14, 8);
    });
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });

    const before = await player(page);
    await page.evaluate(() => {
      window.__game.input!.forward = true;
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__game.input!.forward = false;
    });
    const after = await player(page);

    // Forward (yaw 0) moves toward -Z.
    expect(after.z, 'moved forward in -Z').toBeLessThan(before.z - 0.5);
    expect(Math.abs(after.x - before.x), 'no sideways drift').toBeLessThan(0.4);
    // Never tunnelled below the world.
    expect(after.y).toBeGreaterThan(1);
  });

  test('can jump when grounded', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game?.getPlayer, null, {
      timeout: 20_000,
    });

    await page.evaluate(() => {
      window.__game.setView!(0, 0);
      window.__game.teleport!(8, 14, 8);
    });
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });
    const restY = (await player(page)).y;

    await page.evaluate(() => {
      window.__game.input!.jump = true;
    });
    // Upward velocity should appear within a few ticks.
    await page.waitForFunction(() => window.__game.getPlayer!().vy > 1, null, {
      timeout: 3_000,
    });
    await page.evaluate(() => {
      window.__game.input!.jump = false;
    });

    // Lands back on the ground at roughly the same height.
    await page.waitForFunction(
      (y) => {
        const p = window.__game.getPlayer!();
        return p.onGround && Math.abs(p.y - y) < 0.3;
      },
      restY,
      { timeout: 5_000 },
    );

    await page.screenshot({ path: 'test-results/sprint2.png' });
  });
});
