import { chromium, expect, request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.CAPTURE_URL || 'http://localhost:5173';
const proxyUrl =
  baseURL.startsWith('https:') && process.env.HTTPS_PROXY
    ? new URL(process.env.HTTPS_PROXY)
    : undefined;
const proxy = proxyUrl
  ? {
      server: `${proxyUrl.protocol}//${proxyUrl.host}`,
      ...(proxyUrl.username
        ? {
            username: decodeURIComponent(proxyUrl.username),
            password: decodeURIComponent(proxyUrl.password),
          }
        : {}),
    }
  : undefined;
const output = resolve('../output/submission');
await mkdir(output, { recursive: true });
const stamp = Date.now();
const password = 'SyntheticDemo123!';
const historyEmail = `history-${stamp}@example.com`;
const api = await request.newContext({
  baseURL,
  proxy,
  extraHTTPHeaders: { 'X-Requested-With': 'Sweety', Origin: baseURL },
});
async function post(path, data) {
  const response = await api.post(path, { data });
  if (!response.ok()) throw new Error(`${path}: ${response.status()} ${await response.text()}`);
  return response;
}
await post('/api/auth/register', { name: 'Alex Morgan', email: historyEmail, password });
const { today } = await (await api.get('/api/meta')).json();
const current = new Date(`${today}T12:00:00Z`);
const month = current.getUTCMonth();
const year = current.getUTCFullYear();
const iso = (date) => date.toISOString().slice(0, 10);
const dates = new Set([today]);
for (let day = 1; day <= current.getUTCDate(); day += 2)
  dates.add(iso(new Date(Date.UTC(year, month, day, 12))));
for (let day = 1; day <= 28; day += 3) dates.add(iso(new Date(Date.UTC(year, month - 1, day, 12))));
let index = 0;
for (const date of dates) {
  await Promise.all([
    post('/api/readings', { date, slot: 'fasting', value: 92 + (index % 18) }),
    post('/api/readings', { date, slot: 'after_breakfast', value: 118 + (index++ % 25) }),
  ]);
}
console.log('Synthetic historical readings prepared. Starting real browser capture.');
await api.dispose();
const browser = await chromium.launch({ channel: 'chrome', proxy });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: resolve(output, 'raw'), size: { width: 1440, height: 1000 } },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 500)
    errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
});
const scenes = [];
const started = Date.now();
async function scene(title, seconds = 6, screenshot) {
  scenes.push({ title, seconds: (Date.now() - started) / 1000 });
  console.log(title);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => document.fonts.ready);
  if (screenshot) await page.screenshot({ path: resolve(output, screenshot), fullPage: true });
  await page.waitForTimeout(seconds * 1000);
}
const button = (name) => page.getByRole('button', { name, exact: true });
async function logout() {
  await button('Log out').click();
  await button('Log out').last().click();
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
}
try {
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await scene('Welcome and secure sign-in', 6, '01-login.png');
  await button('Create an account').click();
  await page.getByLabel('Your name').pressSequentially('Jamie Taylor', { delay: 65 });
  await page.getByLabel('Email address').fill(`walkthrough-${stamp}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await scene('Create a personal account', 5, '02-register.png');
  await button('Create account').click();
  await expect(page.getByRole('heading', { name: 'Your daily log' })).toBeVisible();
  await scene('A clear first-use experience', 6, '03-empty-daily.png');
  await page.getByLabel('Glucose value').fill('601');
  await button('Save reading').click();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await scene('Validation keeps readings within the accepted range', 6, '04-validation.png');
  for (const [slot, value] of [
    ['fasting', '105'],
    ['after_breakfast', '124'],
    ['after_lunch', '132'],
    ['after_dinner', '118'],
  ]) {
    await page.getByLabel('Time slot').selectOption(slot);
    await page.getByLabel('Glucose value').fill(value);
    await page.waitForTimeout(900);
    await button('Save reading').click();
    await expect(page.getByText('Reading saved.', { exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
  }
  await expect(page.getByText('4 of 4 recorded')).toBeVisible();
  await scene('Four distinct daily slots and completion guidance', 7, '05-day-complete.png');
  await button('Edit Morning (fasting) reading').click();
  await page.getByLabel('Glucose value').fill('108');
  await page.waitForTimeout(1800);
  await button('Save changes').click();
  await expect(page.getByText('Reading updated.', { exact: true })).toBeVisible();
  await scene('Correct a reading without creating a duplicate', 5);
  await button('Reports').click();
  await button('Daily').click();
  await expect(page.getByRole('table')).toContainText('108');
  await scene('Daily high, low, average, count and individual readings', 9, '06-daily-report.png');
  const downloadEvent = page.waitForEvent('download');
  await button('Download CSV').click();
  const download = await downloadEvent;
  await download.saveAs(resolve(output, 'sample-daily-report.csv'));
  await scene('Export the selected report as CSV', 5);
  await button('Daily log').click();
  await button('Delete After dinner reading').click();
  await scene('Confirm before removing a reading', 5, '07-delete-confirmation.png');
  await button('Delete').click();
  await expect(page.getByText('3 of 4 recorded')).toBeVisible();
  await scene('The daily log and summary update together', 5);
  await logout();
  await page.getByLabel('Email address').fill(historyEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await button('Log in').click();
  await expect(page.getByRole('heading', { name: 'Your daily log' })).toBeVisible();
  await scene(
    'Sign in to an account with synthetic historical readings',
    6,
    '08-daily-history.png',
  );
  await button('Reports').click();
  await button('Month to date').click();
  await expect(page.getByRole('heading', { name: 'Your month, one day at a time' })).toBeVisible();
  await scene('Month-to-date trends and summary statistics', 10, '09-month-to-date.png');
  await button('Previous month').click();
  await expect(page.getByRole('img', { name: 'Daily average glucose readings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Previous month', exact: true })).toBeVisible();
  await scene('The complete previous calendar month', 10, '10-previous-month.png');
  await logout();
  await scene('Log out to end the private session', 5);
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(resolve(output, 'walkthrough-source.webm'));
  await writeFile(
    resolve(output, 'capture.json'),
    JSON.stringify({ baseURL, today, syntheticData: true, scenes, errors }, null, 2),
  );
}
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const phone = await mobile.newPage();
await phone.goto(baseURL);
await phone.getByLabel('Email address').fill(historyEmail);
await phone.getByLabel('Password', { exact: true }).fill(password);
await phone.getByRole('button', { name: 'Log in', exact: true }).click();
await expect(phone.getByRole('heading', { name: 'Your daily log' })).toBeVisible();
await phone.evaluate(() => document.fonts.ready);
await phone.screenshot({ path: resolve(output, '11-mobile-daily.png'), fullPage: true });
await phone.getByRole('button', { name: 'Reports', exact: true }).click();
await expect(phone.getByRole('heading', { name: 'Your month, one day at a time' })).toBeVisible();
await phone.screenshot({ path: resolve(output, '12-mobile-reports.png'), fullPage: true });
expect(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
await mobile.close();
await browser.close();
if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
console.log(`Saved submission evidence to ${output}`);
