import { test, expect } from '@playwright/test';

for (const mode of ['login', 'registration'] as const) {
  test(`switching away and back preserves unfinished ${mode} details`, async ({ page }) => {
    let profileRequests = 0;
    let metadataRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/auth/me') profileRequests++;
      if (new URL(request.url()).pathname === '/api/meta') metadataRequests++;
    });
    await page.clock.install();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
    if (mode === 'registration') {
      await page.getByRole('button', { name: 'Create an account', exact: true }).click();
      await page.getByLabel('Your name').fill('Unfinished Name');
    }
    await page.getByLabel('Email address').fill('unfinished@example.com');
    await page.getByLabel('Password', { exact: true }).fill('StillTyping123!');
    const requestsBeforeSwitch = profileRequests;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(61000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    // A browser round trip lets focus-triggered requests and React updates settle.
    await page.clock.runFor(250);
    await page.request.get('/api/health');
    await page.clock.runFor(250);
    await expect(page.getByLabel('Email address')).toHaveValue('unfinished@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('StillTyping123!');
    if (mode === 'registration')
      await expect(page.getByLabel('Your name')).toHaveValue('Unfinished Name');
    expect(profileRequests).toBe(requestsBeforeSwitch);
    expect(metadataRequests).toBe(0);
  });
}
