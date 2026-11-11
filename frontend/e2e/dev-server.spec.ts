import { test, expect } from '@playwright/test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

test('generated test HTML does not reload the app or erase a login draft', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await page.getByLabel('Email address').fill('draft@example.com');
  await page.getByLabel('Password', { exact: true }).fill('UnfinishedPassword123!');
  const directory = resolve('test-results');
  const probe = resolve(directory, 'watch-probe.html');
  await mkdir(directory, { recursive: true });
  await writeFile(probe, '<!doctype html><title>Initial test output</title>');
  await page.request.get('/test-results/watch-probe.html');
  // A bounded navigation observation detects Vite's full-reload event without triggering focus.
  const navigation = page
    .waitForEvent('framenavigated', {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 2000,
    })
    .then(
      () => true,
      (error) => {
        if (error.name === 'TimeoutError') return false;
        throw error;
      },
    );
  try {
    await writeFile(probe, '<!doctype html><title>Generated test output</title>');
    expect(await navigation).toBe(false);
    await expect(page.getByLabel('Email address')).toHaveValue('draft@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(
      'UnfinishedPassword123!',
    );
  } finally {
    await rm(probe, { force: true });
  }
});
