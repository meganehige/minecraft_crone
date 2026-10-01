import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const STONE = 1;
const DIRT = 2;
const WOOD = 6;
const PLANKS = 8;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.shiftClickSlot, null, {
    timeout: 20_000,
  });
  await page.evaluate(() => window.__game.setMobSpawning!(false));
}

async function center(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Sprint 18: inventory shortcuts', () => {
  test('shift-click moves a stack between hotbar and main inventory', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.evaluate(() => window.__game.giveItem!(1, 20)); // stone -> slot 0

    expect(await page.evaluate(() => window.__game.getSlot!(0)?.item)).toBe(STONE);
    expect(await page.evaluate(() => window.__game.shiftClickSlot!(0))).toBe(true);
    expect(await page.evaluate(() => window.__game.getSlot!(0))).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(20);

    // And back again: from the main inventory it returns to the hotbar.
    expect(await page.evaluate(() => window.__game.shiftClickSlot!(9))).toBe(true);
    expect(await page.evaluate(() => window.__game.getSlot!(9))).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.count)).toBe(20);
    expect(errors).toEqual([]);
  });

  test('shift-click tops up a matching stack before taking an empty slot', async ({
    page,
  }) => {
    await boot(page);
    // 69 dirt fills hotbar slot 0 (64) and spills 5 into slot 1.
    await page.evaluate(() => window.__game.giveItem!(2, 69));
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.count)).toBe(64);
    expect(await page.evaluate(() => window.__game.getSlot!(1)?.count)).toBe(5);

    // Move the small stack over first, then the full one: it tops the small
    // stack up to 64 and only then spills the rest into the next empty slot.
    expect(await page.evaluate(() => window.__game.shiftClickSlot!(1))).toBe(true);
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(5);

    expect(await page.evaluate(() => window.__game.shiftClickSlot!(0))).toBe(true);
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(64);
    expect(await page.evaluate(() => window.__game.getSlot!(10)?.count)).toBe(5);
    expect(await page.evaluate(() => window.__game.getSlot!(0))).toBeNull();
    expect(await page.evaluate((d) => window.__game.getInventoryCount!(d), DIRT)).toBe(
      69,
    );
  });

  test('right-click splits a stack in half, then drops one at a time', async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(1, 11); // 11 stone in slot 0
      window.__game.toggleInventory!();
    });

    // Half, rounded up: 6 to the cursor, 5 left behind.
    await page.evaluate(() => window.__game.rightClickSlot!(0));
    expect(await page.evaluate(() => window.__game.getCursor!()?.count)).toBe(6);
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.count)).toBe(5);

    // With a full cursor, right-click drops exactly one into an empty slot.
    await page.evaluate(() => window.__game.rightClickSlot!(9));
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(1);
    expect(await page.evaluate(() => window.__game.getCursor!()?.count)).toBe(5);
    await page.evaluate(() => window.__game.rightClickSlot!(9));
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(2);
    expect(await page.evaluate(() => window.__game.getCursor!()?.count)).toBe(4);

    // Nothing was created or destroyed along the way.
    const total = await page.evaluate(() => {
      const inv = window.__game.getInventoryCount!(1);
      return inv + (window.__game.getCursor!()?.count ?? 0);
    });
    expect(total).toBe(11);
  });

  test('shift-click on the output crafts the whole grid at once', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.toggleInventory!();
      // One cell holding 16 logs; the shapeless recipe turns each into 4 planks.
      window.__game.setCraftCell!(0, 6, 16);
    });
    const out = await page.evaluate(() => window.__game.getCraftOutput!());
    expect(out?.item).toBe(PLANKS);
    expect(out?.count).toBe(4);

    const crafted = await page.evaluate(() => window.__game.craftAll!());
    expect(crafted, '16 logs x 4 planks').toBe(64);
    expect(await page.evaluate((p) => window.__game.getInventoryCount!(p), PLANKS)).toBe(
      64,
    );
    expect(await page.evaluate(() => window.__game.getCraftOutput!())).toBeNull();
    expect(await page.evaluate((w) => window.__game.getInventoryCount!(w), WOOD)).toBe(0);
  });

  test('shift+click and right-click work through the real UI', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(1, 8); // 8 stone in slot 0
      window.__game.toggleInventory!();
    });

    // Right-click the slot: 4 to the cursor, 4 left.
    const slot0 = await center(page, '[data-slot="0"]');
    await page.mouse.click(slot0.x, slot0.y, { button: 'right' });
    expect(await page.evaluate(() => window.__game.getCursor!()?.count)).toBe(4);
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.count)).toBe(4);

    // Put the cursor back down, then shift-click to bulk move the stack.
    await page.mouse.click(slot0.x, slot0.y);
    expect(await page.evaluate(() => window.__game.getCursor!())).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(0)?.count)).toBe(8);

    await page.keyboard.down('Shift');
    await page.mouse.click(slot0.x, slot0.y);
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => window.__game.getSlot!(0))).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(8);
    await page.screenshot({ path: 'test-results/sprint18.png' });
  });
});

test.describe('Sprint 18: touch long-press stands in for shift-click', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('holding a slot bulk-moves the stack', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(1, 12); // stone -> hotbar slot 0
      window.__game.toggleInventory!();
    });
    const slot = await center(page, '[data-slot="0"]');

    await page.dispatchEvent('[data-slot="0"]', 'pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      button: 0,
      bubbles: true,
      clientX: slot.x,
      clientY: slot.y,
    });
    // Hold past the long-press threshold, then let go.
    await page.waitForTimeout(600);
    await page.dispatchEvent('[data-slot="0"]', 'pointerup', {
      pointerId: 7,
      pointerType: 'touch',
      button: 0,
      bubbles: true,
      clientX: slot.x,
      clientY: slot.y,
    });

    expect(await page.evaluate(() => window.__game.getCursor!())).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(0))).toBeNull();
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.item)).toBe(STONE);
    expect(await page.evaluate(() => window.__game.getSlot!(9)?.count)).toBe(12);
  });
});
