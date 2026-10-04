import { chromium } from 'playwright';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'https://agile-kiwi-698.eu-west-1.convex.site';
const deployment = JSON.parse(await readFile('.local/deployment.json', 'utf8'));
const stamp = Date.now();
const previous = process.argv.includes('--resume') ? JSON.parse(await readFile('artifacts/source-review-browser.json', 'utf8')) : null;
const report = { origin, checkedAt: new Date().toISOString(), passed: false, checks: previous?.checks?.slice(0, 2) || [], fixtures: previous?.fixtures || {}, errors: [], ...(previous?.failure ? { resolvedPriorFailure: previous.failure } : {}) };
const checks = report.checks;
await mkdir('artifacts/source-review-browser', { recursive: true });
async function login(email) {
  const c = new ConvexHttpClient(deployment.deploymentUrl);
  const result = await c.action(ref('auth:signIn'), { provider: 'password', params: { email, password: 'SplotDemo2026!', flow: 'signIn' } });
  assert.ok(result.tokens?.token); c.setAuth(result.tokens.token); return c;
}
const staff = await login('rops@splot.demo');
const owner = await login('instytucja@splot.demo');
const query = (client, name, args) => client.query(ref(name), args);
const mutation = (client, name, args) => client.mutation(ref(name), args);
async function until(fn, label, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 500)); }
  throw new Error(`Timed out: ${label}`);
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(45000);
page.on('pageerror', e => report.errors.push(e.message));
let innovationId = previous?.fixtures.innovationId, privateId = previous?.fixtures.privateDraftId;
let sourceId = previous?.fixtures.sourceId, needId = previous?.fixtures.needId, cardId = previous?.fixtures.cardId, approved;
try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.getByRole('button', { name: 'Zespół ROPS', exact: true }).click();
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).waitFor();
  if (!previous) {
  await page.goto(`${origin}/#/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Nowy materiał', exact: true }).click();
  let dialog = page.getByRole('dialog');
  const dateTitle = `Kontrola daty źródła ${stamp}`;
  await dialog.getByLabel(/^Tytuł/).fill(dateTitle);
  await dialog.getByLabel(/^Krótki opis/).fill('Prywatny syntetyczny szkic służący wyłącznie kontroli daty źródła.');
  await dialog.getByLabel(/^Pełna treść/).fill('To izolowany dokument testowy. Nie jest dowodem ani materiałem dla mieszkańców.');
  await dialog.getByLabel('Adres źródła', { exact: true }).fill(`/sources/demo-corpus.html#date-${stamp}`);
  await dialog.getByLabel('Data publikacji źródła', { exact: true }).fill('2026-09-14');
  await dialog.getByRole('button', { name: 'Zapisz szkic materiału', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const rows = await query(staff, 'knowledge:list', { admin: true });
  const material = rows.find(r => r.title === dateTitle); assert.ok(material);
  privateId = material._id; report.fixtures.privateDraftId = privateId;
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(material.sources[0].publishedAt), '2026-09-14');
  assert.equal(material.status, 'draft');
  checks.push('Date entered in real public UI persisted on a private draft source.');
  const row = page.getByRole('row').filter({ has: page.getByText(dateTitle, { exact: true }) });
  await row.getByRole('button', { name: 'Edytuj', exact: true }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Data publikacji źródła', { exact: true }).inputValue(), '2026-09-14');
  await page.screenshot({ path: 'artifacts/source-review-browser/date-readback.png' });
  await dialog.getByLabel('Data publikacji źródła', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Zapisz szkic materiału', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const cleared = await query(staff, 'knowledge:get', { id: privateId });
  assert.equal(cleared.sources[0].publishedAt, undefined);
  await row.getByRole('button', { name: 'Edytuj', exact: true }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Data publikacji źródła', { exact: true }).inputValue(), '');
  await dialog.getByRole('button', { name: 'Zamknij', exact: true }).click();
  checks.push('Reopened date matched the saved day; clearing and reopening removed it from the source.');
  console.log('Date create/read/clear passed.');

  innovationId = await mutation(staff, 'knowledge:save', { data: { title: `Izolowana kontrola źródeł ${stamp}`, summary: 'Syntetyczny test obiegu i świadomego przeglądu źródła.', body: 'Materiał kontrolny do odseparowanego testu jakości. Nie opisuje programu społecznego ani jego skuteczności.', kind: 'innovation', demo: true, tags: ['kontrola-jakości'], problemTags: [], audienceTags: [], requirements: [], sourceUrl: `/sources/demo-corpus.html#review-${stamp}`, publisher: 'Zespół testowy Splot', rights: 'Własny syntetyczny materiał testowy', reviewAt: Date.now() + 86400000 * 180 } });
  report.fixtures.innovationId = innovationId;
  await mutation(staff, 'knowledge:transition', { id: innovationId, action: 'review' });
  await mutation(staff, 'knowledge:transition', { id: innovationId, action: 'publish' });
  const innovation = await until(async () => { const k = await query(staff, 'knowledge:get', { id: innovationId }); return k.status === 'published' ? k : false; }, 'initial fixture publication');
  sourceId = innovation.sources[0]._id; report.fixtures.sourceId = sourceId;
  needId = await mutation(owner, 'hub:save', { kind: 'need', title: `Potrzeba testu źródeł ${stamp}`, data: { description: 'Izolowana potrzeba do testu aktualności źródeł i akceptacji.', watch: false, quiet: true } });
  cardId = await mutation(owner, 'hub:save', { kind: 'card', title: `Karta testu źródeł ${stamp}`, data: { needId, innovationId, goal: 'Sprawdzenie obiegu przeglądu źródeł.', resources: {}, budgetItems: [] } });
  report.fixtures.needId = needId; report.fixtures.cardId = cardId;
  await mutation(owner, 'hub:transition', { id: cardId, action: 'approve' });
  await mutation(staff, 'hub:transition', { id: cardId, action: 'approve' });
  approved = await query(staff, 'hub:get', { id: cardId });
  assert.equal(approved.status, 'approved'); assert.ok(approved.data.approvals.author && approved.data.approvals.operator);
  } else { approved = await query(staff, 'hub:get', { id: cardId }); console.log('Resuming isolated fixture.'); }
  await mutation(staff, 'knowledge:withdrawSource', { sourceId });
  await until(async () => { const c = await query(staff, 'hub:get', { id: cardId }); return c.data.sourceReviewRequired; }, 'source withdrawal invalidates isolated card');
  await page.goto(`${origin}/#/card/${cardId}`, { waitUntil: 'domcontentloaded' });
  const reason = page.getByLabel('Uzasadnienie przeglądu źródeł', { exact: true });
  await reason.waitFor();
  const review = page.getByRole('button', { name: 'Potwierdź przegląd aktualnych źródeł', exact: true });
  assert.equal(await review.isDisabled(), true);
  const decision = 'Sprawdzono niezmienioną wersję i aktualność przypiętego źródła w izolowanym teście kontroli jakości.';
  await reason.fill(decision);
  await review.click();
  await page.locator('.toast-error').waitFor();
  report.withdrawalError = await page.locator('.toast-error').innerText();
  console.log('Withdrawal response:', report.withdrawalError);
  assert.match(report.withdrawalError, /innowacja|Źródło Karty|nową Kartę/);
  let card = await query(staff, 'hub:get', { id: cardId });
  assert.equal(card.data.sourceReviewRequired, true); assert.equal(card.version, approved.version);
  assert.ok(card.data.approvals.author && card.data.approvals.operator);
  await page.screenshot({ path: 'artifacts/source-review-browser/withdrawn-rejected.png' });
  checks.push('Real operator UI shows review reason; blank reason is blocked; withdrawn source is rejected without changing approvals or version.');
  await mutation(staff, 'knowledge:restoreSource', { sourceId, reason: 'Przywrócenie dokładnie tej samej wersji izolowanego źródła po teście blokady.' });
  await mutation(staff, 'knowledge:transition', { id: innovationId, action: 'restore' });
  await until(async () => (await query(staff, 'knowledge:get', { id: innovationId })).status === 'published', 'fixture restored and indexed');
  await review.click();
  card = await until(async () => { const c = await query(staff, 'hub:get', { id: cardId }); return c.data.sourceReviewRequired === false ? c : false; }, 'review from public UI persisted');
  assert.equal(card.status, 'draft'); assert.equal(card.version, approved.version + 1); assert.deepEqual(card.data.approvals, {});
  assert.equal(card.data.sourceReviewDecision.reason, decision); assert.equal(card.data.innovationId, innovationId); assert.deepEqual(card.data.sourceIds, [sourceId]);
  await page.getByText(/Ostatni przegląd źródeł/).waitFor();
  await page.screenshot({ path: 'artifacts/source-review-browser/review-success.png' });
  checks.push('After restoring the same source and innovation version, explicit UI review persisted reason, incremented card version, reset both approvals and preserved pinned IDs.');
  await page.getByRole('button', { name: 'Zaproponuj rozwinięcie', exact: true }).click();
  await page.locator('.assistant-suggestion').first().waitFor({ timeout: 90000 });
  const proposals = page.locator('.assistant-suggestion');
  const proposalTexts = await proposals.locator('p').allTextContents();
  const selectedIndex = proposalTexts.findIndex(text => !Object.values(card.data).includes(text));
  assert.ok(selectedIndex >= 0, 'AI returned at least one genuine suggested change');
  const proposalText = proposalTexts[selectedIndex];
  const beforeCard = card;
  await proposals.nth(selectedIndex).getByRole('button', { name: 'Wstaw do szkicu', exact: true }).click();
  await page.getByText('Masz niezapisane zmiany. Akceptacja i rozpoczęcie pilotażu będą dostępne po zapisaniu tej wersji.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Zatwierdź jako opiekun', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Zapisz wersję Karty', exact: true }).click();
  card = await until(async () => { const c = await query(staff, 'hub:get', { id: cardId }); return c.version > beforeCard.version ? c : false; }, 'accepted AI proposal saved');
  const field = Object.keys(card.data.fieldOrigins || {}).find(key => card.data.fieldOrigins[key].basis === 'ai_proposal' && card.data[key] === proposalText);
  assert.ok(field, 'Saved changed field has explicit accepted AI provenance');
  assert.notEqual(beforeCard.data[field], card.data[field]);
  await page.getByRole('tab', { name: field === 'metrics' ? 'Budżet i pomiar' : 'Cel i plan', exact: true }).click();
  const fieldOrigin = page.getByText('Propozycja AI, świadomie wstawiona do szkicu', { exact: true }).first();
  await fieldOrigin.waitFor(); await fieldOrigin.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/source-review-browser/assistant-applied.png' });
  await writeFile('artifacts/assistant-browser.json', JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), origin, cardId, kind: 'middleman', action: 'Actual UI generation, Wstaw do szkicu, visible provenance, blocked approval before save, persisted server version.', changedField: field, before: beforeCard.data[field] ?? null, after: card.data[field], provenance: card.data.fieldOrigins[field], version: card.version, screenshot: 'artifacts/source-review-browser/assistant-applied.png' }, null, 2));
  checks.push('Real AI suggestion generated, consciously inserted through UI, visibly labeled, approval blocked while dirty, then saved with field provenance.');
  console.log('Assistant generate/apply/save passed.');
  await mutation(owner, 'hub:transition', { id: cardId, action: 'approve', data: { expectedVersion: card.version } });
  card = await query(staff, 'hub:get', { id: cardId }); assert.equal(card.status, 'expert_review');
  await mutation(staff, 'hub:transition', { id: cardId, action: 'approve', data: { expectedVersion: card.version } });
  assert.equal((await query(staff, 'hub:get', { id: cardId })).status, 'approved');
  checks.push('Author and operator could approve the reviewed card again in two separate authenticated API sessions.');
  assert.deepEqual(report.errors, []); report.passed = true;
  console.log('Source review lifecycle passed.');
} catch (error) {
  report.failure = String(error);
  await page.screenshot({ path: 'artifacts/source-review-browser/failure.png' }).catch(() => {});
  await writeFile('artifacts/source-review-browser/failure.txt', `${String(error)}\n${page.url()}\n${await page.locator('body').innerText().catch(() => '')}`);
} finally {
  if (innovationId) {
    try {
      const k = await query(staff, 'knowledge:get', { id: innovationId });
      if (k.status === 'published') await mutation(staff, 'knowledge:transition', { id: innovationId, action: 'withdraw' });
      report.cleanup = { innovationStatus: (await query(staff, 'knowledge:get', { id: innovationId })).status, privateDraftStatus: privateId ? (await query(staff, 'knowledge:get', { id: privateId })).status : null };
      assert.equal(report.cleanup.innovationStatus, 'withdrawn');
    } catch (error) { report.cleanupError = String(error); report.passed = false; }
  }
  report.completedAt = new Date().toISOString();
  await writeFile('artifacts/source-review-browser.json', JSON.stringify(report, null, 2));
  await context.close(); await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, cleanup: report.cleanup, failure: report.failure, cleanupError: report.cleanupError }));
if (!report.passed) process.exitCode = 1;
