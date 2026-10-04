import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const runtime = process.env.ARTIFACT_RUNTIME_ROOT || 'C:/Users/defoz/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES ||= `${runtime}/node/node_modules`;
const skill = process.env.PRESENTATIONS_SKILL || 'C:/Users/defoz/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const { Presentation, PresentationFile } = await import(pathToFileURL(`${runtime}/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs`).href);
const { finalizePresentation } = await import(pathToFileURL(`${skill}/container_tools/artifact_tool_utils.mjs`).href);
const team = JSON.parse(await fs.readFile('TEAM.json', 'utf8'));
const unit = JSON.parse(await fs.readFile('artifacts/domain-tests.json', 'utf8'));
const demo = 'https://agile-kiwi-698.eu-west-1.convex.site';
const c = { background:'#F6F4EE', ink:'#183C33', green:'#184E40', muted:'#486057' };
const t = (value,x,y,w,h,size=28,bold=false,color=c.ink) => ({value,x,y,w,h,size,bold,color});
const screen = (name,x=490,y=172,w=728,h=442) => ({name,x,y,w,h});
const slides = [
  {
    title:'Splot dla HubMI',
    texts:[
      t('Splot',62,60,660,110,82,true,c.green),
      t('dla HubMI',66,167,470,60,38,false,c.green),
      t('Innowacje społeczne\nw lokalnym działaniu',66,294,490,114,36,true),
      t(`${team.team_name}\n${team.members.join(', ')}`,66,512,490,86,25),
    ],
    images:[screen('01-home',575,160,643,424)],
    note:'Jestem Michał Kiełtyka z DEFOZO SOFTWARE HOUSE. Splot pomaga mieszkańcom i instytucjom wykorzystać innowacje społeczne w swojej okolicy. Pokażę to na jednym przykładzie: samotności starszych mieszkańców. Instytucja znajduje rozwiązanie, uzgadnia lokalny plan i partnerów, a następnie zbiera opinie z pilotażu. Wszystkie osoby i działania w tym scenariuszu są demonstracyjne.',
    sources:'Oficjalny opis zadania HubMI, części 1-3. TEAM.json. Zrzut działającej aplikacji.',
  },
  {
    title:'Samotność w gminie',
    texts:[
      t('Samotność w gminie',62,46,1156,80,46,true,c.green),
      t('„Starsi mieszkańcy rzadko wychodzą z domu.\nChcemy organizować regularne spotkania.”',66,180,1100,180,45,true),
      t('Koordynatorka szuka rozwiązania, które da się uruchomić\nw jej gminie. Potrzebuje też miejsca i osób do współpracy.',66,388,1110,114,31),
      t('Splot prowadzi tę samą sprawę aż do opinii uczestników.',66,548,1110,62,30,true,c.green),
    ], images:[],
    note:'Samotność to jedno z wyzwań wskazanych przez ROPS. W naszym scenariuszu koordynatorka chce zorganizować regularne spotkania dla starszych mieszkańców. Sam opis inicjatywy jeszcze nie odpowiada na pytanie, jak zacząć. Trzeba sprawdzić warunki, uzgodnić salę i zaplanować udział mieszkańców. W Splocie kolejne osoby pracują na tej samej sprawie. Koordynatorka nie musi opowiadać całej historii od początku przy każdym kontakcie.',
    sources:'Oficjalny opis zadania HubMI, części 1 i 3. Cytat opisuje scenariusz demonstracyjny, nie wypowiedź uczestnika badania.',
  },
  {
    title:'Dobór rozwiązania z uzasadnieniem',
    texts:[
      t('Dobór rozwiązania z uzasadnieniem',62,46,1156,80,44,true,c.green),
      t('Opis własnymi słowami',66,188,390,88,30,true),
      t('Propozycja pokazuje źródło i warunki zastosowania.',66,290,390,118,29),
      t('Odpowiedź na ważne pytanie zmienia ocenę.',66,452,390,114,29),
    ],images:[screen('02-match-result')],
    note:'Mieszkaniec może zacząć bez konta. Opisuje sytuację własnymi słowami, a Splot wyszukuje odpowiednie innowacje i materiały. Każda propozycja pokazuje źródło oraz warunki zastosowania. W naszym scenariuszu aplikacja dopytuje o osoby, które pomogą prowadzić spotkania. Odpowiedź zmienia ocenę warunków. Gdy biblioteka nie zawiera odpowiedniego rozwiązania, użytkownik może zapisać potrzebę lub rozpocząć rozmowę z opiekunem.',
    sources:'Działający moduł dopasowania. Testy scenariusza pozytywnego, pytania i braku dopasowania: artifacts/playwright-results.json. Reguły i ewaluacja: docs/VALIDATION.md.',
  },
  {
    title:'Wspólny plan i potwierdzony partner',
    texts:[
      t('Wspólny plan i potwierdzony partner',62,46,1156,80,44,true,c.green),
      t('Karta wdrożenia',66,188,390,72,32,true),
      t('Instytucja dopasowuje usługę do odbiorców i ustala budżet.',66,288,390,140,29),
      t('Partner potwierdza zasób. Opiekun uzgadnia gotowość do testu.',66,465,390,140,29),
    ],images:[screen('08-card',490,153,728,484)],
    note:'Z wybranego rozwiązania powstaje Karta wdrożenia. Instytucja dopasowuje cel i sposób działania do swojej miejscowości, a asystent pomaga rozwinąć plan. Karta zawiera budżet i warunki potrzebne do startu. Jeśli potrzebujemy sali, zapraszamy partnera i czekamy na jego potwierdzenie. Rozmowa pozostaje przy sprawie. Opiekun i autor zatwierdzają wersję, na której opiera się późniejszy pilotaż.',
    sources:'Działające moduły Karty wdrożenia, partnerstw i rozmów. Potwierdzenie zasobów i wspólny przepływ kilku ról: artifacts/playwright-results.json. Wersjonowanie i reguły zasobów: docs/VALIDATION.md.',
  },
  {
    title:'Pomysł gotowy do przedstawienia',
    texts:[
      t('Pomysł gotowy do przedstawienia',62,46,1156,80,44,true,c.green),
      t('Fiszka i Canwa',66,188,390,76,32,true),
      t('Autor rozwija pomysł i określa pierwszy test.',66,293,390,116,29),
      t('Aktywny nabór otwiera właściwy formularz i zapisuje potwierdzenie złożenia.',66,459,390,155,29),
    ],images:[screen('07-grant')],
    note:'Splot wspiera także nowe pomysły. Autor zaczyna od krótkiej fiszki, a w Canwie porządkuje odbiorców i plan pierwszego testu. Asystent proponuje rozwinięcia, które autor sam przyjmuje lub zmienia. Kiedy trwa nabór, aplikacja otwiera formularz właściwy dla tego konkursu. Po złożeniu zachowuje wersję wniosku i numer potwierdzenia. W demo pokazujemy dwa różne nabory i ich formularze.',
    sources:'Działające moduły pomysłów, Canwy i naborów. Dwa schematy naborów, niezmienna wersja i pojedyncze potwierdzenie: artifacts/domain-tests.json i artifacts/playwright-results.json. Potwierdzenie w demo dotyczy platformy, nie przyznania finansowania.',
  },
  {
    title:'Opinie mieszkańców zmieniają usługę',
    texts:[
      t('Opinie mieszkańców zmieniają usługę',62,46,1156,80,44,true,c.green),
      t('Pilotaż spotkań',66,188,390,76,32,true),
      t('Mieszkaniec zgłasza udział i przekazuje opinię o konkretnym teście.',66,293,390,145,29),
      t('Koordynatorka zbiera bariery uczestnictwa i propozycje zmian.',66,473,390,132,29),
    ],images:[screen('09-feedback',490,153,728,484)],
    note:'Zatwierdzona Karta prowadzi do pilotażu. Mieszkaniec widzi, na czym polega udział, i zgłasza chęć dołączenia. Koordynatorka potwierdza przyjęcie. Po spotkaniu uczestnik ocenia użyteczność i opisuje bariery, na przykład godzinę spotkania lub dojazd. Opinia dotyczy konkretnej wersji usługi. Dzięki temu zespół wie, co zmienić przed kolejnym testem, a ROPS otrzymuje uporządkowane wnioski.',
    sources:'Działający moduł testera. Scenariusz zapisu, przyjęcia, opinii i przeglądu doświadczenia: artifacts/playwright-results.json. Prezentowane osoby i wyniki są demonstracyjne.',
  },
  {
    title:'Wiedza wraca do kolejnych spraw',
    texts:[
      t('Wiedza wraca do kolejnych spraw',62,46,1156,80,44,true,c.green),
      t('ROPS prowadzi obieg wiedzy',66,185,390,110,30,true),
      t('Redaktor publikuje sprawdzone materiały i wnioski z testów.',66,323,390,124,29),
      t('Nowa wiedza uruchamia ponowną ocenę obserwowanych potrzeb.',66,485,390,124,29),
    ],images:[screen('10-admin')],
    note:'ROPS ma panel do obsługi spraw i naborów oraz redakcji biblioteki. Materiały informacyjne, innowacje, filmy i kursy pomagają użytkownikom zrozumieć temat. Wnioski z pilotażu trafiają do przeglądu przed publikacją. Nowy materiał może pomóc osobie, która wcześniej nie znalazła rozwiązania. Jeśli wyraziła zgodę na obserwowanie potrzeby, Splot sprawdza ją ponownie i powiadamia o istotnej zmianie.',
    sources:'Działające moduły wiedzy i administratora. Publikacja, wycofanie oraz obserwowanie potrzeby: artifacts/playwright-results.json i docs/VALIDATION.md. Dostęp do trendów ma administrator.',
  },
  {
    title:'Wygodny dostęp do pomocy',
    texts:[
      t('Wygodny dostęp do pomocy',62,46,1156,80,46,true,c.green),
      t('Bez konta na początek',66,208,640,68,34,true),
      t('Wyszukiwanie działa także na telefonie.\nKlawiatura pozwala przejść przez formularze.',66,319,620,139,31),
      t('Pracownik może pomóc w zgłoszeniu,\na prywatna sprawa pozostaje dostępna\ndla uprawnionych osób.',66,500,630,145,29),
    ],images:[screen('mobile-search',816,135,345,510)],
    note:'Pierwsze wyszukiwanie nie wymaga zakładania konta. Interfejs działa na telefonie i pozwala przechodzić przez formularze klawiaturą. Mieszkaniec może także skorzystać z pomocy pracownika przy zgłoszeniu. Proste komunikaty wskazują, jakie działanie wykonać dalej. Prywatne sprawy i pliki są dostępne dla uprawnionych osób, a reguły dostępu obowiązują również po stronie serwera.',
    sources:'Działające tryby mobilny i zgłoszenia wspomaganego. Regresje klawiatury i uprawnień: artifacts/playwright-results.json, artifacts/accessibility.json. Zakres technicznej weryfikacji: docs/UX.md i docs/VALIDATION.md.',
  },
  {
    title:'Architektura Splotu',
    texts:[
      t('Architektura Splotu',62,46,1156,80,46,true,c.green),
      t('Aplikacja i wspólne dane',66,196,550,70,33,true),
      t('React i TypeScript\nConvex: baza, sesje i pliki\nAktualizacje w czasie rzeczywistym',66,295,548,184,29),
      t('Wyszukiwanie i asystenci',698,196,530,70,33,true),
      t('Indeksy tekstowe i wektorowe\nGroq GPT-OSS 120B\nOpenAI text-embedding-3-small',698,295,500,184,27),
      t('Wersje dokumentów, role i limity kosztów wspierają codzienną pracę Hubu.',66,561,1110,86,29,true,c.green),
    ],images:[],
    note:'Aplikacja korzysta z Reacta i TypeScriptu. Convex przechowuje wspólne dane, obsługuje sesje i aktualizacje w czasie rzeczywistym. Wyszukiwanie łączy indeks tekstowy i wektorowy z jawnymi warunkami. Groq GPT-OSS 120B pomaga interpretować potrzebę i rozwijać pomysł, a embeddingi OpenAI wspierają dobór materiałów. Zgody, terminy i uprawnienia egzekwuje aplikacja. Wersje dokumentów pozwalają ustalić, czego dotyczyły uzgodnienia i opinie.',
    sources:`Implementacja i konfiguracja dostawców: README.md oraz docs/VALIDATION.md. Wynik testów domenowych w chwili renderu: ${unit.numPassedTests}/${unit.numTotalTests}. Pełne wyniki ewaluacji, obciążenia i odtworzenia kopii są w dokumentacji technicznej.`,
  },
  {
    title:'Koszt utrzymania i działające demo',
    texts:[
      t('Koszt utrzymania i działające demo',62,46,1156,80,44,true,c.green),
      t('220-330 USD',66,185,670,103,68,true,c.green),
      t('miesięcznie na usługi techniczne',66,303,690,54,32),
      t('Budżet planistyczny dla 12 tys. analiz\ni ponownych dopasowań miesięcznie.',66,394,650,107,29),
      t('Obsługa Hubu',842,197,366,66,32,true),
      t('Redakcja i koordynacja spraw\nKonsultacje ekspertów\nUtrzymanie techniczne',842,293,355,182,27),
      t('Koszt pracy rozliczany osobno.',842,505,358,81,24),
      t(`${team.team_name}\n${team.members.join(', ')}`,66,548,690,83,25,true),
    ],images:[],
    note:'Dla przyjętego wolumenu planujemy 220 do 330 dolarów miesięcznie na usługi techniczne. Budżet obejmuje modele, backend i rezerwy eksploatacyjne. Praca redakcyjna, koordynacja i eksperci są osobną pozycją. Działające demo pozwala przejść pełną sprawę, od opisu potrzeby do opinii z pilotażu. Splot daje Hubowi wspólną przestrzeń pracy, a lokalnej instytucji konkretny sposób wykorzystania innowacji. Projekt przygotowałem jako DEFOZO SOFTWARE HOUSE, Michał Kiełtyka.',
    sources:'Kosztorys z official-2026-10-03/PLAN.md, sekcja 11. Założenia miesięczne: 12 tys. analiz i ponownych dopasowań, 2 tys. operacji kreatora i 5 mln tokenów embeddingów. Suma jest planistyczna, obejmuje rezerwy i nie zawiera podatków ani wynagrodzeń. Źródła stawek z kosztorysu: https://console.groq.com/docs/model/openai/gpt-oss-120b, https://developers.openai.com/api/docs/models/text-embedding-3-small, https://www.convex.dev/pricing.',
  },
];

