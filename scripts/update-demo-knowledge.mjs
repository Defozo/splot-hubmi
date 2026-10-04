/** Publish an actual revision of the film's own synthetic knowledge item. */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(90000);
try {
  await page.goto(manifest.origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.getByRole('button', { name: 'Zespół ROPS', exact: true }).click();
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).waitFor();
  await page.goto(`${manifest.origin}/#/admin`, { waitUntil: 'domcontentloaded' });
  const row = page.locator('tr').filter({ hasText: manifest.shared.innovationTitle }).first();
  await row.getByRole('button', { name: 'Edytuj', exact: true }).click();
  await page.getByLabel('Krótki opis').fill('Stałe spotkania seniorów przeciwdziałające samotności. Nowa wersja dodaje czytelną instrukcję bezprogowego dojścia i kontakt do koordynatora. Scenariusz demonstracyjny.');
  await page.getByLabel('Pełna treść / transkrypcja').fill('Autorska koncepcja demonstracyjna regularnych spotkań sąsiedzkich dla seniorów. Zaproszenie zawiera od tej wersji czytelną instrukcję bezprogowego dojścia, numer kontaktowy do koordynatora i opis małego testu. Zmianę wprowadzono po syntetycznej opinii uczestniczki. To obserwacja użyteczności, bez potwierdzonej skuteczności społecznej.');
  await page.getByRole('button', { name: 'Zapisz szkic materiału', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await row.getByRole('button', { name: 'Do weryfikacji', exact: true }).click();
  await row.getByRole('button', { name: 'Opublikuj', exact: true }).click();
  await row.getByText('Opublikowano', { exact: true }).waitFor();
  await writeFile('output/_video_work/manifests/knowledge-revision.json', JSON.stringify({ title: manifest.shared.innovationTitle, completedAt: new Date().toISOString(), performedVia: 'actual admin UI', checked: 'Published state after indexing', change: 'Instruction for accessible entry after synthetic feedback' }, null, 2));
  console.log(`Published actual revision: ${manifest.shared.innovationTitle}`);
} catch (error) {
  await page.screenshot({ path: 'output/_video_work/reports/knowledge-revision-error.png' });
  await writeFile('output/_video_work/reports/knowledge-revision-error.txt', `${error.stack}\n${await page.locator('body').innerText()}`);
  throw error;
} finally { await context.close(); await browser.close(); }
