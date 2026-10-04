import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const shots = 'artifacts/screenshots';
const baseUrl = process.env.E2E_URL || 'http://127.0.0.1:5186';
async function screenshot(page: Page, name: string) {
  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}-full.png`, fullPage: true });
  if(name === '02-matching' || name === '03-barrier') await page.locator('.interpretation').scrollIntoViewIfNeeded();
  else if(name === '02-match-result') await page.locator('.result-card').first().evaluate(el=>el.scrollIntoView({block:'start'}));
  else if(name === '05-library-map') await page.getByRole('region',{name:'Mapa regionalnych wskaźników'}).evaluate(el=>el.scrollIntoView({block:'start'}));
  else if(name === '09-feedback') await page.getByRole('heading',{name:'Podsumowanie testu',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));
  else await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
}
async function checkFormAccessibility(page: Page, name: string) {
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await writeFile(`artifacts/accessibility-${name}.json`,JSON.stringify({testedAt:new Date().toISOString(),url:page.url(),violations:result.violations},null,2));
  expect(result.violations.filter(v=>['critical','serious'].includes(v.impact || ''))).toEqual([]);
}
async function login(page: Page, role: 'institution' | 'resident' | 'admin' | 'expert') {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  const roleLabel = { institution: 'Instytucja / CUS', resident: 'Mieszkanka', admin: 'Zespół ROPS', expert: 'Ekspertka' }[role];
  await page.getByRole('button', { name: roleLabel, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj', exact: true })).toBeVisible();
}
async function route(page: Page, hash: string) { await page.goto(`${baseUrl}/#/${hash}`, { waitUntil: 'domcontentloaded' }); await expect(page.locator('main h1')).toBeVisible(); await expect(page.locator('main .loading')).toHaveCount(0); }
async function match(page: Page, description = 'Starsi mieszkańcy są samotni. Chcemy cotygodniowych spotkań sąsiedzkich i regularnego kontaktu z ludźmi.') {
  await route(page, 'search');
  await page.getByLabel('Opisz swoją potrzebę').fill(description);
  await page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' }).click();
  await expect(page.getByText('Tak rozumiemy Twoją potrzebę')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' })).toBeEnabled({ timeout:45000 });
}

test('publiczne wyszukiwanie, pytanie rozstrzygające, źródła i brak dopasowania', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }); await expect(page.locator('main h1')).toContainText('Znajdź rozwiązanie');
  await screenshot(page, '01-home');
  await match(page);
  await expect.poll(() => page.locator('.result-card').count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('heading', { name: 'Wiedza, która pomaga zrozumieć sytuację' })).toBeVisible();
  await screenshot(page, '02-matching');
  await screenshot(page, '02-match-result');
  await page.locator('.question-card').getByRole('button', { name: /^(Nie|Nie mamy tego zasobu)$/ }).click();
  await expect(page.getByRole('button', { name: 'Znajdź pasujące rozwiązania' })).toBeEnabled({ timeout:45000 });
  // The chosen question may concern any of the relevant candidates, not the first card.
  await expect(page.locator('.result-card').filter({ hasText: 'Niespełniony' }).first()).toBeVisible();
  await screenshot(page, '03-barrier');
  await match(page, 'Potrzebujemy algorytmu do przewidywania kursu kryptowalut i zysków inwestycyjnych.');
  await expect(page.getByRole('heading', { name: 'Jeszcze nie mamy potwierdzonego kierunku' })).toBeVisible();
  await screenshot(page, '04-no-match');
  await route(page, 'library'); await page.getByRole('button', { name: 'Mapa wyzwań' }).click();
  await expect(page.getByText('Mapa orientacyjna')).toBeVisible();
  await screenshot(page, '05-library-map');
});

