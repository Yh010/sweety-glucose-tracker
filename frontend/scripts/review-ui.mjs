import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
const directory = new URL('../../.impeccable/review/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
const accessibility = [];
async function audit(state) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  accessibility.push({
    state,
    violations: result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((n) => n.target),
    })),
  });
}
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://localhost:5173');
await page.getByRole('heading', { name: 'Good to see you.' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await audit('login');
await page.screenshot({ path: fileURLToPath(new URL('login.png', directory)), fullPage: true });
await page.getByLabel('Email address').fill('demo@sweety.local');
await page.getByLabel('Password', { exact: true }).fill('SweetyDemo123!');
await page.getByRole('button', { name: 'Log in', exact: true }).click();
await page.getByRole('heading', { name: 'Your daily log' }).waitFor();
await audit('daily-desktop');
await page.screenshot({ path: fileURLToPath(new URL('desktop.png', directory)), fullPage: true });
await page.getByRole('button', { name: 'Reports', exact: true }).click();
await page.getByRole('heading', { name: 'Your month, one day at a time' }).waitFor();
await page.screenshot({ path: fileURLToPath(new URL('reports.png', directory)), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await audit('reports-mobile');
await page.screenshot({
  path: fileURLToPath(new URL('mobile-reports.png', directory)),
  fullPage: true,
});
await page.getByRole('button', { name: 'Daily log', exact: true }).click();
await page.getByRole('heading', { name: 'Your daily log' }).waitFor();
await page.screenshot({ path: fileURLToPath(new URL('mobile.png', directory)), fullPage: true });
await audit('daily-mobile');
await writeFile(new URL('accessibility.json', directory), JSON.stringify(accessibility, null, 2));
console.log(
  JSON.stringify({
    accessibility,
    errors,
    horizontalOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }),
);
await browser.close();
