import { readFile, writeFile, mkdir } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const project = JSON.parse(await readFile('package.json', 'utf8'));
const rows = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path) continue;
  let meta = {}; try { meta = JSON.parse(await readFile(`${path}/package.json`, 'utf8')); } catch {}
  const name = meta.name || path.split('node_modules/').at(-1);
  rows.push({ name, version: entry.version, license: meta.license || entry.license || 'SEE LICENSE FILE', direct: !!(project.dependencies[name] || project.devDependencies[name]), development: !!entry.dev, repository: typeof meta.repository === 'string' ? meta.repository : meta.repository?.url || meta.homepage || '', packagePath: path });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
await mkdir('docs', { recursive: true });
await writeFile('docs/DEPENDENCIES.json', JSON.stringify({ generatedAt: new Date().toISOString(), lockfileVersion: lock.lockfileVersion, packages: rows }, null, 2));
const direct = rows.filter(r => r.direct);
await writeFile('docs/THIRD_PARTY_NOTICES.md', `# Biblioteki i narzędzia\n\nProjekt: Splot dla HubMI. Zespół: DEFOZO SOFTWARE HOUSE. Autor: Michał Kiełtyka.\n\nRejestr odczytano z package-lock.json i metadanych zainstalowanych pakietów. Dokładne pliki LICENSE pozostają w dystrybucjach bibliotek. Pełna lista zależności przechodnich: [DEPENDENCIES.json](DEPENDENCIES.json).\n\n| Pakiet bezpośredni | Wersja | Licencja | Zakres |\n| --- | --- | --- | --- |\n${direct.map(r => `| ${r.name} | ${r.version} | ${typeof r.license === 'string' ? r.license : JSON.stringify(r.license)} | ${r.development ? 'narzędzie developerskie' : 'aplikacja'} |`).join('\n')}\n\n## Pozostałe narzędzia i usługi\n\n- Node.js, npm, TypeScript, Vite, Vitest, Playwright, axe-core: uruchomienie i weryfikacja. Wersje określa lockfile.\n- Convex i Convex Auth: backend, sesje, pliki, indeksy i serwowanie skompilowanej aplikacji. Usługa zewnętrzna, kod integracji jest w projekcie.\n- Groq GPT-OSS 120B: interpretacja i propozycje tekstowe. OpenAI text-embedding-3-small: embeddingi. Dane i modele dostawców nie są częścią przekazywanego kodu.\n- Codex: narzędzie wspomagające opracowanie kodu, dokumentacji i testów. Użycie narzędzia nie zmienia listy członków zespołu.\n- DM Sans i Manrope: fonty SIL Open Font License 1.1, dostarczane lokalnie w public/fonts wraz z tekstami licencji.\n- OpenAI GPT-6 Luna: opcjonalny OCR PDF po zgodzie, osobno raportowane zużycie.\n- FFmpeg: montaż rzeczywistego nagrania przeglądarki. ReportLab i Poppler: przygotowanie i kontrola PDF. Artifact Tool: edytowalna prezentacja.\n- psst: wstrzykiwanie sekretów w procesy. Żaden klucz dostawcy nie wchodzi do paczki.\n\nKod własny, korpus demonstracyjny i dokumentacja są rozdzielone od zależności i materiałów organizatora. Rejestr nie zastępuje analizy i podpisania wymaganych oświadczeń o prawach przez autora.\n`);
console.log(JSON.stringify({ packages: rows.length, direct: direct.length, unresolvedLicenses: rows.filter(r => r.license === 'SEE LICENSE FILE').length }));
