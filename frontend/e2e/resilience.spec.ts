import { test, expect } from '@playwright/test';
import { register, save } from './helpers';

test('a lost deletion response refreshes the log and retry confirms the missing reading', async ({
  page,
}) => {
  await register(page);
  await save(page, 'fasting', '129');
  await page.route(
    '**/api/readings/*',
    async (route) => {
      await route.fetch();
      await route.abort('connectionreset');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Delete Morning (fasting) reading' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByText('0 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Reading deleted.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('two tabs submitting the same slot create exactly one reading', async ({ page, context }) => {
  await register(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByLabel('Glucose value')).toBeVisible();
  await page.getByLabel('Glucose value').fill('111');
  await other.getByLabel('Glucose value').fill('122');
  await Promise.all([
    page.getByRole('button', { name: 'Save reading', exact: true }).click(),
    other.getByRole('button', { name: 'Save reading', exact: true }).click(),
  ]);
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await expect(other.getByText('1 of 4 recorded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save reading', exact: true })).toBeEnabled();
  await expect(other.getByRole('button', { name: 'Save reading', exact: true })).toBeEnabled();
  const errors = await Promise.all([
    page.getByRole('alert').count(),
    other.getByRole('alert').count(),
  ]);
  expect(errors.reduce((a, b) => a + b, 0)).toBe(1);
  await page.reload();
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
});

test('failed CSV downloads can be retried without changing the report', async ({ page }) => {
  await register(page);
  await save(page, 'fasting', '142');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.route('**/api/reports/export?**', (route) => route.abort(), { times: 1 });
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('sweety-mtd-');
  await expect(page.getByRole('definition').filter({ hasText: '142' }).first()).toBeVisible();
});

test('unicode names and narrow layouts keep the journal usable', async ({ page }) => {
  await register(page, '\u092f\u0936 \u4f50\u85e4 \ud83c\udf3f');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('button', { name: 'Save reading', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await save(page, 'fasting', '40');
  expect(errors).toEqual([]);
});

test('logout in another tab clears patient data without a page refresh', async ({
  page,
  context,
}) => {
  await register(page);
  await save(page, 'fasting', '123');
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByText('1 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await expect(other.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await expect(other.getByText('1 of 4 recorded')).toHaveCount(0);
});

test('a lost save response refreshes the log while retaining the draft', async ({ page }) => {
  await register(page);
  await page.route(
    '**/api/readings',
    async (route) => {
      await route.fetch();
      await route.abort('connectionreset');
    },
    { times: 1 },
  );
  await page.getByLabel('Glucose value').fill('137');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await expect(page.getByLabel('Glucose value')).toHaveValue('137');
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already have');
  await page.reload();
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
});

test('a stalled save times out and allows recovery without losing inputs', async ({ page }) => {
  await register(page);
  await page.clock.install();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/api/readings',
    async (route) => {
      await held;
      await route.abort().catch((error) => {
        if (!String(error).includes('already handled')) throw error;
      });
    },
    { times: 1 },
  );
  try {
    await page.getByLabel('Glucose value').fill('145');
    await page.getByRole('button', { name: 'Save reading', exact: true }).click();
    await expect(page.getByLabel('Glucose value')).toBeDisabled();
    await page.clock.fastForward(21000);
    await expect(page.getByRole('alert')).toContainText('took too long');
    await expect(page.getByLabel('Glucose value')).toBeEnabled();
    await expect(page.getByLabel('Glucose value')).toHaveValue('145');
  } finally {
    release();
  }
  await page.unroute('**/api/readings');
  await save(page, 'fasting', '145');
});
