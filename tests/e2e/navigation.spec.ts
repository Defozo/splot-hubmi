import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function route(page: Page, name: string) {
  await page.goto(`/#/${name}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  if (name !== 'settings') await expect(page.locator('main h1')).toBeVisible();
}

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(el => el === document.activeElement)) return;
  }
  throw new Error('Nie osiągnięto wskazanej kontrolki klawiszem Tab.');
}

async function expectFocusInside(dialog: Locator) {
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
}

test('skip link zachowuje bieżącą trasę i przenosi fokus do jej treści', async ({ page }) => {
  for (const name of ['library', 'search']) {
    await route(page, name);
    // Hash-only goto is an in-app route change. Reload establishes a fresh deep link.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main h1')).toBeVisible();
    const title = await page.locator('main h1').innerText();
    const url = page.url();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(url);
    await expect(page.locator('main h1')).toHaveText(title);
    await expect(page.locator('main')).toBeFocused();
  }
});

test('zmiana trasy i Wstecz/Dalej prowadzą do treści, aktualizacja danych nie zabiera fokusu', async ({ page }) => {
  await route(page, 'home');
  const libraryLink = page.getByRole('link', { name: 'Biblioteka wiedzy', exact: true });
  await tabTo(page, libraryLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/library$/);
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  const filter = page.getByRole('textbox', { name: 'Szukaj w bibliotece' });
  await expect(filter).toBeFocused();
  await filter.fill('sąsiedzkie');
  await expect(page.locator('main .loading')).toHaveCount(0);
  await expect(filter).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('main')).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/#\/library$/);
  await expect(page.locator('main')).toBeFocused();
  // A repeated selection is not a new route and must not invoke the route-focus effect.
  await libraryLink.focus();
  await page.keyboard.press('Enter');
  await expect(libraryLink).toBeFocused();
});

test('mobilne menu jest niedostępne po zamknięciu, przejmuje fokus i obsługuje anulowanie', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, 'library');
  const toggle = page.locator('button.mobile-menu');
  await expect(page.locator('#mobile-navigation')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Nawigacja główna' })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Nawigacja', exact: true });
  await expect(menu).toHaveAttribute('id', await toggle.getAttribute('aria-controls') || '');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expectFocusInside(menu);
  for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); await expectFocusInside(menu); }
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); await expectFocusInside(menu); }
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await menu.getByRole('button', { name: 'Zamknij nawigację' }).press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await page.mouse.click(375, 250);
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test('wybór bieżącej lub nowej trasy i zmiana szerokości nie pozostawiają pułapki menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, 'library');
  const toggle = page.locator('button.mobile-menu');
  const menu = page.getByRole('dialog', { name: 'Nawigacja', exact: true });
  await toggle.click();
  await menu.getByRole('link', { name: 'Biblioteka wiedzy', exact: true }).press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/#\/library$/);
  await expect(page.locator('main')).toBeFocused();
  await toggle.click();
  await menu.getByRole('link', { name: 'Znajdź rozwiązanie', exact: true }).press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/#\/search$/);
  await expect(page.locator('main')).toBeFocused();
  await toggle.click();
  await expectFocusInside(menu);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('link', { name: 'Biblioteka wiedzy', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#desktop-navigation')).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expectFocusInside(menu);
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
});

test('logowanie trzyma fokus i przywraca przycisk otwierający po Escape i zamknięciu', async ({ page }) => {
  await route(page, 'search');
  const trigger = page.getByRole('button', { name: 'Zaloguj się', exact: true });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Wróć do swoich spraw' });
  await expectFocusInside(dialog);
  for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); await expectFocusInside(dialog); }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Zamknij', exact: true }).press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('logowanie z panelu mobilnego otrzymuje fokus bez rywalizacji dialogów', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, 'search');
  const toggle = page.locator('button.mobile-menu');
  await toggle.click();
  const menu = page.getByRole('dialog', { name: 'Nawigacja', exact: true });
  await menu.getByRole('button', { name: 'Porozmawiaj z ROPS' }).press('Enter');
  const login = page.getByRole('dialog', { name: 'Wróć do swoich spraw' });
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectFocusInside(login);
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); await expectFocusInside(login); }
  await page.keyboard.press('Escape');
  await expect(login).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('nagłówek ustawień konta ma właściwą polską nazwę', async ({ page }) => {
  await route(page, 'settings');
  await expect(page.locator('.breadcrumb strong')).toHaveText('Ustawienia konta');
});
