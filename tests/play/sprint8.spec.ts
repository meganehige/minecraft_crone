import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Emulate a touch phone so the on-screen controls activate.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

const AIR = 0;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.getPlayer, null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

test.describe('Sprint 8: mobile touch controls', () => {
  test('shows the on-screen touch UI', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await expect(page.locator('[data-testid="touch-ui"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-break"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-place"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-jump"]')).toBeVisible();
    await page.screenshot({ path: 'test-results/sprint8.png' });
    expect(errors).toEqual([]);
  });

  test('break button removes the targeted block', async ({ page }) => {
    await boot(page);
    const h = await page.evaluate(() => {
      const sh = window.__game.surfaceHeight!(8, 8);
      window.__game.teleport!(8.5, sh + 3, 8.5);
      window.__game.setView!(0, -Math.PI / 2 + 0.0001);
      window.__game.setFrozen!(true);
      return sh;
    });

    expect(await getBlock(page, 8, h, 8)).not.toBe(AIR);
    await page.dispatchEvent('[data-testid="btn-break"]', 'pointerdown', {
      pointerId: 1,
      button: 0,
      bubbles: true,
    });
    expect(await getBlock(page, 8, h, 8)).toBe(AIR);
  });

  test('jump button makes the player jump', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const sh = window.__game.surfaceHeight!(8, 8);
      window.__game.teleport!(8.5, sh + 3, 8.5);
    });
    await page.waitForFunction(() => window.__game.getPlayer!().onGround, null, {
      timeout: 10_000,
    });

    await page.dispatchEvent('[data-testid="btn-jump"]', 'pointerdown', {
      pointerId: 2,
      button: 0,
      bubbles: true,
    });
    await page.waitForFunction(() => window.__game.getPlayer!().vy > 1, null, {
      timeout: 3_000,
    });
  });

  test('joystick drag drives movement intent', async ({ page }) => {
    await boot(page);
    // Touch the left zone, then drag upward -> forward.
    await page.dispatchEvent('[data-testid="touch-ui"]', 'pointerdown', {
      pointerId: 5,
      clientX: 60,
      clientY: 620,
      bubbles: true,
    });
    await page.dispatchEvent('body', 'pointermove', {
      pointerId: 5,
      clientX: 60,
      clientY: 520,
      bubbles: true,
    });
    expect(await page.evaluate(() => window.__game.input!.forward)).toBe(true);

    await page.dispatchEvent('body', 'pointerup', {
      pointerId: 5,
      clientX: 60,
      clientY: 520,
      bubbles: true,
    });
    expect(await page.evaluate(() => window.__game.input!.forward)).toBe(false);
  });
});

function getBlock(page: Page, x: number, y: number, z: number): Promise<number> {
  return page.evaluate(
    ([px, py, pz]) => window.__game.getBlock!(px, py, pz),
    [x, y, z],
  );
}
