import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page, role: 'institution' | 'admin' = 'institution') {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.getByRole('button', { name: role === 'admin' ? 'Zespół ROPS' : 'Instytucja / CUS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj', exact: true })).toBeVisible();
}

async function route(page: Page, path: string) {
  await page.goto(`/#/${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toBeVisible();
}

async function panelFor(page: Page, tab: Locator) {
  const panelId = await tab.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  return page.locator(`[id="${panelId}"]`);
}

async function assertSelection(page: Page, list: Locator, selected: number) {
  const tabs = list.getByRole('tab');
  const ids: string[] = [];
  for (let i = 0; i < await tabs.count(); i++) {
    const tab = tabs.nth(i), panel = await panelFor(page, tab);
    const tabId = await tab.getAttribute('id');
    expect(tabId).toBeTruthy();
    await expect(tab).toHaveAttribute('aria-selected', String(i === selected));
    await expect(tab).toHaveAttribute('tabindex', i === selected ? '0' : '-1');
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', tabId!);
    if (i === selected) await expect(panel).toBeVisible();
    else await expect(panel).toBeHidden();
    ids.push((await panel.getAttribute('id'))!);
  }
  expect(new Set(ids).size).toBe(ids.length);
}

async function keyboardPattern(page: Page, list: Locator) {
  const tabs = list.getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  const last = await tabs.count() - 1;
  await tabs.first().focus();
  await assertSelection(page, list, 0);
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await assertSelection(page, list, 1);
  await page.keyboard.press('End');
  await expect(tabs.nth(last)).toBeFocused();
  await assertSelection(page, list, last);
  await page.keyboard.press('ArrowRight');
  await expect(tabs.first()).toBeFocused();
  await assertSelection(page, list, 0);
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(last)).toBeFocused();
  await assertSelection(page, list, last);
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await assertSelection(page, list, 0);
  await page.keyboard.press('Enter');
  await assertSelection(page, list, 0);
  await page.keyboard.press('Tab');
  await expect(await panelFor(page, tabs.first())).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(tabs.first()).toBeFocused();
}

test('ROPS: zakładki mają powiązane panele, jeden punkt Tab i pełną obsługę klawiatury', async ({ page }) => {
  await login(page, 'admin');
  await route(page, 'admin');
  const list = page.getByRole('tablist', { name: 'Panel administracyjny' });
  await expect(list.getByRole('tab')).toHaveCount(5);
  await keyboardPattern(page, list);
  await list.getByRole('tab', { name: 'Nabory i wnioski' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Wnioski i przekazanie', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nowy nabór', exact: true })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
});

test('audyt ROPS pokazuje polskie operacje i zachowuje pełną diagnostykę na żądanie', async ({ page }) => {
  await login(page, 'admin');
  await route(page, 'admin');
  await page.getByRole('tab', { name: 'Operacje i audyt' }).press('Enter');
  const audit = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ślad audytowy', exact: true }) });
  const row = audit.locator('tbody tr').first();
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1)).toContainText(/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3}/);
  await expect(row.locator('td').nth(2).locator('strong')).not.toBeEmpty();
  const details = row.locator('details');
  await expect(details.locator('code')).toHaveCount(2);
  await expect(details.locator('code').first()).toBeHidden();
  await details.locator('summary').press('Enter');
  const action = await details.locator('code').first().innerText();
  const entityId = await details.locator('code').nth(1).innerText();
  expect(action.length).toBeGreaterThan(0);
  expect(entityId.length).toBeGreaterThan(10);
  await expect(row.locator('td').nth(1)).not.toHaveText(action);
  await expect(details).toContainText('Pełny identyfikator obiektu');
});

test('Canwa zachowuje szkic przy zmianie paneli, a opisy i pochodzenie są powiązane z polami', async ({ page }) => {
  await login(page);
  await route(page, 'idea/new');
  const list = page.getByRole('tablist', { name: 'Etap tworzenia pomysłu' });
  await keyboardPattern(page, list);
  await page.getByRole('textbox', { name: 'Nazwa pomysłu', exact: true }).fill('Szkic do kontroli zakładek');
  await page.getByRole('textbox', { name: 'Jaki problem rozwiązujesz i na czym polega pomysł?', exact: true }).fill('Mieszkańcy potrzebują miejsca spotkań.');
  await list.getByRole('tab', { name: '1. Fiszka pomysłu' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByLabel('Dla kogo?', { exact: true }).fill('Starsi mieszkańcy osiedla');
  const beneficiaries = page.getByLabel('Dla kogo?', { exact: true });
  await expect(beneficiaries).toHaveAccessibleDescription('Czyj głos włączysz do projektowania? Deklaracja autora');
  await list.getByRole('tab', { name: '2. Canwa i mikrotest' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.process-flow')).toContainText('Starsi mieszkańcy osiedla');
  await page.keyboard.press('Home');
  await expect(page.getByRole('textbox', { name: 'Nazwa pomysłu', exact: true })).toHaveValue('Szkic do kontroli zakładek');
  await expect(page.getByRole('textbox', { name: 'Jaki problem rozwiązujesz i na czym polega pomysł?', exact: true })).toHaveValue('Mieszkańcy potrzebują miejsca spotkań.');
  await page.keyboard.press('ArrowRight');
  await expect(beneficiaries).toHaveValue('Starsi mieszkańcy osiedla');
  await expect(page.getByRole('button', { name: 'Zapisz szkic', exact: true })).toBeVisible();
});

test('Moje sprawy i Karta zachowują nawigację klawiaturą oraz niezapisane dane planu', async ({ page }) => {
  await login(page);
  await route(page, 'cases');
  const cases = page.getByRole('tablist', { name: 'Rodzaj sprawy' });
  await keyboardPattern(page, cases);
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Otwórz Kartę', exact: true }).first().press('Enter');
  const card = page.getByRole('tablist', { name: 'Części Karty' });
  await keyboardPattern(page, card);
  const goal = page.getByRole('textbox', { name: 'Cel i oczekiwany efekt', exact: true });
  const value = `${await goal.inputValue()} Lokalny dopisek do kontroli zakładek.`;
  await goal.fill(value);
  await expect(goal).toHaveAccessibleDescription('Deklaracja autora');
  await expect(page.getByLabel('Mechanizm działania', { exact: true })).toHaveAccessibleDescription(/Pochodzenie: opis wybranej innowacji/);
  await card.getByRole('tab', { name: 'Cel i plan', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { name: 'Jawny kosztorys' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading', { name: 'Warunki zastosowania', exact: true })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(goal).toHaveValue(value);
  await expect(page.getByRole('button', { name: 'Zapisz wersję Karty', exact: true })).toBeVisible();
});

test('mobilne zakładki Canwy przewijają fokus do aktywnej opcji i nie ujawniają ukrytych pól', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await route(page, 'idea/new');
  const list = page.getByRole('tablist', { name: 'Etap tworzenia pomysłu' });
  await keyboardPattern(page, list);
  await page.keyboard.press('End');
  const selected = list.getByRole('tab', { selected: true });
  await expect(selected).toHaveText('3. Mapa działania');
  await expect(selected).toBeInViewport();
  await expect(page.getByRole('textbox', { name: 'Nazwa pomysłu', exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: '3. Mapa działania' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Zapisz szkic', exact: true })).toBeFocused();
});
