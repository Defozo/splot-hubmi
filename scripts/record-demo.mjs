/** Actual UI recording. Uses only synthetic demonstration accounts and data.
 * Run: node scripts/record-demo.mjs [http://127.0.0.1:5186]
 * Raw recordings and timestamped action manifests stay under artifacts/demo-raw.
 * Deterministic cuts and captions are rendered under output/_video_work.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const origin = process.argv[2] || 'http://127.0.0.1:5186';
const publishedUrl = 'https://agile-kiwi-698.eu-west-1.convex.site';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const resume = process.argv[3] ? JSON.parse(await readFile(resolve(process.argv[3]), 'utf8')) : null;
const retake = process.argv[4];
const raw = resume ? dirname(resolve(process.argv[3])) : resolve('artifacts', 'demo-raw', stamp);
const work = resolve('output', '_video_work');
const output = resolve('output');
await mkdir(raw, { recursive: true }); await mkdir(join(work, 'render'), { recursive: true }); await mkdir(join(work, 'manifests'), { recursive: true }); await mkdir(join(work, 'frames'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const states = {};
const scenes = (resume?.scenes || []).filter(scene => scene.id !== retake);
const shared = resume?.shared || { title: 'Sąsiedzkie rozmowy: jesienny pilotaż', offerTitle: 'Sala biblioteki: jesienne spotkania Splotu', innovationTitle: 'Spotkania sąsiedzkie z czytelnym dojściem: wariant biblioteczny' };
const roles = { institution: 'Instytucja / CUS', expert: 'Ekspertka', admin: 'Zespół ROPS', resident: 'Mieszkanka' };
const hold = ms => new Promise(resolve => setTimeout(resolve, ms));
const go = async (page, route) => { await page.goto(`${origin}/#/${route}`, { waitUntil: 'domcontentloaded' }); await page.locator('main h1').waitFor(); await page.waitForTimeout(350); };
const click = async (page, name) => { const button = page.getByRole('button', { name, exact: true }); await button.scrollIntoViewIfNeeded(); await button.click(); };
const visible = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); await hold(700); };

for (const [role, label] of Object.entries(roles)) {
  if (retake && resume?.scenes.find(scene => scene.id === retake)?.role !== role) continue;
  const context = await browser.newContext({ viewport: { width: 1600, height: 810 } }); const page = await context.newPage(); page.setDefaultTimeout(60000);
  await page.goto(origin, { waitUntil: 'domcontentloaded' }); await click(page, 'Zaloguj się'); await click(page, label); await page.getByRole('button', { name: 'Wyloguj', exact: true }).waitFor();
  states[role] = await context.storageState(); await context.close();
}
console.log(`${Object.keys(states).length} synthetic accounts authenticated. ${resume ? 'Resuming existing capture.' : 'Preparing one resource offer.'}`);
if (!resume) {
  const context = await browser.newContext({ storageState: states.expert }); const page = await context.newPage(); page.setDefaultTimeout(60000);
  await go(page, 'partners'); await click(page, 'Dodaj ofertę'); await page.getByLabel('Nazwa oferty').fill(shared.offerTitle); await page.getByLabel('Rodzaj zasobu').selectOption('accessibleRoom'); await page.getByLabel('Warunki udostępnienia, kompetencje i dostępne terminy').fill('Syntetyczna sala z bezprogowym wejściem. Jedna instytucja w danym okresie. Dostępność wymaga potwierdzenia zaproszenia.'); await click(page, 'Opublikuj ofertę'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await context.close();
}

async function shot(id, role, caption, targetDuration, route, action) {
  if (scenes.some(scene => scene.id === id)) return;
  const context = await browser.newContext({ ...(role ? { storageState: states[role] } : {}), viewport: { width: 1600, height: 810 }, recordVideo: { dir: raw, size: { width: 1600, height: 810 } }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(60000); const createdAt = Date.now(); let startedAt;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await go(page, route); await page.evaluate(() => document.fonts.ready); await hold(350); startedAt = Date.now();
    await action(page); await hold(1400);
    const finishedAt = Date.now(); const video = page.video();
    await page.screenshot({ path: join(raw, `${id}-final.png`) });
    await page.close(); await Promise.race([context.close(), hold(15000)]); const file = await video.path();
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', file], { encoding: 'utf8', windowsHide: true });
    if (probe.status !== 0) throw new Error(`Cannot inspect the captured scene ${id}`);
    const recordedDuration = Number(JSON.parse(probe.stdout).format.duration);
    // Recorder initialization can lag wall clock under load. Anchor the selected
    // interval at the real recording end, retaining the final confirmed UI state.
    const sourceOut = recordedDuration;
    const sourceIn = Math.max(0, sourceOut - (finishedAt - startedAt) / 1000);
    const scene = { id, role: role || 'anonymous', caption, targetDuration, source: file, sourceIn, sourceOut, wallClock: { setup: (startedAt - createdAt) / 1000, actions: (finishedAt - startedAt) / 1000 }, route, capturedAt: new Date().toISOString(), errors };
    scenes.push(scene); scenes.sort((a, b) => a.id.localeCompare(b.id)); await writeFile(join(raw, 'scenes.json'), JSON.stringify({ origin, publishedUrl, shared, scenes }, null, 2));
    console.log(`Captured ${id}: ${Math.round(scene.sourceOut - scene.sourceIn)} s raw, ${targetDuration} s final.`);
  } catch (error) {
    await page.screenshot({ path: join(raw, `${id}-ERROR.png`), fullPage: true }).catch(() => {}); await writeFile(join(raw, `${id}-ERROR.txt`), `${error.stack}\n${(await page.locator('body').innerText()).slice(-12000)}`); await page.close().catch(() => {}); await Promise.race([context.close(), hold(10000)]); throw error;
  }
}

try {
  await shot('01-potrzeba', 'institution', 'Splot dla HubMI. Zaczynamy od potrzeby, nie od formularza instytucji. Wszystkie osoby i działania w filmie są demonstracyjne.', 14, 'home', async page => {
    await hold(1800); await page.getByLabel('Opisz, czego potrzebujesz').fill('Starsi mieszkańcy Zielonej Gminy są samotni. Potrzebują cotygodniowych spotkań i kontaktu z sąsiadami.'); await hold(650); await page.getByRole('button', { name: 'Znajdź rozwiązanie', exact: true }).click();
    await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).click(); await page.getByText('Tak rozumiemy Twoją potrzebę').waitFor(); await visible(page, page.locator('.interpretation'));
    await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).waitFor({ state: 'visible' }); await page.locator('.question-card').waitFor(); await hold(1600);
  });
  await shot('02-dopasowanie', 'institution', 'Dwa rodzaje wyników, źródła i jawne warunki. Odpowiedź na jedno pytanie zmienia gotowość konkretnego rozwiązania.', 17, 'search', async page => {
    await page.getByLabel('Opisz swoją potrzebę').fill('Starsi mieszkańcy Zielonej Gminy są samotni. Potrzebują cotygodniowych spotkań i kontaktu z sąsiadami.'); await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).click(); await page.locator('.question-card').waitFor();
    await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania', exact: true }).waitFor();
    await visible(page, page.locator('.question-card')); await page.locator('.question-card').getByRole('button', { name: /^(Nie|Nie mamy tego zasobu)$/ }).click();
    await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania', exact: true }).waitFor();
    const more = page.getByRole('button', { name: 'Pokaż pozostałe rozwiązania' }); if (await more.count()) await more.click();
    const blocked = page.locator('.result-card').filter({ has: page.locator('.condition.unmet') }).first();
    await blocked.waitFor(); await visible(page, blocked); await hold(2200);
    await page.getByRole('button', { name: 'Zapisz moją potrzebę' }).click(); await page.getByRole('status').filter({ hasText: 'Zapisano potrzebę' }).waitFor();
    await page.locator('.result-card').filter({ has: page.getByRole('heading', { name: 'Kręgi sąsiedzkie', exact: true }) }).getByRole('button', { name: 'Przygotuj Kartę wdrożenia' }).click(); await page.getByLabel('Nazwa usługi').waitFor(); shared.card = page.url().split('#/')[1];
  });
  await shot('03-karta', 'institution', 'Middleman zamienia innowację w lokalną usługę. Karta przypina źródła i odróżnia deklaracje od propozycji AI.', 15, shared.card, async page => {
    await page.getByLabel('Nazwa usługi').fill(shared.title); await page.getByLabel('Cel i oczekiwany efekt').fill('Sprawdzić, czy cztery dostępne spotkania pomagają seniorom nawiązać nowe relacje.'); await page.getByLabel('Działania, odpowiedzialność i terminy').fill('CUS koordynuje cztery cotygodniowe spotkania. Uczestnicy oceniają dostępność i użyteczność.');
    await page.getByRole('tab', { name: 'Warunki i partnerzy' }).click(); const selects = page.getByRole('combobox', { name: /Stan zasobu:/ }); await selects.first().selectOption('yes'); await selects.nth(1).selectOption('unknown'); await click(page, 'Zapisz wersję Karty'); await hold(1100);
    const offer = page.locator('.list-row').filter({ has: page.getByText(shared.offerTitle, { exact: true }) }).first(); await visible(page, offer); await offer.getByRole('button', { name: 'Zaproś', exact: true }).click(); await page.getByLabel('Proponowany zakres udziału').fill('Prosimy o udostępnienie dostępnej sali na cztery spotkania sąsiedzkie. CUS zapewnia koordynację.'); await hold(900); await click(page, 'Wyślij zaproszenie'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  await shot('04-partner', 'expert', 'Partner sam potwierdza zakres i termin. Serwer sprawdza pojemność zasobu, aktualność oferty i nakładające się rezerwacje.', 8, 'partners', async page => {
    const invitation = page.locator('.panel.list-row').filter({ hasText: shared.offerTitle }).first(); await visible(page, invitation); await invitation.getByRole('button', { name: 'Potwierdź zakres' }).click(); await invitation.getByText('Przyjęto', { exact: true }).waitFor(); await hold(1700);
  });
  await shot('05-fiszka-canwa', 'institution', 'Fiszka działa przez cały rok. Canwa pomaga zaplanować odbiorców, działania, zasoby i mierniki pierwszego mikrotestu.', 15, 'idea/new', async page => {
    await page.getByLabel('Nazwa pomysłu').fill('Sąsiedzka kawa i rozmowa'); await page.getByLabel('Jaki problem rozwiązujesz i na czym polega pomysł?').fill('Seniorzy mieszkający samotnie potrzebują regularnych relacji. Przygotujemy małe dostępne spotkania przy kawie.'); await page.getByLabel('Dla kogo jest ten pomysł?').fill('Dwanaście osób starszych w Zielonej Gminie');
    await page.getByRole('tab', { name: '2. Canwa i mikrotest' }).click(); await page.getByLabel('Jak to zrobimy?', { exact: true }).fill('Cztery spotkania w bibliotece z koordynatorem i rozmową o potrzebach.'); await page.getByLabel('Jak poznamy efekt?', { exact: true }).fill('Ocena użyteczności, bariery dostępności, liczba nowych kontaktów przed i po.'); await visible(page, page.getByLabel('Jak poznamy efekt?', { exact: true })); await click(page, 'Przekaż pomysł do ROPS'); await page.getByRole('status').filter({ hasText: 'Pomysł trafił do ROPS' }).waitFor(); shared.idea = page.url().split('#/')[1]; shared.ideaId = shared.idea.split('/')[1]; await hold(1100);
  });
  await shot('06-wniosek', 'institution', 'Każdy nabór ma własny formularz. Po sprawdzeniu pól, terminu i budżetu serwer zapisuje niezmienny wniosek oraz numer przyjęcia.', 17, 'calls', async page => {
    await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Mikroinnowacje blisko ludzi' }) }).getByRole('button', { name: 'Przygotuj wniosek' }).click(); await page.getByLabel('Przenieś treści z fiszki pomysłu').selectOption(shared.ideaId); await click(page, 'Utwórz szkic'); await page.getByLabel('Plan testu').fill('Cztery spotkania w dostępnej sali. Po każdym spotkaniu zbierzemy uwagi i ocenę użyteczności.'); await page.getByLabel('Uczestnicy').fill('12'); await page.getByRole('checkbox', { name: /Potwierdzenie/ }).check(); await page.getByLabel('Wnioskowany budżet (zł)').fill('1200'); await hold(900); await click(page, 'Przejrzyj i złóż'); await hold(700); await click(page, 'Złóż wniosek w HubMI'); await page.getByRole('heading', { name: 'Wniosek przyjęty w HubMI' }).waitFor(); await visible(page, page.locator('.receipt')); await hold(2000);
  });
  await shot('07-rozmowa-autorka', 'institution', 'Pomysł trafia do ROPS. Prywatny wątek łączy pytania, odpowiedzi i uzgodnienia z konkretną sprawą.', 7, 'messages', async page => {
    if (retake) { await page.locator('.thread-list').getByRole('button', { name: /Uzgodnienie sąsiedzkich spotkań/ }).first().click(); await visible(page, page.locator('.message-list').getByText(/Partner potwierdził salę/).last()); await hold(1400); return; }
    await click(page, 'Nowa rozmowa'); await page.getByLabel('Temat rozmowy').fill('Uzgodnienie sąsiedzkich spotkań'); await page.getByLabel('Treść wiadomości').fill('Partner potwierdził salę. Czy możemy zatwierdzić Kartę i otworzyć zapisy do mikrotestu?'); await click(page, 'Wyślij'); await page.locator('.message-list').getByText(/Partner potwierdził salę/).waitFor(); await hold(1000);
  });
  await shot('08-rozmowa-rops', 'admin', 'Druga sesja: opiekun odpowiada, a autorka widzi zmianę bez ponownego wczytywania sprawy.', 6, 'messages', async page => {
    if (retake) { await page.locator('.thread-list').getByRole('button', { name: /Uzgodnienie sąsiedzkich spotkań/ }).first().click(); await visible(page, page.locator('.message-list').getByText(/Potwierdzam zakres testu/).last()); await hold(1400); return; }
    await page.locator('.thread-list').getByRole('button', { name: /Uzgodnienie sąsiedzkich spotkań/ }).first().click(); await page.getByLabel('Treść wiadomości').fill('Tak. Potwierdzam zakres testu. Proszę zaakceptować własną wersję Karty; następnie zatwierdzę ją jako opiekun.'); await click(page, 'Wyślij'); await page.locator('.message-list').getByText(/Potwierdzam zakres testu/).waitFor(); await hold(1100);
  });
  // Acceptance steps are executed through the UI. They are in the raw evidence;
  // they have their own short final scene rather than silently changing state.
  await shot('09-akceptacje', 'institution', 'Autor akceptuje konkretną wersję Karty. Druga, niezależna akceptacja należy do opiekuna ROPS.', 5, shared.card, async page => { await click(page, 'Akceptuję plan jako autor'); await hold(1400); });
  await shot('10-pilot-plan', 'admin', 'Zatwierdzony plan prowadzi do pilotażu. Koordynator otwiera zapisy dla określonej liczby uczestników.', 8, shared.card, async page => {
    await click(page, 'Zatwierdź jako opiekun'); await page.getByRole('button', { name: 'Przygotuj pilotaż' }).waitFor(); await click(page, 'Przygotuj pilotaż'); await page.getByRole('button', { name: 'Otwórz zapisy' }).waitFor(); shared.pilot = page.url().split('#/')[1]; await click(page, 'Otwórz zapisy'); await hold(1000);
  });
  await shot('11-zapis-testera', 'resident', 'Uczestniczka zgłasza dobrowolny udział. Zapis wymaga osobnego przyjęcia przez koordynatora.', 7, shared.pilot, async page => { await page.getByRole('checkbox', { name: /Dobrowolnie zgłaszam/ }).check(); await click(page, 'Zgłoś chęć udziału'); await page.getByText('Czekamy na potwierdzenie koordynatora.').waitFor(); await hold(1200); });
  await shot('12-start-pilotu', 'admin', 'Przed rozpoczęciem serwer ponownie sprawdza obowiązkowe warunki, wersję Karty oraz ważność rezerwacji.', 7, shared.pilot, async page => { await click(page, 'Przyjmij do testu'); await click(page, 'Rozpocznij test'); await page.getByRole('button', { name: 'Zakończ test i zbierz wnioski' }).waitFor(); await hold(1400); });
  await shot('13-opinia', 'resident', 'Ocena, bariera i propozycja poprawy zostają przypisane do testowanej wersji usługi. Wyników demonstracji nie traktujemy jako dowodu skuteczności.', 10, shared.pilot, async page => {
    await page.getByLabel('Co utrudniało udział?').fill('Zaproszenie nie opisywało dostępnego wejścia do biblioteki.'); await page.getByLabel('Co warto poprawić?').fill('Dodajmy czytelną instrukcję dojścia i numer do koordynatora.'); await page.getByLabel('Wykonałem / wykonałam zadanie testowe').check(); await click(page, 'Przekaż opinię'); await page.getByRole('status').filter({ hasText: 'Opinię przypisano' }).waitFor(); await hold(1200);
  });
  await shot('14-wnioski-kuratora', 'admin', 'Kurator ocenia wyniki i ograniczenia. Dopiero oczyszczone, zatwierdzone doświadczenie może trafić do publicznej wiedzy.', 10, shared.pilot, async page => {
    await visible(page, page.locator('.feedback-entry').first()); await hold(1300); await click(page, 'Zakończ test i zbierz wnioski'); await page.getByLabel('Wniosek kuratora do publicznej wiedzy').fill('W demonstracyjnym teście wykryto brak informacji o dostępnym wejściu. W kolejnym wariancie zaproszenie zawiera plan dojścia.'); await page.getByLabel('Ograniczenia i negatywne wyniki').fill('Jedna syntetyczna odpowiedź, bez grupy porównawczej. To obserwacja użyteczności, nie dowód skuteczności społecznej.'); await click(page, 'Zatwierdź opis doświadczenia'); await hold(1000);
  });
  await shot('15-publikacja', 'admin', 'ROPS publikuje nową wiedzę z historią wersji. Istotna zmiana uruchamia ponowne sprawdzenie obserwowanych potrzeb.', 10, 'admin', async page => {
    const experience = page.locator('tr').filter({ hasText: `Doświadczenie: Pilotaż: ${shared.title}` }).first(); await visible(page, experience); if (await experience.getByRole('button', { name: 'Opublikuj', exact: true }).count()) await experience.getByRole('button', { name: 'Opublikuj', exact: true }).click(); await hold(900);
    await click(page, 'Nowy materiał'); await page.getByLabel(/^Tytuł/).fill(shared.innovationTitle); await page.getByLabel('Krótki opis').fill('Stałe spotkania seniorów przeciwdziałające samotności. Zaproszenie zawiera plan dostępnego dojścia oraz kontakt do koordynatora. Scenariusz demonstracyjny.'); await page.getByLabel('Pełna treść / transkrypcja').fill('Autorska koncepcja demonstracyjna regularnych spotkań sąsiedzkich dla seniorów. Zawiera czytelny opis dostępnego wejścia, stałego koordynatora i plan małego testu. Bez potwierdzonej skuteczności społecznej.'); await page.getByLabel('Tagi problemów').fill('samotnosc'); await page.getByLabel('Tagi odbiorców').fill('seniorzy'); await page.getByLabel('Adres źródła', { exact: true }).fill('/sources/demo-corpus.html'); await click(page, 'Zapisz szkic materiału'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); const row = page.locator('tr').filter({ hasText: shared.innovationTitle }).first(); await row.getByRole('button', { name: 'Do weryfikacji', exact: true }).click(); await row.getByRole('button', { name: 'Opublikuj', exact: true }).click(); await hold(1500);
  });
  await shot('16-powrot-do-potrzeby', 'institution', 'Za zgodą autorki Splot wraca do obserwowanej potrzeby. Powiadomienie wyjaśnia, co zmieniło się w wiedzy.', 8, 'notifications', async page => { const notice = page.locator('.notification-card').filter({ hasText: process.env.DEMO_NOTICE_TEXT || 'Nowa wiedza dla obserwowanej potrzeby' }).first(); await notice.waitFor({ timeout: 90000 }); await visible(page, notice); await hold(1800); });
  await shot('17-brak-dopasowania', null, 'Gdy brakuje podstaw, system mówi o tym wprost. Pozostają konsultacja i możliwość zapisania potrzeby oraz własnego pomysłu.', 7, 'search', async page => { await page.getByLabel('Opisz swoją potrzebę').fill('Potrzebujemy algorytmu do przewidywania kursu kryptowalut i zysków inwestycyjnych.'); await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).click(); await page.getByRole('heading', { name: 'Jeszcze nie mamy potwierdzonego kierunku' }).waitFor(); await visible(page, page.getByRole('heading', { name: 'Jeszcze nie mamy potwierdzonego kierunku' })); await hold(1500); });
  await shot('18-finale', null, 'Splot dla HubMI · Plan: 220–330 USD/mies. + praca.\nDemo: agile-kiwi-698.eu-west-1.convex.site · DEFOZO SOFTWARE HOUSE · Michał Kiełtyka.', 8, 'home', async page => { await hold(2100); });
} finally { await browser.close(); }

const duration = scenes.reduce((sum, scene) => sum + scene.targetDuration, 0);
if (duration > 180) throw new Error(`Film would exceed 180 s: ${duration}`);
await writeFile(join(work, 'manifests', 'capture.json'), JSON.stringify({ createdAt: new Date().toISOString(), origin, publishedUrl, shared, scenes, duration, privacy: 'Only synthetic demonstration accounts. Browser authentication state was not written to the artifact folder.' }, null, 2));
console.log(`Capture complete: ${duration} s planned. Run node scripts/render-demo.mjs "${join(raw, 'scenes.json')}".`);
