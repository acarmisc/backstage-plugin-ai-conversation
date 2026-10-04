/**
 * Regenerates the documentation screenshots in docs/images from the dev harness.
 * The dev harness renders the plugin with realistic mock data from
 * packages/plugin-ai-conversation/dev/mockFetch.ts and dev/mockApi.ts.
 *
 * Usage (from the repo root):
 *
 *   # In one terminal, start the dev server:
 *   cd packages/plugin-ai-conversation && yarn start
 *
 *   # In another terminal, capture screenshots:
 *   npm install --no-save playwright
 *   node scripts/capture-screenshots.mjs
 *
 * The script will wait for the dev server to be ready on http://localhost:3000,
 * then capture:
 *   - chat.png — the main chat page with a seeded multi-turn thread
 *   - analytics.png — the analytics dashboard
 *
 * Environment variables:
 *   BASE_URL     Override the dev server address (default: http://localhost:3000)
 *   PLAYWRIGHT_BROWSERS_PATH   Location of Playwright browsers (default: uses system)
 *
 * Notes:
 *   - Needs a Chromium that Playwright can launch (CHROMIUM_PATH overrides it)
 *   - Screenshots are 1480x960 at 2x device scale factor
 *   - The dev harness nav column on the left is cropped out
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images');
const WIDTH = 1480;
const HEIGHT = 960;
const NAV_WIDTH = 232; // The dev harness nav column width to crop out

// Ensure docs/images directory exists
if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`created ${OUT}`);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});

async function waitForServerReady() {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) {
        console.log('server ready');
        return;
      }
    } catch (e) {
      // Still connecting...
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Could not connect to ${BASE} after ${maxAttempts}s`);
}

async function open(route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  // Wait for UI to settle
  await page.waitForTimeout(2000);
}

async function savePage(name) {
  const bottom = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll('[class*="MuiPaper-root"]')].map(
        e => e.getBoundingClientRect().bottom + window.scrollY,
      ),
    ),
  );
  const height = Math.min(Math.ceil(bottom + 24), HEIGHT * 2); // Limit to 2x viewport
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: false,
    clip: { x: NAV_WIDTH, y: 0, width: WIDTH - NAV_WIDTH, height },
  });
  console.log(`saved ${name}.png (${(WIDTH - NAV_WIDTH)} x ${height}px)`);
}

// Main flow
console.log(`capturing screenshots from ${BASE} → ${OUT}`);
await waitForServerReady();

try {
  // Chat page with a pre-selected thread
  await open('/ai-conversation');
  await page.waitForTimeout(1500);
  await savePage('chat');

  // Analytics page
  await open('/ai-conversation/analytics');
  await page.waitForTimeout(1500);
  await savePage('analytics');

  console.log('done');
} finally {
  await browser.close();
}
