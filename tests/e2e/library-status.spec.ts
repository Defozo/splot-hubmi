import { expect, test } from '@playwright/test';

test('biblioteka ogłasza wyniki filtrów bez odbierania fokusu', async ({ page }) => {
  await page.goto('/#/library');
  const search = page.getByRole('textbox', { name: 'Szukaj w bibliotece' });
  const status = page.locator('#library-results-status');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  await expect(status).toContainText(/\d+ wyświetlonych materiałów/);

  await search.fill('zzzaudytnieistnieje');
  await expect(status).toHaveText('Nie znaleziono materiałów. Zmień temat lub usuń część filtrów.');
  await expect(search).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Nie znaleźliśmy materiałów' })).toBeVisible();

  await search.fill('');
  await expect(status).toContainText(/\d+ wyświetlonych materiałów/);
  await expect(search).toBeFocused();
  await page.getByLabel('Rodzaj materiału').selectOption('course');
  await expect(status).toContainText(/\d+ wyświetlonych materiałów/);
  await expect(page.locator('.innovation-card').first()).toBeVisible();
  await expect(status.locator('article, button, a')).toHaveCount(0);
});
