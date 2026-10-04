import { expect, test } from '@playwright/test';

test('opis potrzeby zachowuje dostępne objaśnienie błędu i usuwa je po poprawie', async ({ page }) => {
  await page.goto('/#/search');
  const description = page.getByRole('textbox', { name: 'Opisz swoją potrzebę' });
  const hint = 'Nie podawaj danych osobowych ani szczegółów zdrowotnych.';
  const error = 'Opisz potrzebę w co najmniej 12 znakach.';
  await expect(description).toHaveAccessibleDescription(hint);
  await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania', exact: true }).click();
  await expect(description).toBeFocused();
  await expect(description).toHaveAttribute('aria-invalid', 'true');
  await expect(description).toHaveAccessibleDescription(`${hint} ${error}`);
  await expect(page.locator('#need-description-error')).toHaveAttribute('role', 'alert');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(description).toBeFocused();
  await expect(description).toHaveAccessibleDescription(`${hint} ${error}`);

  // Revalidation of the field does not submit a matching request.
  await description.fill('Starsze osoby chcą spotykać się z sąsiadami.');
  await expect(description).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#need-description-error')).toHaveCount(0);
  await expect(description).toHaveAccessibleDescription(hint);
  await expect(description).toHaveAttribute('aria-describedby', 'need-description-hint');
});