await fs.mkdir('.local/presentation', {recursive:true});
await fs.mkdir('output', {recursive:true});
const resultData = {team,demo,slideSize:{width:1280,height:720},colors:c,slides};
await fs.writeFile('.local/presentation/slides.json', JSON.stringify(resultData,null,2));
await fs.writeFile('docs/SPEAKER_NOTES.md', `# Scenariusz prezentacji\n\n${team.team_name}. ${team.members.join(', ')}.\n\n` + slides.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.note}\n\nŹródła i podstawa faktów: ${s.sources}\n`).join('\n'));
if (process.argv.includes('--content-only')) {
  console.log(JSON.stringify({slides:slides.length,content:'.local/presentation/slides.json'}));
  process.exit(0);
}

const deck = Presentation.create({slideSize:resultData.slideSize});
function addText(slide,def) {
  const {value,x,y,w,h,size,bold,color}=def;
  const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  shape.text=value;
  shape.text.style={typeface:'Arial',fontSize:size,color,bold,autoFit:'none'};
}
for (const [i,data] of slides.entries()) {
  const slide=deck.slides.add(); slide.background.fill=c.background;
  for(const def of data.texts) addText(slide,def);
  for(const img of data.images) {
    const bytes=await fs.readFile(`artifacts/screenshots/${img.name}.png`);
    slide.images.add({blob:new Uint8Array(bytes),contentType:'image/png',alt:`Działający Splot: ${data.title}`,fit:'contain',position:{left:img.x,top:img.y,width:img.w,height:img.h}});
  }
  const footer = i===0 || i===9 ? 'Demo: agile-kiwi-698.eu-west-1.convex.site' : 'Splot dla HubMI. Scenariusz demonstracyjny.';
  addText(slide,t(footer,66,668,1090,28,16,false,c.muted));
  addText(slide,t(`${i+1}/10`,1170,668,64,28,16,false,c.muted));
  slide.speakerNotes.textFrame.setText(`${data.note}\n\nŹródła i podstawa faktów: ${data.sources}`);
  const png=await deck.export({slide,format:'png',scale:1.5});
  await fs.writeFile(`.local/presentation/slide-${i+1}.png`,new Uint8Array(await png.arrayBuffer()));
  const layout=await slide.export({format:'layout'});
  await fs.writeFile(`.local/presentation/slide-${i+1}.layout.json`,await layout.text());
}
const candidate=path.join(root,'.local/presentation/candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidate);
if(process.argv.includes('--draft-only')) {console.log(JSON.stringify({slides:10,output:candidate,draft:true}));process.exit(0);}
const finalPath=path.join(root,'output/splot-hubmi.pptx');
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath,pythonExecutable:`${runtime}/python/python.exe`,integrityValidatorPath:`${skill}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${skill}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],explicitTotalSlideCount:10,requiredNativeTableOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(root,'artifacts/presentation-verification.json')});
console.log(JSON.stringify({slides:10,output:finalPath}));