test('prywatna rozmowa dociera do drugiej sesji i szkic przetrwa odświeżenie', async ({ browser }) => {
  const authorContext = await browser.newContext(); const operatorContext = await browser.newContext();
  const author = await authorContext.newPage(), operator = await operatorContext.newPage();
  await login(author, 'institution'); await login(operator, 'admin');
  await route(author, 'messages'); await author.getByRole('button', { name: 'Nowa rozmowa' }).click();
  const title = `Konsultacja testowa ${Date.now()}`;
  await author.getByLabel('Temat rozmowy').fill(title);
  await author.getByLabel('Treść wiadomości').fill('Czy możemy uzgodnić dostępność sali na spotkanie?');
  await author.getByRole('button', { name: 'Wyślij', exact: true }).click();
  await expect(author.locator('.message-list')).toContainText('Czy możemy uzgodnić');
  await route(operator, 'messages'); await operator.locator('.thread-list').getByRole('button', { name: new RegExp(title) }).click();
  await operator.getByLabel('Treść wiadomości').fill('Tak. Proszę zaprosić właściciela zasobu z Karty wdrożenia.');
  await operator.getByRole('button', { name: 'Wyślij', exact: true }).click();
  await expect(author.locator('.message-list')).toContainText('Proszę zaprosić właściciela');
  await screenshot(author, '06-messages');
  await author.reload(); await expect(author.locator('.message-list')).toContainText('Proszę zaprosić właściciela');
  await authorContext.close(); await operatorContext.close();
});

test('fiszka, Canwa i dynamiczny wniosek zachowują numer przyjęcia', async ({ page }) => {
  test.setTimeout(180000);
  await login(page, 'institution'); await route(page, 'idea/new');
  const title = `Spotkania sąsiedzkie E2E ${Date.now()}`;
  await page.getByLabel('Nazwa pomysłu').fill(title);
  await page.getByLabel('Jaki problem rozwiązujesz i na czym polega pomysł?').fill('Seniorzy potrzebują stałych spotkań. Sprawdzimy cotygodniową rozmowę i wspólną kawę.');
  await page.getByLabel('Dla kogo jest ten pomysł?').fill('Seniorzy mieszkający samotnie');
  await page.getByRole('tab', { name: '2. Canwa i mikrotest' }).click();
  await page.getByLabel('Jak to zrobimy?', { exact: true }).fill('Cztery dostępne spotkania po jednej godzinie.');
  await page.getByLabel('Jak poznamy efekt?', { exact: true }).fill('Zbierzemy bariery i ocenę użyteczności po spotkaniu.');
  await checkFormAccessibility(page,'canvas');
  await page.getByRole('button', { name: 'Zapisz szkic', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Zapisano' }).last()).toBeVisible();
  await screenshot(page, '07a-canvas');
  await route(page, 'calls');
  await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Mikroinnowacje blisko ludzi' }) }).getByRole('button', { name: 'Przygotuj wniosek' }).click();
  await page.getByLabel('Przenieś treści z fiszki pomysłu').selectOption({ label: title });
  await page.getByRole('button', { name: 'Utwórz szkic', exact: true }).click();
  await expect(page.getByLabel('Plan testu')).toBeVisible();
  await page.getByLabel('Plan testu').fill('Cztery spotkania w dostępnej sali, rozmowy i ankieta o barierach.');
  await page.getByLabel('Uczestnicy').fill('12');
  await page.getByRole('checkbox', { name: /Potwierdzenie/ }).check();
  await page.getByLabel('Wnioskowany budżet (zł)').fill('1200');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await writeFile('artifacts/accessibility-grant.json', JSON.stringify({ testedAt:new Date().toISOString(), violations:axe.violations },null,2));
  await page.getByRole('button', { name: 'Przejrzyj i złóż' }).click();
  await page.getByRole('button', { name: 'Złóż wniosek w HubMI', exact:true }).click();
  await expect(page.getByRole('heading', { name: 'Wniosek przyjęty w HubMI' })).toBeVisible();
  const receipt = await page.locator('.receipt strong').innerText(); expect(receipt).toMatch(/^HUBMI-/);
  await page.reload({ waitUntil:'domcontentloaded' });
  await expect(page.locator('.receipt')).toContainText(receipt);
  await screenshot(page, '07-grant');
  expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact||''))).toEqual([]);
});

