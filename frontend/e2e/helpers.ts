import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function register(page: Page, name = 'Alex Test') {
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
export async function save(page: Page, slot: string, value: string) {
  await page.getByLabel('Time slot').selectOption(slot);
  await page.getByLabel('Glucose value').fill(value);
  await page.getByRole('button', { name: 'Save reading', exact: true }).click();
  await expect(page.getByText('Reading saved.', { exact: true })).toBeVisible();
}
