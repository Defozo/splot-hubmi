# Splot dla HubMI

Splot łączy zgłoszenie lokalnej potrzeby, wybór innowacji, przygotowanie usługi i ocenę pilotażu. Instytucja pracuje z partnerami na wspólnej Karcie wdrożenia, a ROPS prowadzi bibliotekę wiedzy, nabory i obieg spraw.

**Autor:** Michał Kiełtyka, **DEFOZO SOFTWARE HOUSE**.

[Uruchom demo](https://agile-kiwi-698.eu-west-1.convex.site) · [GitHub](https://github.com/Defozo/splot-hubmi) · [HackTribe](https://hackyeah2026.hacktribe.co/splot-dla-hubmi/)

## Co można zrobić

- Opisać potrzebę, porównać rozwiązania i sprawdzić ich źródła oraz warunki zastosowania.
- Rozwinąć pomysł w fiszce i Canwie, a następnie wypełnić formularz wybranego naboru.
- Przygotować Kartę wdrożenia z budżetem, zasobami, partnerami i miernikami.
- Uzgodnić udział partnera, prowadzić rozmowę przy sprawie i otrzymywać powiadomienia.
- Przeprowadzić pilotaż, zebrać opinie i przekazać wyniki kuratorowi wiedzy.
- Zarządzać publikacją materiałów, źródłami, importem, naborami i uprawnieniami.
- Obserwować potrzebę i wracać do niej po istotnej zmianie wiedzy.

Demo wykorzystuje syntetyczne konta, instytucje, innowacje, budżety i wskaźniki. Mapa zawiera trzy fikcyjne wartości. Canwa i nabory mają schematy demonstracyjne, a przekazanie wniosku do zewnętrznego systemu jest symulatorem. Nie jest połączeniem z produkcyjną bazą ani API ROPS.

## Konta demonstracyjne

W oknie logowania wybierz rolę lub użyj poniższych danych. Wspólne, celowo publiczne hasło: `SplotDemo2026!`. Do pracy w dwóch rolach użyj oddzielnych profili przeglądarki.

| Konto | Rola |
| --- | --- |
| mieszkaniec@splot.demo | Potrzeby, pomysły, udział w testach i rozmowy |
| instytucja@splot.demo | Karty wdrożenia, partnerstwa i pilotaże |
| ekspert@splot.demo | Konsultacje, weryfikacja i oferty zasobów |
| rops@splot.demo | Redakcja, nabory i administracja demo |

Biblioteka, wyszukiwanie, nabory i publiczne opisy testów są dostępne bez konta. Samodzielna rejestracja nadaje rolę mieszkańca.

## Uruchomienie lokalne

Wymagane: Node.js 22.12 lub nowszy, npm i backend Convex. Projekt sprawdzono z Node.js 24.13.0; wersję wskazują `.node-version` i `.nvmrc`.

```powershell
npm ci
Copy-Item .env.example .env.local
# W .env.local ustaw publiczny adres swojego backendu:
# VITE_CONVEX_URL=https://your-demo.convex.cloud
npm run dev
```

Interfejs działa pod `http://localhost:5186`. `.env.local` zawiera wyłącznie publiczny adres Convex. Klucze dostawców przechowuj w psst i konfiguracji serwera, bez prefiksu `VITE_`.

## Własne środowisko demonstracyjne

Skrypt inicjalizacyjny wymaga psst na Windows oraz wpisów `CONVEX_ACCESS_TOKEN`, `GROQ_API_KEY` i `OPENAI_API_KEY`. Token Convex musi mieć dostęp do zespołu. Skrypt tworzy lub wybiera dedykowany projekt, zapisuje `SPLOT_CONVEX_DEPLOY_KEY` w psst oraz ustawia backend i publiczny adres frontendu.

```powershell
psst CONVEX_ACCESS_TOKEN GROQ_API_KEY OPENAI_API_KEY -- node scripts/provision.mjs
psst SPLOT_CONVEX_DEPLOY_KEY -- npm run backend:deploy
psst SPLOT_CONVEX_DEPLOY_KEY -- npm run backend:seed
npm run build
psst SPLOT_CONVEX_DEPLOY_KEY -- node scripts/publish-demo.mjs
```

Ponowne uruchomienie `provision.mjs` rotuje klucz sesji. Do kolejnych wydań korzystaj z poleceń wdrożenia i publikacji. Seed działa wyłącznie przy `APP_ENV=demo` i `APP_PROJECT=splot-hubmi`. Dodaje konta, korpus, mapę, kurs, film z napisami i przykładowy obieg spraw. Indeksowanie kończy się przed publikacją wiedzy.

Konfiguracja, aktualizacje, kopie i zasady pracy na realnych danych: [utrzymanie](docs/OPERATIONS.md). Model kosztów i odpowiedzialności: [COSTS.md](docs/COSTS.md).

## Testy

```powershell
npm run check
npm run test:domain
npm run build
npx playwright install chromium
npm run dev
# W drugim terminalu, z tym samym backendem testowym:
npm run test:e2e
npm run test:a11y
```

Zewnętrzny adres do testów ustawia `E2E_URL`. Testy przeglądarkowe i integracyjne zapisują dane demonstracyjne, a testy AI mogą zużywać płatne limity dostawców. Uruchamiaj je na przeznaczonym do tego środowisku. Skrypty `.ts` można wywoływać przez `node --import tsx`.

Wydanie `072826ccc85afd79` przeszło 115 testów domenowych i 22 scenariusze przeglądarkowe. Przy publikacji kodu 4 października ponownie sprawdzono instalację, TypeScript, 115 testów domenowych i build. Daty, zakres i interpretacja wyników: [walidacja](docs/VALIDATION.md).

## Dokumentacja i materiały

- [Scenariusz demonstracji](docs/DELIVERY.md) i [ekrany](docs/UX.md).
- [Architektura i uprawnienia](docs/ARCHITECTURE.md), [schemat bazy](convex/schema.ts), [dopasowanie i AI](docs/MATCHING.md).
- [Źródła i pochodzenie danych](docs/SOURCES.md), [biblioteki i licencje](docs/THIRD_PARTY_NOTICES.md).
- [Prezentacja PDF](https://agile-kiwi-698.eu-west-1.convex.site/materialy/splot-hubmi.pdf), [PPTX](https://agile-kiwi-698.eu-west-1.convex.site/materialy/splot-hubmi.pptx), [film](https://agile-kiwi-698.eu-west-1.convex.site/materialy/splot-demo.mp4), [ZIP ze źródłami](https://agile-kiwi-698.eu-west-1.convex.site/materialy/splot-hubmi-source.zip).

Kod interfejsu jest w `src/`, serwera w `convex/`, a reguł i testów w `domain/` oraz `tests/`. ZIP zawiera źródła, testy, konfigurację przykładową i dokumentację. Film oraz prezentacje są dostępne osobno pod powyższymi adresami.
