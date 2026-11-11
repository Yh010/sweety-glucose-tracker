import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { register, save } from './helpers';

test('next-slot suggestions, complete-day guidance, Today shortcut and private CSV download', async ({
  page,
}) => {
  await register(page);
  const review = resolve('../.impeccable/review');
  await mkdir(review, { recursive: true });
  const today = await page.getByLabel('Selected date').inputValue();
  await save(page, 'fasting', '110');
  await expect(page.getByLabel('Time slot')).toHaveValue('after_breakfast');
  await page.reload();
  await expect(page.getByLabel('Time slot')).toHaveValue('after_breakfast');
  await page.getByLabel('Glucose value').fill('88');
  await page.getByRole('button', { name: 'Delete Morning (fasting) reading' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('0 of 4 recorded')).toBeVisible();
  await expect(page.getByLabel('Glucose value')).toHaveValue('88');
  await save(page, 'fasting', '110');
  await save(page, 'after_breakfast', '120');
  await save(page, 'after_lunch', '130');
  await save(page, 'after_dinner', '140');
  await expect(page.getByRole('button', { name: 'Day complete' })).toBeDisabled();
  await expect(page.getByLabel('Date', { exact: true })).toBeEnabled();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: resolve(review, `${test.info().project.name}-complete.png`),
    fullPage: true,
  });
  await page.getByLabel('Date', { exact: true }).fill('2026-10-15');
  await expect(page.getByRole('button', { name: 'Save reading', exact: true })).toBeEnabled();
  await save(page, 'fasting', '90');
  await expect(page.getByLabel('Time slot')).toHaveValue('after_breakfast');
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: resolve(review, `${test.info().project.name}-history.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue(today);
  await expect(page.getByText('4 of 4 recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  let releaseExport = () => {};
  const exportGate = new Promise<void>((resolve) => {
    releaseExport = resolve;
  });
  await page.route('**/api/reports/export?**', async (route) => {
    await exportGate;
    await route.continue();
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  try {
    await expect(page.getByRole('button', { name: 'Preparing CSV...' })).toBeDisabled();
    await expect(page.getByLabel('Selected date')).toBeDisabled();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: resolve(review, `${test.info().project.name}-export-loading.png`),
      fullPage: true,
    });
  } finally {
    releaseExport();
  }
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`sweety-daily-${today}-to-${today}.csv`);
  const file = await download.path();
  expect(file).not.toBeNull();
  const csv = await readFile(file!, 'utf8');
  expect(csv).toContain('Glucose (mg/dl)');
  expect(csv).toContain(`"${today}","After dinner","140"`);
  expect(csv).not.toContain('2026-10-15');
  expect(csv.trim().split('\r\n')).toHaveLength(5);
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await page.getByLabel('Selected date').fill('2026-01-15');
  await expect(page.getByRole('heading', { name: 'A fresh page in your journal.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
