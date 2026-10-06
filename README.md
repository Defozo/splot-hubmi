# Splot dla HubMI

Splot prowadzi lokalny pomysł od opisanej potrzeby do wspólnie przygotowanego i ocenionego pilotażu usługi. Mieszkaniec zgłasza problem, instytucja wybiera rozwiązanie i partnerów, a zespół ROPS koordynuje sprawy, nabory i bibliotekę wiedzy. Wspólna Karta wdrożenia łączy cel, warunki, zasoby, budżet i mierniki.

**Autor:** Michał Kiełtyka, **DEFOZO SOFTWARE HOUSE**.

[Uruchom demo](https://agile-kiwi-698.eu-west-1.convex.site) · [Przejdź przez przykładową sprawę](docs/DELIVERY.md) · [HackTribe](https://hackyeah2026.hacktribe.co/splot-dla-hubmi/)

## Znajdź rozwiązanie i sprawdź warunki zastosowania

Opisz potrzebę własnymi słowami. Splot łączy wyszukiwanie tekstowe i semantyczne, pokazując propozycje wraz ze źródłami i fragmentami uzasadniającymi wybór. Osobno ocenia dopasowanie problemu i warunki lokalne: dostępnych ludzi, miejsce, zasoby czy wymagane partnerstwo. Celne pytanie pomaga uzupełnić informację, która może zmienić następny krok.

Autor widzi, które warunki są spełnione, niespełnione lub wymagają potwierdzenia. Może porównać propozycje, zapisać potrzebę, poprosić o konsultację albo rozwinąć nowy pomysł. Asystent proponuje edytowalną treść; autor wybiera, co wstawić do dokumentu.

## Przejdź od pomysłu do pilotażu

1. **Przygotuj pomysł.** Rozwiń fiszkę i Canwę, a następnie przenieś treść do formularza wybranego naboru.
2. **Ułóż Kartę wdrożenia.** Zapisz cel usługi, zasoby, budżet, warunki lokalne i sposób oceny.
3. **Uzgodnij współpracę.** Zaproś partnera i uzyskaj potwierdzenie zasobu na określony czas. Rozmowa, wersje dokumentów i decyzje pozostają przy sprawie.
4. **Zatwierdź plan.** Autor i opiekun akceptują wersję Karty. System sprawdza wymagane potwierdzenia i dostępność zasobów przed uruchomieniem pilotażu.
5. **Zbierz doświadczenia.** Przyjmij uczestników, zapisz ich opinie i bariery, podsumuj test oraz przekaż wnioski kuratorowi do publikacji.

## Wiedza wraca do zgłoszonych potrzeb

Obserwowana potrzeba może otrzymać powiadomienie, gdy pojawi się odpowiednia propozycja, zmieni się istotny warunek albo zostanie wycofane źródło. Komunikat wskazuje konkretną zmianę. Zaakceptowana Karta zachowuje swoje wersje, aby zespół mógł świadomie ocenić wpływ nowej wiedzy na plan.

ROPS ma wspólny obieg spraw, opiekunów, publikacji, importów, naborów i uprawnień. Biblioteka obejmuje także materiały, kurs i mapę z tabelą wskaźników. Katalog, formularze i tekstowy tor dopasowania pozostają dostępne przy awarii dostawcy AI.

## Zakres demonstracji

Demo pozwala przejść cały obieg na syntetycznych kontach, instytucjach, innowacjach, budżetach i wskaźnikach. Mapa pokazuje trzy fikcyjne wartości, Canwa i nabory korzystają ze schematów demonstracyjnych, a przekazanie wniosku do zewnętrznego systemu jest symulowane. To projekt dla HubMI, bez połączenia z produkcyjną bazą lub API ROPS. Wyniki testu użytkowników opisują ocenę pilotażu, nie dowód skuteczności społecznej.

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
