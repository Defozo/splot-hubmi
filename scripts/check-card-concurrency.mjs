import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:5186';
const browser = await chromium.launch({ headless: true });
const contexts = [];
try {
  const first = await browser.newContext(); contexts.push(first);
  const a = await first.newPage(); a.setDefaultTimeout(60000);
  await a.goto(origin, { waitUntil: 'domcontentloaded' });
  await a.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await a.getByRole('button', { name: 'Instytucja / CUS', exact: true }).click();
  await a.getByRole('button', { name: 'Wyloguj', exact: true }).waitFor();
  console.log('Authenticated institution.');
  await a.goto(`${origin}/#/library`, { waitUntil: 'domcontentloaded' });
  await a.getByLabel('Szukaj w bibliotece').fill('Kręgi sąsiedzkie');
  await a.getByRole('button', { name: 'Kręgi sąsiedzkie', exact: true }).click();
  console.log('Opened innovation.');
  await a.getByRole('button', { name: 'Przygotuj Kartę', exact: true }).click();
  await a.getByLabel('Nazwa usługi').waitFor();
  console.log('Created card.');
  const cardUrl = a.url();
  const second = await browser.newContext({ storageState: await first.storageState() }); contexts.push(second);
  const b = await second.newPage(); b.setDefaultTimeout(60000);
  await b.goto(cardUrl, { waitUntil: 'domcontentloaded' });
  await b.getByLabel('Nazwa usługi').waitFor();
  await a.getByLabel('Cel i oczekiwany efekt').fill('Pierwszy niezapisany szkic na urządzeniu autora.');
  assert.equal(await a.getByRole('button', { name: 'Akceptuję plan jako autor', exact: true }).isDisabled(), true);
  await b.getByLabel('Cel i oczekiwany efekt').fill('Nowsza wersja zapisana w drugiej uprawnionej sesji.');
  await b.getByRole('button', { name: 'Zapisz wersję Karty', exact: true }).click();
  await b.getByRole('status').filter({ hasText: 'Zapisano nową wersję Karty' }).waitFor();
  await a.getByRole('alert').filter({ hasText: 'Karta została zmieniona w innej sesji' }).waitFor();
  assert.equal(await a.getByLabel('Cel i oczekiwany efekt').inputValue(), 'Pierwszy niezapisany szkic na urządzeniu autora.');
  assert.equal(await a.getByRole('button', { name: 'Akceptuję plan jako autor', exact: true }).isDisabled(), true);
  const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Pobierz mój szkic i wczytaj wersję serwera', exact: true }).click()]);
  await mkdir('artifacts/card-concurrency', { recursive: true });
  await download.saveAs('artifacts/card-concurrency/preserved-draft.json');
  assert.equal(await a.getByLabel('Cel i oczekiwany efekt').inputValue(), 'Nowsza wersja zapisana w drugiej uprawnionej sesji.');
  assert.equal(await a.getByRole('button', { name: 'Akceptuję plan jako autor', exact: true }).isDisabled(), false);
  await writeFile('artifacts/card-concurrency/result.json', JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), origin, cardUrl, checks: ['Unsaved draft blocks approval', 'Remote update preserves and marks conflicting local work', 'Download preserves the authors draft', 'Explicit reload shows the current server version'] }, null, 2));
  console.log('PASS: two-session card conflict, approval block, draft export, explicit refresh.');
} catch (error) {
  await mkdir('artifacts/card-concurrency', { recursive: true });
  for (const [index, context] of contexts.entries()) for (const page of context.pages()) {
    await page.screenshot({ path: `artifacts/card-concurrency/error-${index}.png` }).catch(() => {});
    await writeFile(`artifacts/card-concurrency/error-${index}.txt`, `${String(error)}\n${page.url()}\n${await page.locator('body').innerText()}`);
  }
  throw error;
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
}
