import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { register, save } from './helpers';

// These flows include several user journeys, boundary checks and accessibility scans.
test.setTimeout(60000);

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
}
async function selectDate(page: Page, date: string) {
  if ((await page.getByLabel('Selected date').inputValue()) === date) return;
  await page.getByLabel('Selected date').fill(date);
  await expect(page.getByLabel('Selected date')).toHaveValue(date);
  await expect(page.locator('.loading-state')).toHaveCount(0);
}
async function summary(page: Page, label: string, value: string) {
  await expect(
    page.locator('.summary-strip > div').filter({ hasText: label }).locator('dd'),
  ).toHaveText(value);
}

test('account errors preserve fields and switching accounts clears patient data', async ({
  page,
}) => {
  const email = await register(page);
  await save(page, 'fasting', '133');
  await logout(page);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('IncorrectPassword123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('IncorrectPassword123!');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await logout(page);
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name').fill('B'.repeat(80));
  await page.getByLabel('Email address').fill(email.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await page.getByLabel('Email address').fill(`e2e-${randomUUID()}@example.com`);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('0 of 4 recorded')).toBeVisible();
  await expect(page.locator('.reading-value')).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A fresh page in your journal.' })).toBeVisible();
  await summary(page, 'Readings', '0entries');
});

test('reading boundaries, conflicting edits, moving dates and failed deletion recovery', async ({
  page,
}) => {
  await register(page);
  await selectDate(page, '2026-10-15');
  for (const value of ['39', '100.5', '601']) {
    await page.getByLabel('Glucose value').fill(value);
    await page.getByRole('button', { name: 'Save reading', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('whole number');
  }
  await page.getByLabel('Date', { exact: true }).fill('2999-01-01');
  await page.getByLabel('Glucose value').fill('100');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Date cannot be in the future.');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-15');
  await page.getByLabel('Glucose value').fill('40');
  await page.getByLabel('Glucose value').press('Enter');
  await expect(page.getByText('Reading saved.', { exact: true })).toBeVisible();
  await save(page, 'after_breakfast', '600');
  await page.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
  await page.getByLabel('Time slot').selectOption('after_breakfast');
  await page.getByLabel('Glucose value').fill('111');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('already have');
  await expect(page.getByLabel('Glucose value')).toHaveValue('111');
  await expect(
    page.locator('.log-row').filter({ hasText: 'Morning (fasting)' }).locator('.reading-value'),
  ).toContainText('40');
  await page.getByLabel('Time slot').selectOption('after_lunch');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-14');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Reading updated.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Selected date')).toHaveValue('2026-10-14');
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await selectDate(page, '2026-10-15');
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await summary(page, 'Average', '600.0mg/dl');
  await page.route('**/api/readings/*', (route) =>
    route.request().method() === 'DELETE' ? route.abort() : route.continue(),
  );
  await page.getByRole('button', { name: 'Delete After breakfast reading' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await page.unroute('**/api/readings/*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('0 of 4 recorded')).toBeVisible();
  await summary(page, 'Readings', '0entries');
});

test('reports show exact aggregates, date boundaries, slot order and empty ranges', async ({
  page,
}) => {
  await register(page);
  const fixtures = [
    ['2026-08-31', 'fasting', 600],
    ['2026-09-01', 'fasting', 90],
    ['2026-09-30', 'after_dinner', 130],
    ['2026-10-01', 'fasting', 100],
    ['2026-10-15', 'fasting', 101],
    ['2026-10-15', 'after_lunch', 102],
    ['2026-10-15', 'after_dinner', 104],
    ['2026-10-16', 'fasting', 500],
    ['2024-02-01', 'fasting', 90],
    ['2024-02-29', 'fasting', 120],
    ['2024-03-01', 'fasting', 600],
  ];
  for (const [date, slot, value] of fixtures) {
    const response = await page.request.post('/api/readings', {
      headers: { 'X-Requested-With': 'Sweety', Origin: new URL(page.url()).origin },
      data: { date, slot, value },
    });
    expect(response.status()).toBe(201);
  }
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await selectDate(page, '2026-10-15');
  await summary(page, 'Average', '101.8mg/dl');
  await summary(page, 'Highest', '104mg/dl');
  await summary(page, 'Lowest', '100mg/dl');
  await summary(page, 'Readings', '4entries');
  await expect(page.locator('.report-range')).toContainText('1 October 2026 – 15 October 2026');
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await summary(page, 'Average', '102.3mg/dl');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').first()).toContainText('Morning (fasting)');
  await expect(page.locator('tbody tr').last()).toContainText('After dinner');
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await summary(page, 'Average', '110.0mg/dl');
  await summary(page, 'Readings', '2entries');
  await expect(page.locator('.report-range')).toContainText('1 September 2026 – 30 September 2026');
  await expect(page.getByRole('img', { name: /Daily average glucose readings/ })).toBeVisible();
  await selectDate(page, '2024-03-31');
  await expect(page.locator('.report-range')).toContainText('1 February 2024 – 29 February 2024');
  await summary(page, 'Average', '105.0mg/dl');
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await test.info().attach('Leap-year report', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await selectDate(page, '2026-01-15');
  await expect(page.locator('.report-range')).toContainText('1 December 2025 – 31 December 2025');
  await summary(page, 'Readings', '0entries');
  await summary(page, 'Average', '—mg/dl');
  await expect(page.getByRole('heading', { name: 'A fresh page in your journal.' })).toBeVisible();
});

test('failed saves preserve drafts and pending writes prevent changing the selected day', async ({
  page,
}) => {
  await page.clock.install();
  await register(page);
  await page.getByLabel('Glucose value').fill('111');
  let metadataRequests = 0;
  await page.route('**/api/meta', (route) => {
    metadataRequests++;
    return route.abort();
  });
  await page.clock.fastForward(61000);
  await page.clock.runFor(1500);
  expect(metadataRequests).toBeGreaterThan(0);
  await expect(page.getByLabel('Glucose value')).toHaveValue('111');
  await page.unroute('**/api/meta');
  const metadata = await (await page.request.get('/api/meta')).json();
  const nextDay = new Date(`${metadata.today}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  await page.route('**/api/meta', (route) =>
    route.fulfill({ json: { ...metadata, today: nextDay.toISOString().slice(0, 10) } }),
  );
  await page.clock.fastForward(61000);
  await page.clock.runFor(1500);
  await expect(page.getByLabel('Glucose value')).toHaveValue('111');
  await expect(page.getByLabel('Selected date')).toHaveValue(metadata.today);
  await page.unroute('**/api/meta');
  await page.route('**/api/readings', (route) => route.abort());
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByLabel('Glucose value')).toHaveValue('111');
  await page.unroute('**/api/readings');
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route('**/api/readings', async (route) => {
    writes++;
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Save reading', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(page.getByLabel('Selected date')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous day' })).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByText('Reading saved.', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
});
