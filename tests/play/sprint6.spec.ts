import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const AIR = 0;
const STONE = 1;

async function boot(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!window.__game?.setBlock && !!window.__game.save,
    null,
    { timeout: 20_000 },
  );
  await page.waitForFunction(() => window.__game.getWorldInfo!().settled, null, {
    timeout: 25_000,
  });
}

test.describe('Sprint 6: persistence (save/load)', () => {
  test('edits survive a reload, terrain stays deterministic', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await boot(page);

    // Make two edits on a dry high platform (away from water so nothing flows
    // into the broken cell): place a stone then break it, and place a stone in
    // the air nearby.
    const ref = await page.evaluate(() => {
      const h = 100;
      window.__game.setBlock!(3, h, 3, 1); // place then...
      window.__game.setBlock!(3, h, 3, 0); // ...break it (net: air)
      window.__game.setBlock!(5, h + 2, 5, 1); // place stone in the air
      return { h };
    });

    // Sanity: edits are present in memory now.
    expect(await getBlock(page, 3, ref.h, 3)).toBe(AIR);
    expect(await getBlock(page, 5, ref.h + 2, 5)).toBe(STONE);

    // Capture the deterministic baseline at an untouched column.
    const baseline = await getBlock(page, 10, ref.h, 10);

    await page.evaluate(() => window.__game.save!());
    await page.waitForTimeout(200);

    // Reload: world regenerates from seed, then overlays saved edits.
    await page.reload();
    await boot(page);

    expect(await getBlock(page, 3, ref.h, 3), 'broken block stays gone').toBe(
      AIR,
    );
    expect(await getBlock(page, 5, ref.h + 2, 5), 'placed stone restored').toBe(
      STONE,
    );
    expect(
      await getBlock(page, 10, ref.h, 10),
      'untouched terrain regenerates identically',
    ).toBe(baseline);

    await page.screenshot({ path: 'test-results/sprint6.png' });
    expect(errors).toEqual([]);
  });
});

function getBlock(page: Page, x: number, y: number, z: number): Promise<number> {
  return page.evaluate(
    ([px, py, pz]) => window.__game.getBlock!(px, py, pz),
    [x, y, z],
  );
}
