import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Exercises the locally built HTTPS containers, never a public deployment.
const base = 'https://localhost:8443';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await context.request
      .get(`${base}/api/health`, { timeout: 2000 })
      .catch(() => null);
    if (response?.ok()) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'production containers did not become ready');
  const response = await page.goto(base);
  assert.ok(response?.ok());
  assert.match(response.headers()['content-security-policy'] ?? '', /default-src 'self'/);
  assert.ok(response.headers()['strict-transport-security']);
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name').fill('Synthetic production check');
  await page.getByLabel('Email address').fill(`production-${randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('SyntheticProduction123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('heading', { name: 'Your daily log' }).waitFor();
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === 'sweety_session');
  assert.ok(session?.secure && session.httpOnly);
  await page.getByLabel('Glucose value').fill('123');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await page.getByText('Reading saved.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await page.getByRole('table').waitFor();
  assert.match(await page.getByRole('table').innerText(), /123/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  assert.match((await download).suggestedFilename(), /^sweety-daily-.*\.csv$/);
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL('../test-results/production-desktop.png', import.meta.url).pathname.replace(
      /^\/([A-Za-z]:)/,
      '$1',
    ),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await page.getByRole('heading', { name: 'Good to see you.' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'Production HTTPS browser check passed: static build, headers, secure cookie, signup, reading, report, CSV and logout.',
  );
} finally {
  await context.close();
  await browser.close();
}
