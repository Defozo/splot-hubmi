import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home ma stałą etykietę przy 390 px i przekazuje opis do wyszukiwania', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  const field = page.getByRole('textbox', { name: 'Opisz, czego potrzebujesz', exact: true });
  const label = page.locator('label[for="home-need"]');
  await expect(label).toBeVisible();
  await expect(page.locator('.topbar .badge.demo')).toBeVisible();
  await expect(page.locator('.demo-label-short')).toBeVisible();
  await expect(field).toHaveAccessibleDescription('Wyszukaj bez konta. Zapisz plan, gdy wybierzesz rozwiązanie.');
  await field.fill('Potrzebujemy regularnych spotkań dla seniorów.');
  await expect(label).toBeVisible();
  const bounds = await label.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter(issue => ['serious', 'critical'].includes(issue.impact || ''))).toEqual([]);
  await field.press('Enter');
  await expect(page).toHaveURL(/#\/search$/);
  await expect(page.getByRole('textbox', { name: 'Opisz swoją potrzebę' })).toHaveValue('Potrzebujemy regularnych spotkań dla seniorów.');
});

test('wyniki i porównanie pokazują czytelne tytuły prób z dostępnym oryginałem', async ({ page }) => {
  const stamp = Date.parse('2026-10-03T10:00:00.123Z');
  const originals = [`Karta wspólnego spotkania ${stamp}`, `Spotkania sąsiedzkie E2E ${stamp}`, `Doświadczenie: Pilotaż: Karta wspólnego spotkania ${stamp}`];
  const item = (title: string, id: string) => ({ id, title, summary: 'Opis kontrolnej próby interfejsu.', why: 'Kontrola sposobu prezentacji tytułu.', readiness: 'unknown', conditions: [], sources: [], demo: true, evidenceLevel: 'concept', version: 1 });
  const value = { interpretation: { problem: 'Spotkania sąsiedzkie', outcome: 'Regularny kontakt', audience: 'Seniorzy', context: 'Próba interfejsu' }, innovations: [item(originals[0], 'fixture-1'), item(originals[1], 'fixture-2')], information: [item(originals[2], 'fixture-3')], trace: { corpusVersion: 'browser-fixture', ruleVersion: 'browser-fixture', model: 'none', durationMs: 0 } };
  // The matching action is stubbed over Convex's transport. Queries still use
  // the test backend; this case calls no model and writes no records.
  await page.routeWebSocket(/\.convex\.cloud\/api\/.*\/sync/, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => {
      const body = JSON.parse(String(message));
      if (body.type === 'Action' && body.udfPath === 'matching:match') {
        socket.send(JSON.stringify({ type: 'ActionResponse', requestId: body.requestId, success: true, result: value, logLines: [] }));
      } else server.send(message);
    });
  });
  await page.goto('/#/search');
  await page.getByRole('textbox', { name: 'Opisz swoją potrzebę' }).fill('Chcemy zaplanować spotkania dla seniorów.');
  await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).click();
  await expect(page.locator('.result-card')).toHaveCount(2);
  for (const selector of ['.result-card h3', '.information-item h3']) {
    for (const heading of await page.locator(selector).all()) {
      await expect(heading).toContainText('próba 03.10.2026');
      await expect(heading).toContainText('12:00:00');
      await expect(heading).not.toContainText(String(stamp));
    }
  }
  const cards = page.locator('.result-card');
  await cards.first().getByText('Pełna nazwa próby', { exact: true }).click();
  await expect(cards.first().getByText(originals[0], { exact: true })).toBeVisible();
  for (const card of await cards.all()) {
    const title = await card.locator('h3').innerText();
    const checkbox = card.getByRole('checkbox', { name: `Porównaj: ${title}`, exact: true });
    await expect(checkbox).toHaveAccessibleName(`Porównaj: ${title}`);
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
  }
  await page.getByRole('button', { name: 'Porównaj (2)' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('tbody th').first()).toContainText('próba 03.10.2026');
  await dialog.getByText('Pełna nazwa próby', { exact: true }).first().click();
  await expect(dialog.getByText(originals[0], { exact: true })).toBeVisible();
});
