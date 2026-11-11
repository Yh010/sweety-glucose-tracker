import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function register(page: Page, name = 'Alex Test') {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your daily log' })).toBeVisible();
  return email;
}
async function save(page: Page, slot: string, value: string) {
  await page.getByLabel('Time slot').selectOption(slot);
  await page.getByLabel('Glucose value').fill(value);
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByText('Reading saved.', { exact: true })).toBeVisible();
}
test('register, validate, create, edit, report, delete and log in again', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Please enter a glucose value.');
  await page.getByLabel('Glucose value').fill('601');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await save(page, 'fasting', '110');
  await page.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
  await page.getByLabel('Glucose value').fill('111');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Reading updated.', { exact: true })).toBeVisible();
  await page.getByLabel('Time slot').selectOption('fasting');
  await page.getByLabel('Glucose value').fill('112');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already have');
  await save(page, 'after_breakfast', '120');
  await save(page, 'after_lunch', '130');
  await save(page, 'after_dinner', '140');
  await expect(page.getByText('4 of 4 recorded')).toBeVisible();
  await page.getByLabel('Glucose value').fill('150');
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('only 4 readings');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('111');
  await expect(page.getByRole('definition').filter({ hasText: '125.3' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A fresh page in your journal.' })).toBeVisible();
  await page.getByRole('button', { name: 'Daily log', exact: true }).click();
  await page.getByRole('button', { name: 'Delete After dinner reading' }).click();
  await page.getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(page.getByText('4 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Delete After dinner reading' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('3 of 4 recorded')).toBeVisible();
  await page.reload();
  await expect(page.getByText('3 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('3 of 4 recorded')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('failed requests offer recovery and a long name fits the page', async ({ page }) => {
  await register(
    page,
    'Alexandertheverylongnamethatdoesnotcontainanyspacesandshouldstillfitthescreen',
  );
  await page.route('**/api/reports?**', (route) => route.abort());
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not connect');
  await page.unroute('**/api/reports?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your daily log' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('an expired session returns to login without retaining the patient view', async ({
  page,
  context,
}) => {
  const email = await register(page);
  await save(page, 'fasting', '100');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByText('Your session ended. Log in again to continue.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your daily log' })).toHaveCount(0);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
});
