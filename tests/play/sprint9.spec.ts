import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const AIR = 0;
const STONE = 1;
const DIRT = 2;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__game?.setMining && !!window.__game.getMining,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

// Put a block at (8,h,8), stand at the block centre above it, look straight
// down, and freeze the player. Returns the surface height h.
async function aimAt(page: Page, id: number): Promise<number> {
  return page.evaluate((blockId) => {
    const h = window.__game.surfaceHeight!(8, 8);
    window.__game.setBlock!(8, h, 8, blockId);
    window.__game.teleport!(8.5, h + 3, 8.5);
    window.__game.setView!(0, -Math.PI / 2 + 0.0001);
    window.__game.setFrozen!(true);
    return h;
  }, id);
}

test.describe('Sprint 9: timed mining, cracks & sound', () => {
  test('mining is not instant and completes after the break time', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    const h = await aimAt(page, STONE);

    await page.evaluate(() => window.__game.setMining!(true));
    // Shortly after starting, the block is still there and progress is partial.
    await page.waitForTimeout(150);
    const mid = await page.evaluate(() => window.__game.getMining!());
    expect(await getBlock(page, 8, h, 8), 'not broken instantly').toBe(STONE);
    expect(mid.progress).toBeGreaterThan(0);
    expect(mid.progress).toBeLessThan(1);

    // Eventually it breaks (stone hardness 1.5 -> ~2.25s).
    await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
      timeout: 8_000,
    });
    await page.evaluate(() => window.__game.setMining!(false));
    expect(errors).toEqual([]);
  });

  test('harder blocks take longer to mine', async ({ page }) => {
    await boot(page);
    // Compare full break durations: stone (hardness 1.5) vs dirt (0.5).
    const dirtMs = await timeBreak(page, DIRT);
    const stoneMs = await timeBreak(page, STONE);
    expect(stoneMs).toBeGreaterThan(dirtMs);
  });

  test('mining shows cracking stages and plays sounds', async ({ page }) => {
    await boot(page);
    await aimAt(page, STONE);

    const before = await page.evaluate(() => window.__game.getSoundCounts!());
    await page.evaluate(() => window.__game.setMining!(true));

    // A crack stage becomes visible during mining.
    await page.waitForFunction(() => window.__game.getMining!().stage >= 0, null, {
      timeout: 3_000,
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'test-results/sprint9-cracks.png' });

    // Let it finish so a break sound fires.
    await page.waitForFunction(() => window.__game.getMining!().target === null, null, {
      timeout: 8_000,
    });
    await page.evaluate(() => window.__game.setMining!(false));

    const after = await page.evaluate(() => window.__game.getSoundCounts!());
    expect(after.dig, 'dig sounds fired while mining').toBeGreaterThan(before.dig);
    expect(after.break, 'break sound fired on completion').toBeGreaterThan(
      before.break,
    );
  });

  test('placing a block plays a place sound', async ({ page }) => {
    await boot(page);
    const h = await aimAt(page, AIR); // clear the cell so we hit below
    // Aim at the block below and place onto its top face.
    const before = await page.evaluate(() => window.__game.getSoundCounts!());
    const placed = await page.evaluate(() => {
      window.__game.setActiveBlock!(1); // stone
      return window.__game.placeBlock!();
    });
    expect(placed).toBe(true);
    const after = await page.evaluate(() => window.__game.getSoundCounts!());
    expect(after.place).toBeGreaterThan(before.place);
    void h;
  });
});

// Mine a freshly placed block of the given type and return the elapsed ms.
async function timeBreak(page: Page, id: number): Promise<number> {
  const h = await aimAt(page, id);
  const start = Date.now();
  await page.evaluate(() => window.__game.setMining!(true));
  // Completion = the targeted block actually became air.
  await page.waitForFunction((y) => window.__game.getBlock!(8, y, 8) === 0, h, {
    timeout: 10_000,
  });
  await page.evaluate(() => window.__game.setMining!(false));
  return Date.now() - start;
}

function getBlock(page: Page, x: number, y: number, z: number): Promise<number> {
  return page.evaluate(
    ([px, py, pz]) => window.__game.getBlock!(px, py, pz),
    [x, y, z],
  );
}