test('cztery role przechodzą Kartę, partnerstwo, test i redakcję doświadczenia', async ({ browser }) => {
  test.setTimeout(300000);
  const contexts = await Promise.all(Array.from({ length:4 },()=>browser.newContext({viewport:{width:1440,height:1000}})));
  const [institution, expert, admin, resident] = await Promise.all(contexts.map(c=>c.newPage()));
  for (const [page, role] of [[institution,'institution'],[expert,'expert'],[admin,'admin'],[resident,'resident']] as const) await login(page,role);
  const suffix = Date.now();
  await route(expert,'partners'); await expert.getByRole('button',{name:'Dodaj ofertę'}).click();
  await expert.getByLabel('Nazwa oferty').fill(`Sala testowa ${suffix}`);
  await expert.getByLabel('Rodzaj zasobu').selectOption('accessibleRoom');
  await expert.getByLabel('Liczba jednostek dostępnych w tym samym czasie').fill('1');
  await expert.getByLabel('Warunki udostępnienia, kompetencje i dostępne terminy').fill('Syntetyczny zasób do testu platformy. Rezerwacja całego planowanego okresu.');
  await expert.getByRole('button',{name:'Opublikuj ofertę'}).click();
  await expect(expert.getByRole('dialog')).not.toBeVisible();
  await match(institution);
  await institution.locator('.result-card').filter({has:institution.getByRole('heading',{name:'Kręgi sąsiedzkie',exact:true})}).getByRole('button',{name:'Przygotuj Kartę wdrożenia'}).click();
  await expect(institution.getByLabel('Nazwa usługi')).toBeVisible();
  const cardHash = institution.url().split('#/')[1];
  await institution.getByLabel('Nazwa usługi').fill(`Karta wspólnego spotkania ${suffix}`);
  await institution.getByLabel('Cel i oczekiwany efekt').fill('Sprawdzić dostępność spotkania i zebrać bariery uczestnictwa.');
  await institution.getByLabel('Działania, odpowiedzialność i terminy').fill('Cztery spotkania, koordynacja CUS, ocena po każdym spotkaniu.');
  await checkFormAccessibility(institution,'card');
  await institution.getByRole('tab',{name:'Warunki i partnerzy'}).click();
  const resourceStates = institution.getByRole('combobox',{name:/Stan zasobu:/});
  await expect(resourceStates).toHaveCount(2);
  for(const select of await resourceStates.all()) await select.selectOption('yes');
  await institution.getByRole('button',{name:'Zapisz wersję Karty'}).click();
  await expect(institution.getByRole('status').filter({hasText:'Zapisano nową wersję'})).toBeVisible();
  const offer = institution.locator('.list-row').filter({has:institution.getByText(`Sala testowa ${suffix}`,{exact:true})});
  await offer.getByRole('button',{name:'Zaproś',exact:true}).click();
  await institution.getByRole('button',{name:'Wyślij zaproszenie',exact:true}).click();
  await expect(institution.getByRole('dialog')).not.toBeVisible();
  await route(expert,'partners');
  const invitation = expert.locator('.panel.list-row').filter({hasText:`Sala testowa ${suffix}`});
  await invitation.getByRole('button',{name:'Potwierdź zakres'}).click();
  await expect(invitation).toContainText('Przyjęto');
  await institution.getByRole('button',{name:'Akceptuję plan jako autor'}).click();
  await route(admin,cardHash); await admin.getByRole('button',{name:'Zatwierdź jako opiekun'}).click();
  await expect(institution.getByRole('button',{name:'Przygotuj pilotaż'})).toBeVisible();
  await screenshot(institution,'08-card');
  await institution.getByRole('button',{name:'Przygotuj pilotaż'}).click();
  await expect(institution.locator('main h1')).toContainText('Pilotaż:');
  const pilotHash = institution.url().split('#/')[1];
  await route(admin,pilotHash); await admin.getByRole('button',{name:'Otwórz zapisy'}).click();
  await route(resident,pilotHash);
  const consent = resident.getByRole('checkbox',{name:/zgod|udział/i});
  if(await consent.count()) await consent.first().check();
  await resident.getByRole('button',{name:'Zgłoś chęć udziału'}).click();
  await admin.getByRole('button',{name:'Przyjmij do testu'}).click();
  await admin.getByRole('button',{name:'Rozpocznij test'}).click();
  await expect(admin.getByRole('button',{name:'Zakończ test i zbierz wnioski'})).toBeVisible();
  await resident.getByLabel('Co utrudniało udział?').fill('Na etapie zaproszenia brakowało informacji o wejściu do sali.');
  await resident.getByLabel('Co warto poprawić?').fill('Dodać czytelną instrukcję dojścia i kontakt do koordynatora.');
  await resident.getByLabel('Wykonałem / wykonałam zadanie testowe').check();
  await checkFormAccessibility(resident,'feedback');
  await resident.getByRole('button',{name:'Przekaż opinię'}).click();
  await expect(admin.locator('.feedback-entry')).toContainText('czytelną instrukcję');
  await screenshot(admin,'09-pilot');
  await screenshot(admin,'09-feedback');
  await admin.getByRole('button',{name:'Zakończ test i zbierz wnioski'}).click();
  await admin.getByLabel('Wniosek kuratora do publicznej wiedzy').fill('Test demonstracyjny wskazał potrzebę jasnej instrukcji dojścia.');
  await admin.getByLabel('Ograniczenia i negatywne wyniki').fill('Jedna syntetyczna opinia. Brak grupy porównawczej i dowodu skuteczności społecznej.');
  await admin.getByRole('button',{name:'Zatwierdź opis doświadczenia'}).click();
  await route(admin,'admin');
  const row = admin.locator('tr').filter({hasText:`Doświadczenie: Pilotaż: Karta wspólnego spotkania ${suffix}`});
  await row.getByRole('button',{name:'Opublikuj',exact:true}).click();
  await expect(row).toContainText('Opublikowano');
  await checkFormAccessibility(admin,'admin');
  await screenshot(admin,'10-admin');
  await writeFile('artifacts/workflow-browser.json',JSON.stringify({testedAt:new Date().toISOString(),cardHash,pilotHash,publication:'passed',roles:4},null,2));
  await Promise.all(contexts.map(context => context.close()));
});

