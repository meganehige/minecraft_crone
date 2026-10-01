import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const STONE = 1;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.getSlot && !!window.__game.toggleInventory,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

async function center(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Sprint 15: inventory UX (icons & drag)', () => {
  test('slots show item icons (background image)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(1, 5); // stone -> hotbar slot 0
      window.__game.toggleInventory!();
    });
    const bg = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-slot="0"]')!).backgroundImage,
    );
    expect(bg).toContain('url(');
    expect(bg).toContain('data:image'); // the procedurally-built atlas
    expect(errors).toEqual([]);
  });

  test('drag moves a stack from one slot to another', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(1, 5); // stone -> slot 0
      window.__game.toggleInventory!();
    });
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.item)).toBe(STONE);
    expect(await page.evaluate(() => window.__game.getSlot!(9))).toBeNull();

    // Drag from slot 0 to slot 9 (a main-inventory slot) via pointer events.
    const src = await center(page, '[data-slot="0"]');
    const dst = await center(page, '[data-slot="9"]');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move((src.x + dst.x) / 2, (src.y + dst.y) / 2);
    await page.mouse.move(dst.x, dst.y);
    await page.mouse.up();

    expect(await page.evaluate(() => window.__game.getSlot!(0))).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.item)).toBe(STONE);
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(5);
  });
});
