import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const STONE = 1;
const PLANKS = 8;
const STICK = 100;
const WOOD_PICKAXE = 110;
const STONE_PICKAXE = 111;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.getHeldDurability && !!window.__game.setMining,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

// Build a dry platform high up, put a stone on it, aim down at it. Returns Y.
const PLATFORM_Y = 100;
async function aimStone(page: Page): Promise<number> {
  return page.evaluate((py) => {
    window.__game.setBlock!(8, py - 1, 8, 1); // floor
    window.__game.setBlock!(8, py, 8, 1); // stone target
    window.__game.teleport!(8.5, py + 3, 8.5);
    window.__game.setView!(0, -Math.PI / 2 + 0.0001);
    window.__game.setFrozen!(true);
    return py;
  }, PLATFORM_Y);
}

async function mineUntilGone(page: Page, h: number): Promise<number> {
  const start = Date.now();
  await page.evaluate(() => window.__game.setMining!(true));
  await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
    timeout: 12_000,
  });
  await page.evaluate(() => window.__game.setMining!(false));
  return Date.now() - start;
}

test.describe('Sprint 12: tool tiers & durability', () => {
  test('stone needs a pickaxe to drop (hand yields nothing)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    // Hand mining: breaks but drops nothing.
    let h = await aimStone(page);
    await page.evaluate(() => window.__game.selectSlot!(0)); // empty hand
    await mineUntilGone(page, h);
    expect(await page.evaluate(() => window.__game.getItemEntityCount!())).toBe(0);

    // With a stone pickaxe: drops cobblestone.
    await page.evaluate(() => {
      window.__game.giveItem!(111, 1); // stone pickaxe -> slot 0
      window.__game.selectSlot!(0);
    });
    h = await aimStone(page);
    await mineUntilGone(page, h);
    await page.waitForFunction(() => window.__game.getItemEntityCount!() > 0, null, {
      timeout: 2_000,
    });
    expect(errors).toEqual([]);
  });

  test('correct tool mines faster than hand', async ({ page }) => {
    await boot(page);

    let h = await aimStone(page);
    await page.evaluate(() => window.__game.selectSlot!(0));
    const handMs = await mineUntilGone(page, h);

    await page.evaluate(() => {
      window.__game.giveItem!(111, 1);
      window.__game.selectSlot!(0);
    });
    h = await aimStone(page);
    const toolMs = await mineUntilGone(page, h);

    expect(toolMs).toBeLessThan(handMs);
  });

  test('mining consumes one tool durability', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.giveItem!(111, 1);
      window.__game.selectSlot!(0);
    });
    const d0 = await page.evaluate(() => window.__game.getHeldDurability!());
    expect(d0).toBe(131); // stone tier durability

    const h = await aimStone(page);
    await mineUntilGone(page, h);
    const d1 = await page.evaluate(() => window.__game.getHeldDurability!());
    expect(d1).toBe(d0! - 1);
  });

  test('crafts a wooden pickaxe (3x3: planks + sticks)', async ({ page }) => {
    await boot(page);
    const out = await page.evaluate(
      ([planks, stick]) => {
        window.__game.setCraftSize!(3);
        // top row planks, middle column sticks
        window.__game.setCraftCell!(0, planks);
        window.__game.setCraftCell!(1, planks);
        window.__game.setCraftCell!(2, planks);
        window.__game.setCraftCell!(4, stick);
        window.__game.setCraftCell!(7, stick);
        return window.__game.getCraftOutput!();
      },
      [PLANKS, STICK],
    );
    expect(out).toEqual({ item: WOOD_PICKAXE, count: 1 });
    void STONE;
    void STONE_PICKAXE;
  });
});
