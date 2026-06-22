import { test, expect } from '@playwright/test';

/**
 * Sprint 0: the app boots, WebGL is available, the render loop runs, and a
 * frame is drawn (spinning cube). This proves the headless WebGL pipeline works
 * end to end before we build the voxel world on top of it.
 */
test('boots with a live WebGL render loop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  // Wait for the game to report ready via the debug API.
  await page.waitForFunction(() => window.__game?.ready === true, null, {
    timeout: 20_000,
  });

  const info = await page.evaluate(() => ({
    webglVersion: window.__game.webglVersion,
    frameCount: window.__game.frameCount,
  }));

  expect(info.webglVersion, 'WebGL context version').toContain('WebGL');
  expect(info.frameCount, 'frames rendered').toBeGreaterThan(0);

  // Frame count should keep advancing (loop is alive). Poll rather than use a
  // fixed wait, since headless software-GL runs at a low frame rate.
  const first = info.frameCount;
  await page.waitForFunction((f) => window.__game.frameCount > f, first, {
    timeout: 10_000,
  });

  await page.screenshot({ path: 'test-results/sprint0.png' });

  expect(errors, `console/page errors: ${errors.join('\n')}`).toEqual([]);
});
