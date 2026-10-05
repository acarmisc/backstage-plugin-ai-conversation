// Regenerates the documentation screenshots in docs/images from the dev
// harness, which renders the chat page on the mock data in
// packages/plugin-ai-conversation/dev/.
//
//   cd packages/plugin-ai-conversation && yarn start   # terminal 1
//   npm install --no-save playwright                   # once
//   node scripts/capture-screenshots.mjs               # terminal 2
//
// BASE_URL overrides the harness address (default http://localhost:3000),
// CHROMIUM_PATH the browser Playwright launches.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images');
const WIDTH = 1480;
const HEIGHT = 940;
// The harness renders the Backstage navigation column on the left; crop it.
const NAV_WIDTH = 224;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

async function newPage(colorScheme = 'light') {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    colorScheme,
  });
  await page.goto(`${BASE}/ai-conversation`, { waitUntil: 'networkidle' });
  // Start from the seeded conversations only.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return page;
}

async function save(page, name) {
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: NAV_WIDTH, y: 0, width: WIDTH - NAV_WIDTH, height: HEIGHT },
  });
  console.log('saved', name);
}

// The context panel fills the page height; keep only its top part.
async function saveRail(page, name) {
  const box = await page.locator('[role=tablist]').first().boundingBox();
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: box.x - 2, y: box.y, width: WIDTH - box.x + 2, height: 470 },
  });
  console.log('saved', name);
}

async function pickTeam(page) {
  await page.getByLabel(/^Team/).first().click();
  await page.getByRole('option', { name: 'Platform Engineering' }).click();
  await page.waitForTimeout(500);
}

async function ask(page, text, wait = 7000) {
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill(text);
  await composer.press('Enter');
  await page.waitForTimeout(wait);
}

// Welcome screen.
let page = await newPage();
await save(page, 'welcome');

// A grounded answer: team selected (its knowledge bases are preselected).
await pickTeam(page);
await ask(page, 'How do I ship a new service to production?');
await save(page, 'chat');

// Context panel tabs, as element shots.
await saveRail(page, 'sources');
await page.getByRole('tab', { name: /usage/i }).click();
await page.waitForTimeout(400);
await saveRail(page, 'usage');
await page.getByRole('tab', { name: /sources/i }).click();

// A composer picker open.
await page.getByRole('button', { name: /gpt-4o/ }).first().click();
await page.waitForTimeout(800);
await save(page, 'composer-pills');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Tune drawer.
await page.getByRole('button', { name: 'Conversation settings' }).click();
await page.waitForTimeout(800);
await save(page, 'tune-drawer');
await page.keyboard.press('Escape');
await page.close();

// Compare mode: two models answering side by side.
page = await newPage();
await pickTeam(page);
await page.getByRole('button', { name: 'Compare models' }).click();
await page.waitForTimeout(800);
const boxes = page.getByRole('checkbox');
await boxes.nth(0).check();
await boxes.nth(2).check();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^compare \(/i }).click();
await page.waitForTimeout(500);
await ask(page, 'Summarize our incident escalation policy');
await save(page, 'compare');
await page.close();

// Dark theme, on a stored conversation.
page = await newPage('dark');
await page.getByText('Incident response proced').first().click();
await page.waitForTimeout(1000);
await save(page, 'dark');
await page.close();

// Analytics.
page = await browser.newPage({ viewport: { width: WIDTH, height: 760 }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/ai-conversation/analytics`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({
  path: `${OUT}/analytics.png`,
  clip: { x: NAV_WIDTH, y: 0, width: WIDTH - NAV_WIDTH, height: 760 },
});
console.log('saved analytics');

await browser.close();