test('accessibility: strony publiczne, klawiatura, formularz i reflow mobilny', async ({ page }) => {
  test.setTimeout(180000);
  const results: any[] = [];
  for (const path of ['home', 'search', 'library', 'calls', 'pilots', 'partners']) {
    await route(page, path);
    if(path === 'library') { await page.getByRole('button',{name:'Mapa wyzwań'}).click(); await expect(page.getByRole('table')).toContainText('Terytorium'); }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    results.push({ path, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) });
  }
  await page.goto('/'); await page.reload(); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  const modalResult = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  results.push({ path: 'login-dialog', violations: modalResult.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) });
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['home', 'search', 'calls', 'library']) {
    await route(page, path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await screenshot(page, `mobile-${path}`);
  }
  await writeFile('artifacts/accessibility.json', JSON.stringify({ testedAt: new Date().toISOString(), results, limitations: 'Automated axe plus keyboard focus and mobile reflow. No NVDA, VoiceOver or five-person usability evaluation.' }, null, 2));
  expect(results.flatMap(r => r.violations).filter(v => ['critical', 'serious'].includes(v.impact))).toEqual([]);
});

test('pracownik pomaga zapisać potrzebę, autor potwierdza, szkic znosi utratę sieci', async ({browser}) => {
  test.setTimeout(180000);
  const staffContext=await browser.newContext(), authorContext=await browser.newContext();
  const staff=await staffContext.newPage(), author=await authorContext.newPage();
  await login(staff,'admin'); await login(author,'resident');
  const description=`Potrzeba wspomagana ${Date.now()}: starsi mieszkańcy szukają spotkań sąsiedzkich.`;
  await match(staff,description);
  await staff.getByRole('checkbox',{name:'Pomagam innej osobie w zgłoszeniu'}).check();
  await staff.getByLabel('E-mail konta autora potrzeby').fill('mieszkaniec@splot.demo');
  await staff.getByRole('button',{name:'Zapisz moją potrzebę'}).click();
  await expect(staff).toHaveURL(/#\/cases$/);
  await expect(staff.getByRole('heading',{name:'Prowadź swoje sprawy do wdrożenia',exact:true})).toBeVisible();
  await route(author,'cases');
  const row=author.locator('article').filter({has:author.getByRole('heading',{name:description.slice(0,90),exact:true})});
  await expect(row).toContainText('Czeka na potwierdzenie autora');
  await row.getByRole('button',{name:'Potwierdzam przeczytaną treść potrzeby'}).click();
  await expect(row).toContainText('Autor potwierdził treść.');
  await screenshot(author,'11-assisted');
  await route(author,'idea/new');
  await author.getByLabel('Nazwa pomysłu').fill('Szkic zachowany podczas braku sieci');
  await authorContext.setOffline(true);
  await expect(author.getByText(/Brak połączenia/)).toBeVisible();
  await expect(author.getByLabel('Nazwa pomysłu')).toHaveValue('Szkic zachowany podczas braku sieci');
  await screenshot(author,'12-offline');
  await authorContext.setOffline(false);
  await author.reload({waitUntil:'domcontentloaded'});
  await expect(author.getByLabel('Nazwa pomysłu')).toHaveValue('Szkic zachowany podczas braku sieci');
  await Promise.all([staffContext.close(),authorContext.close()]);
});
