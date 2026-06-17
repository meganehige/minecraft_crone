import { defineConfig } from '@playwright/test';

/**
 * Headless WebGL playtest config.
 *
 * This runs in a display-less container, so Chromium is launched headless with
 * SwiftShader (software GL) so that WebGL 2.0 works. We pin the preinstalled
 * Chromium binary via executablePath to avoid Playwright trying to download a
 * version-matched build (which is blocked in this environment).
 */
const CHROMIUM_PATH =
  process.env.PW_CHROMIUM_PATH ??
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: './tests/play',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // Real-time game E2E checks are mildly timing-sensitive under load; allow a
  // couple of retries to absorb scheduling jitter.
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
