#!/usr/bin/env node
/**
 * Capture GitHub Pages section snapshots for README.md.
 * Usage: node scripts/capture_readme_screenshots.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'docs', 'screenshots');
const baseUrl = (process.argv[2] || 'https://qbitos.github.io/forbes-wealth-journeys/').replace(/\/?$/, '/');

const shots = [
  {
    file: 'forbes-profile.png',
    url: `${baseUrl}#forbes?rank=1&name=Elon%20Musk`,
    selector: '#forbes',
    waitMs: 4500,
  },
  {
    file: 'member-details.png',
    url: `${baseUrl}#forbes?rank=1&name=Elon%20Musk`,
    selector: '#quick-start',
    waitMs: 2000,
    afterLoad: async (page) => {
      await page.locator('#member-details-name').filter({ hasText: 'Elon Musk' }).waitFor({ timeout: 20000 });
      const timelineTab = page
        .locator('#quick-templates button, #quick-templates [role=tab]')
        .filter({ hasText: 'Timeline' })
        .first();
      if (await timelineTab.count()) {
        await timelineTab.click();
        await page.waitForTimeout(2000);
      }
      await page.locator('#quick-start').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    },
  },
  {
    file: 'venture-timeline.png',
    url: `${baseUrl}#timeline-cluster`,
    selector: '#timeline-venture-shell',
    waitMs: 5000,
  },
  {
    file: 'activity.png',
    url: `${baseUrl}#activity`,
    selector: '#activity',
    waitMs: 4000,
  },
  {
    file: 'markets-configurator.png',
    url: `${baseUrl}#configurator`,
    selector: '#configurator',
    waitMs: 2500,
  },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const shot of shots) {
  console.log(`Capturing ${shot.file} …`);
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(shot.waitMs);
  if (shot.afterLoad) await shot.afterLoad(page);

  const el = page.locator(shot.selector).first();
  await el.waitFor({ state: 'visible', timeout: 30000 });
  await el.screenshot({ path: path.join(outDir, shot.file) });
}

await browser.close();
console.log(`Saved ${shots.length} screenshots to ${outDir}`);
