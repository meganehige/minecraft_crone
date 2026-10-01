import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const PORKCHOP = 107;
const COOKED_PORKCHOP = 108;
const COAL = 101;
const DIAMOND_AXE = 123;

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game?.spawnMob, null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 30_000,
  });
  // Scripted tests own the mob list: no natural spawns, nothing left over.
  await page.evaluate(() => {
    window.__game.setMobSpawning!(false);
    window.__game.clearMobs!();
  });
}

/** A dry 17x17 stone platform high above the terrain, player at its centre. */
async function platform(page: Page): Promise<number> {
  return page.evaluate(() => {
    const py = 100;
    for (let x = 0; x <= 16; x++) {
      for (let z = 0; z <= 16; z++) window.__game.setBlock!(x, py, z, 1);
    }
    window.__game.teleport!(8.5, py + 1, 8.5);
    window.__game.setView!(0, 0);
    window.__game.setFrozen!(true);
    return py;
  });
}

test.describe('Sprint 17: mobs & food', () => {
  test('mobs can be spawned and are tracked', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    const y = await platform(page);

    await page.evaluate((py) => {
      window.__game.spawnMob!('pig', 6.5, py + 1, 6.5);
      window.__game.spawnMob!('zombie', 11.5, py + 1, 11.5);
    }, y);

    expect(await page.evaluate(() => window.__game.getMobCount!())).toBe(2);
    const mobs = await page.evaluate(() => window.__game.getMobs!());
    expect(mobs.map((m) => m.type).sort()).toEqual(['pig', 'zombie']);
    expect(mobs.find((m) => m.type === 'pig')!.health).toBe(10);
    expect(mobs.find((m) => m.type === 'zombie')!.health).toBe(20);
    await page.screenshot({ path: 'test-results/sprint17.png' });
    expect(errors).toEqual([]);
  });

  test('a zombie chases the player; a pig does not', async ({ page }) => {
    await boot(page);
    const y = await platform(page);

    const start = await page.evaluate((py) => {
      window.__game.spawnMob!('zombie', 8.5, py + 1, 15.5);
      window.__game.spawnMob!('pig', 1.5, py + 1, 8.5);
      return window.__game.getMobs!().map((m) => ({ type: m.type, z: m.z, x: m.x }));
    }, y);
    expect(start).toHaveLength(2);

    // The zombie closes the ~7 block gap; the player is frozen in place.
    await page.waitForFunction(
      () => {
        const z = window.__game.getMobs!().find((m) => m.type === 'zombie');
        return !!z && Math.hypot(z.x - 8.5, z.z - 8.5) < 3;
      },
      null,
      { timeout: 15_000 },
    );

    // The pig wandered at most a little; it never beelines for the player.
    const pig = await page.evaluate(
      () => window.__game.getMobs!().find((m) => m.type === 'pig')!,
    );
    expect(Math.hypot(pig.x - 8.5, pig.z - 8.5)).toBeGreaterThan(3);
  });

  test('a zombie damages the player on contact', async ({ page }) => {
    await boot(page);
    const y = await platform(page);
    await page.evaluate((py) => {
      window.__game.setHealth!(20);
      window.__game.spawnMob!('zombie', 9.5, py + 1, 8.5);
    }, y);

    await page.waitForFunction(() => window.__game.getHealth!() < 20, null, {
      timeout: 10_000,
    });
    expect(await page.evaluate(() => window.__game.getHealth!())).toBeLessThan(20);
  });

  test('punching a pig kills it and drops porkchop', async ({ page }) => {
    await boot(page);
    const y = await platform(page);
    await page.evaluate((py) => {
      window.__game.giveItem!(123, 1); // diamond axe: 1 + tier 4 = 5 damage
      window.__game.setActiveBlock!(123);
      window.__game.spawnMob!('pig', 8.5, py + 1, 6.5);
    }, y);
    expect(await page.evaluate(() => window.__game.getHeldItem!())).toBe(DIAMOND_AXE);

    // Aim at the pig and swing until it dies (it wanders, so re-aim each time).
    const hit = await page.evaluate(async () => {
      let total = 0;
      // Last known position, so we know where the loot landed.
      let last = { x: 0, z: 0 };
      for (let i = 0; i < 40 && window.__game.getMobCount!() > 0; i++) {
        const m = window.__game.getMobs!()[0]!;
        last = { x: m.x, z: m.z };
        const p = window.__game.getPlayer!();
        const dx = m.x - p.x;
        const dy = m.y + 0.45 - (p.y + 1.62);
        const dz = m.z - p.z;
        const len = Math.hypot(dx, dy, dz);
        window.__game.setView!(Math.atan2(-dx, -dz), Math.asin(dy / len));
        total += window.__game.attack!();
        await new Promise((r) => setTimeout(r, 120));
      }
      return { total, ...last };
    });
    expect(hit.total, 'landed at least two 5-damage hits').toBeGreaterThanOrEqual(10);
    expect(await page.evaluate(() => window.__game.getMobCount!())).toBe(0);

    // The loot dropped where the pig died; step onto it and collect.
    await page.waitForFunction(() => window.__game.getItemEntityCount!() > 0, null, {
      timeout: 3_000,
    });
    await page.evaluate(
      (spot) => {
        window.__game.setFrozen!(false);
        window.__game.teleport!(spot.x, spot.y + 1, spot.z);
      },
      { x: hit.x, y, z: hit.z },
    );
    await page.waitForFunction(
      (chop) => window.__game.getInventoryCount!(chop) >= 1,
      PORKCHOP,
      { timeout: 10_000 },
    );
  });

  test('eating food restores hunger (and is refused when full)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.__game.setHunger!(10);
      window.__game.giveItem!(108, 2); // cooked porkchop: 8 hunger points
      window.__game.setActiveBlock!(108);
    });
    expect(await page.evaluate(() => window.__game.getHeldItem!())).toBe(
      COOKED_PORKCHOP,
    );

    expect(await page.evaluate(() => window.__game.eat!())).toBe(true);
    expect(await page.evaluate(() => window.__game.getHunger!())).toBe(18);
    expect(
      await page.evaluate((c) => window.__game.getInventoryCount!(c), COOKED_PORKCHOP),
      'eating consumed one',
    ).toBe(1);

    // Full-ish bar: 18 + 8 clamps to 20, then a full bar refuses to eat.
    expect(await page.evaluate(() => window.__game.eat!())).toBe(true);
    expect(await page.evaluate(() => window.__game.getHunger!())).toBe(20);
    expect(await page.evaluate(() => window.__game.eat!())).toBe(false);
  });

  test('pigs spawn naturally on lit grass near the player', async ({ page }) => {
    await boot(page);
    // Stand on the terrain surface and let natural spawning run.
    await page.evaluate(() => {
      const h = window.__game.surfaceHeight!(0, 0);
      window.__game.teleport!(0.5, h + 2, 0.5);
      window.__game.setMobSpawning!(true);
    });
    await page.waitForFunction(() => window.__game.getMobCount!() > 0, null, {
      timeout: 40_000,
    });
    const mobs = await page.evaluate(() => window.__game.getMobs!());
    // Daylight surface is bright, so only passive mobs can spawn there.
    expect(mobs.every((m) => m.type === 'pig')).toBe(true);
  });

  test('a furnace cooks raw porkchop', async ({ page }) => {
    await boot(page);
    await page.evaluate(
      (ids) => {
        window.__game.setFurnace!(4, 40, 4, ids.raw, 1, ids.coal, 1);
      },
      { raw: PORKCHOP, coal: COAL },
    );
    await page.waitForFunction(
      () => window.__game.getFurnaceOutput!(4, 40, 4) !== null,
      null,
      { timeout: 25_000 },
    );
    const out = await page.evaluate(() => window.__game.getFurnaceOutput!(4, 40, 4));
    expect(out?.item).toBe(COOKED_PORKCHOP);
  });
});
