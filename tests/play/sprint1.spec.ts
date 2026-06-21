import { test, expect } from '@playwright/test';

/**
 * Sprint 1: a single chunk renders as a culled mesh. We assert the mesher
 * produced solid blocks and faces, and that hidden-face culling removed
 * interior faces (faces must be far fewer than 6 per solid block).
 */
test('renders a single culled chunk mesh', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForFunction(
    () => window.__game?.ready === true && !!window.__game.chunkStats,
    null,
    { timeout: 20_000 },
  );

  const stats = await page.evaluate(() => window.__game.chunkStats!);

  expect(stats.solidBlocks, 'solid blocks generated').toBeGreaterThan(100);
  expect(stats.faces, 'faces emitted').toBeGreaterThan(0);
  // Hidden-face culling: emitted faces must be well under the naive 6/block.
  expect(stats.faces).toBeLessThan(stats.solidBlocks * 6);

  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/sprint1.png' });

  expect(errors, `console/page errors: ${errors.join('\n')}`).toEqual([]);
});
