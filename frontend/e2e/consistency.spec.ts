import { test, expect } from '@playwright/test';
import { register, save } from './helpers';

test('other-tab changes refresh the log, preserve drafts and reject stale edits', async ({
  page,
  context,
}) => {
  await register(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByText('0 of 4 recorded')).toBeVisible();
  await other.getByLabel('Glucose value').fill('129');
  await save(page, 'fasting', '111');
  await expect(other.getByText('1 of 4 recorded')).toBeVisible();
  await expect(other.getByLabel('Glucose value')).toHaveValue('129');
  await other.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
  await other.getByLabel('Glucose value').fill('155');
  await page.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
  await page.getByLabel('Glucose value').fill('166');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Reading updated.', { exact: true })).toBeVisible();
  await expect(other.locator('.reading-value')).toContainText('166');
  await expect(other.getByLabel('Glucose value')).toHaveValue('155');
  await other.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(other.getByRole('alert')).toContainText('changed elsewhere');
  await expect(other.getByLabel('Glucose value')).toHaveValue('155');
  await other.getByText('Cancel editing', { exact: true }).click();
  await other.getByRole('button', { name: 'Edit Morning (fasting) reading' }).click();
  await expect(other.getByLabel('Glucose value')).toHaveValue('166');
  await other.getByLabel('Glucose value').fill('177');
  await other.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(other.getByText('Reading updated.', { exact: true })).toBeVisible();
  await expect(page.locator('.reading-value')).toContainText('177');
});

test('explicit refresh discovers an external change without clearing the form', async ({
  page,
}) => {
  await register(page);
  const date = await page.getByLabel('Selected date').inputValue();
  await page.getByLabel('Glucose value').fill('199');
  const created = await page.request.post('/api/readings', {
    headers: { 'X-Requested-With': 'Sweety' },
    data: { date, slot: 'after_lunch', value: 188 },
  });
  expect(created.status()).toBe(201);
  await expect(page.getByText('0 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh readings', exact: true }).click();
  await expect(page.getByText('1 of 4 recorded')).toBeVisible();
  await expect(page.getByLabel('Glucose value')).toHaveValue('199');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('188');
  const newer = await page.request.post('/api/readings', {
    headers: { 'X-Requested-With': 'Sweety' },
    data: { date, slot: 'after_dinner', value: 200 },
  });
  expect(newer.status()).toBe(201);
  await page.getByRole('button', { name: 'Refresh report', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('200');
});
