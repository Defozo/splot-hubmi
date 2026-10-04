# Dopasowanie, AI i obserwowane potrzeby

Właściciel demonstracji: **DEFOZO SOFTWARE HOUSE, Michał Kiełtyka**. Dokument opisuje wykonany kod i pomiary z 3 października 2026. Korpus demonstracyjny jest autorski i syntetyczny. Nie jest biblioteką zatwierdzonych innowacji ROPS ani dowodem skuteczności społecznej.

## Przepływ

1. `matching.preview` jest zapytaniem Convex. Zwraca pierwsze wyniki słownikowe, źródła i warunki bez wywołania modelu i bez kosztu generacji. Pobranie tekstów fragmentów odbywa się dopiero w pełnym dopasowaniu, aby pierwszy podgląd miał mniejszy koszt odczytu i rozmiar odpowiedzi.
2. `matching.match` jest akcją. Równolegle uruchamia interpretację Groq w JSON Schema i embedding OpenAI. Potem odpytuje dwa zakresy indeksu fragmentów Convex: opublikowane innowacje oraz opublikowane informacje. Wynik dokumentu jest maksymalnym podobieństwem jego pobranych fragmentów.
3. Tor tekstowy używa polskich pojęć i ich odmian. Gdy rozpoznano problem, wyszukuje jego kanoniczne tagi. Dla nierozpoznanego problemu sprawdza do dziesięciu tokenów. Każdy tor pobiera do 20 kandydatów danego rodzaju. Ranking hybrydowy stosuje Reciprocal Rank Fusion, `k=60`.
4. Kod oddziela zgodność problemu od warunków wdrożenia. Samo słowo „seniorzy” nie wystarcza do polecenia rozwiązania innego problemu. Podobieństwo wektorowe jest wskaźnikiem wyszukiwania, nie procentem powodzenia.
5. Groq uzasadnia trzy pierwsze propozycje wyłącznie z przekazanych opisów i fragmentów. Serwer odrzuca nieistniejące ID, inne wersje, obce identyfikatory źródeł i zmyślone identyfikatory fragmentów. Uzasadnienie wskazuje `citedFragmentIds`, a widok udostępnia ich stronę lub sekcję oraz tekst. Adresy odnośników pochodzą z rejestru źródeł.
6. Po generacji serwer ponownie sprawdza publikację, wersję oraz dostępność źródeł. Usuwa wycofanych kandydatów i ponownie wybiera pytanie. Brak odpowiedniej innowacji prowadzi do jawnej odmowy rekomendacji, zapisu potrzeby, konsultacji lub kreatora.

`domain/matching.ts` zawiera reguły niezależne od dostawców. `convex/search.ts` odpowiada za indeksy, sprawdzanie źródeł, limit kosztów, cache i zapis wykonania. `convex/ai.ts` obsługuje dostawców. `convex/matching.ts` składa wynik oraz obsługuje obserwowanie.

`domain/chunks.ts` dzieli tekst na fragmenty do 1600 znaków z nakładaniem 120 znaków. Zachowuje oznaczenia stron PDF i OCR; tekst bez stron otrzymuje sekcje. Limit 100 fragmentów odrzuca zbyt duży materiał bez obcięcia końca. Każdy `knowledgeChunks` ma własne ID, wersję dokumentu, lokalizator, źródła i model embeddingu. Przy aktualizacji wektor jest ponownie używany tylko przy zgodnych hashu, pełnym tekście i modelu. Zmiana jednej strony nie wymaga przeliczania pozostałych.

Polecenie publikacji ustawia prywatny stan `indexing`. Dopiero atomowy `commitPublication` sprawdza liczbę i kolejność wszystkich oczekiwanych fragmentów, kompletny wymiar wektorów, wersję dokumentu i aktualność źródeł, po czym publikuje nową wersję i wycofuje poprzednią. Błąd dostawcy lub limit budżetu pozostawia poprzednią publikację i zadanie do ponowienia. Panel pokazuje stan i błąd zadania. Migracja istniejącego korpusu używa `search.reindex`, z paginacją po osiem dokumentów i embeddingami partiami po 16 fragmentów.

## Warunki i pytanie

Warunek ma identyfikator, pole zasobu, kategorię, operator, wymaganą wartość, jednostkę, obowiązkowość, dopuszczenie partnera, źródło i wersję, zatwierdzenie, osobę odpowiedzialną oraz termin przeglądu.

Ocena zwraca `met`, `unmet` albo `unknown`, z opisem podstawy. Niewiadoma cena nie staje się zerem. Przeterminowane wymaganie, wygasłe potwierdzenie i niepotwierdzony partner pozostają niewiadomą. Publiczny klient nie może przypisać sobie potwierdzenia eksperta ani zgody partnera; jego dane są deklaracją instytucji. Partnerstwa i weryfikacja Karty mają odrębne operacje serwerowe.

Wybór pytania symuluje dopuszczalne odpowiedzi na kopiach zasobów. Preferuje zmianę obowiązkowego warunku i następnego kroku. Jeśli odpowiedzi nie zmieniają klasyfikacji, pytanie jest pomijane. Dostępne są „nie wiem” oraz pominięcie. Hipotetyczne odpowiedzi nie są zapisywane do profilu.

## Obserwowanie i spójność

Zapis lub włączenie obserwowania ustala pierwszy wynik bez powiadomienia udającego nową wiedzę. Publikacja, zmiana warunków i wycofanie tworzą nową wersję korpusu. Worker wybiera sprawy po problemie i zależnościach; codzienny przegląd obejmuje również pozostałe obserwowane potrzeby.

Przed zatwierdzeniem worker sprawdza jednocześnie:

- wersję potrzeby,
- aktualne `matchRevision` i `targetCorpusVersion`,
- zgodę na obserwowanie,
- aktualną wersję korpusu,
- publikację kandydatów i źródeł.

Wynik oraz outbox powstają w jednej transakcji. Klucz `needId:needVersion:corpusVersion:changeType` usuwa duplikaty. Dostarczenie powiadomienia ponownie kontroluje zgodę, ciszę i rewizję. Starszy worker nie może nadpisać nowszego wyniku. Zaakceptowana Karta pozostaje przypięta do swoich wersji, a nowa wiedza oznacza konieczność przeglądu.

Powiadomienie wymienia konkretny tytuł oraz zmianę: nową propozycję, usuniętą rekomendację, warunek wraz z poprzednim i obecnym stanem, poziom dowodów albo wersję źródła. `lastMatchChange` zapisuje także odnośniki z rejestru źródeł. Widok sprawy pokazuje te szczegóły, a nie samo ogólne wezwanie do sprawdzenia zmian.

## Dostawcy, prywatność i koszty

Domyślna konfiguracja używa Groq `openai/gpt-oss-120b` oraz OpenAI `text-embedding-3-small`, 1536 wymiarów. Zmiana wymiaru wymaga przebudowy indeksu. Wymagane sekrety to `GROQ_API_KEY` i `OPENAI_API_KEY`, wstrzyknięte do backendu z psst. Klucze nie trafiają do frontendu.

Kontakty, identyfikatory i typowe dane adresowe są usuwane przed wysłaniem tekstu. Filtr regułowy nie gwarantuje rozpoznania wszystkich możliwych danych osobowych, dlatego demonstracja korzysta wyłącznie z treści syntetycznych. Model nie posiada narzędzi publikacji, nadawania ról, wysyłania wiadomości ani przyznawania finansowania.

Każdy MatchRun zapisuje wersje potrzeby, korpusu, źródeł, reguł, promptu i modeli, kandydatów, czas oraz szacowany koszt. Cache uwzględnia publiczny zakres dostępu i wszystkie dane wejściowe. Wygasa po minucie. Paginowane sprzątanie usuwa wygasły cache, anonimowe niepowiązane wykonania po 24 godzinach i zalogowane niepowiązane wykonania po 30 dniach. Potwierdzone wyniki przypięte do spraw podlegają retencji i usunięciu sprawy.

Rezerwacja kosztu jest transakcyjna: limity dzienne i miesięczne działają globalnie, a limit zalogowanej osoby wynika z jej tożsamości, nie z podanego przez klienta identyfikatora sesji. Anonimowy limit godzinowy dotyczy identyfikatora sesji przeglądarki; Convex action nie udostępnia tu adresu klienta do limitu IP. Globalny limit kosztu obowiązuje również przy zmianie identyfikatora sesji.

Raport tokenów służy do oszacowania USD według stawek zapisanych w adapterze: Groq 0,15/0,60 USD za milion tokenów wejścia/wyjścia, embeddingi 0,02 USD za milion. To kalkulacja techniczna, nie uzgodnienie faktury dostawcy. Po niejednoznacznej awarii pozostaje konserwatywna rezerwa budżetu. Awaria modelu pozostawia działające formularze, katalog i tor tekstowy.

Asystenci `ai.assist` zwracają edytowalne propozycje dla pomysłu, Karty, testu i zaproszenia. Nie zapisują ich automatycznie jako faktów ani nie wysyłają zaproszenia. Opcjonalne `ai.transcribe` i `ai.illustrate` wymagają zgody użytkownika oraz `ENABLE_MEDIA_AI=true`. Audio i wygenerowane PNG pozostają prywatnymi załącznikami z kontrolą dostępu. Ilustracja ma etykietę koncepcji. Opłaty multimediów są odrębnie rezerwowane, a do czasu rozliczenia nie są przedstawiane jako dokładny koszt dostawcy.

## Weryfikacja

Przypadki regresji są w `tests/matching-cases.ts`. Testy sprawdzają zgodność problemu, warunki, odmowę rekomendacji i granice dostępu. Zakres wykonanych prób oraz interpretację wyników opisuje [VALIDATION.md](VALIDATION.md).

Asystent zwraca wyłącznie dozwolone identyfikatory pól. Serwer sprawdza źródła, duplikaty i niedozwolone kwoty; budżet pozostaje w kalkulatorze formularza. Propozycja AI wymaga przeglądu i świadomego wstawienia przez autora.

## OCR dokumentów skanowanych

`imports.importPdf` najpierw odczytuje tekst lokalnie przez PDF.js. Dokument ma limit 5 MB i 50 stron. Jeżeli co najmniej jedna strona ma mniej niż 40 znaków odczytanego tekstu, operacja bez zgody zwraca `needs_ocr` i niczego nie publikuje. Dotyczy to również dokumentu mieszanego, w którym tylko część stron jest skanem.

Po zaznaczeniu zgody przez uprawnionego operatora adapter wysyła cały PDF do OpenAI Responses. Domyślny model `gpt-6-luna`, `store:false`, maksymalnie 10 stron i 12000 tokenów odpowiedzi. Brak zgody, limit stron, niekompletny wynik lub brak strony blokują import. Treść dokumentu jest traktowana jako dane do wiernego przepisania, bez wykonywania zawartych w nim poleceń. Dostawca nie otrzymuje narzędzi. `uncertainPages` wskazuje niepewne fragmenty, a każda strona zachowuje numer. Szkic wymaga porównania z oryginałem przed publikacją.

Koszt rezerwowany wynosi 0,10 USD. Po odpowiedzi rozliczany jest szacunek z faktycznego usage, według skonfigurowanych `OCR_INPUT_USD_PER_MILLION` i `OCR_OUTPUT_USD_PER_MILLION` (domyślnie 0,10/0,50). Niejasna awaria zachowuje pełną rezerwę. `OCR_MODEL` można zmienić razem ze stawkami po ponownym teście jakości. Model i obsługa PDF są opisane w [karcie GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) i [dokumentacji wejścia plikowego](https://developers.openai.com/api/docs/guides/file-inputs). Hash oryginalnego PDF wraz ze źródłem i prawami zapewnia idempotentny zapis szkicu także przy różnicy odczytu kolejnego wywołania. Oryginalnego base64 nie zapisuje się w logach ani rejestrze zużycia.

Adapter PDF przechowuje tekst, hash oryginału oraz metadane ekstrakcji; nie archiwizuje samego przesłanego PDF. Redaktor porównuje szkic ze swoim plikiem źródłowym. Import z URL odrzuca wydobyty tekst przekraczający 100000 znaków zamiast ucinać koniec. Komunikat wymaga podziału materiału, a poprzednia opublikowana wersja pozostaje bez zmian.

## Odtworzenie i dowody

```powershell
npm run test:domain
psst OPENAI_API_KEY -- node --import tsx scripts/eval-matching.ts
node --import tsx scripts/check-matching-live.ts
node --import tsx scripts/check-watch-live.ts
node --import tsx scripts/check-source-live.ts
node --import tsx scripts/check-assistants-live.ts
node --import tsx scripts/check-write-notifications-live.ts
python scripts/build-ocr-fixture.py
node --import tsx scripts/check-ocr-live.ts
node --import tsx scripts/reindex-live.ts
psst SPLOT_CONVEX_DEPLOY_KEY -- node --import tsx scripts/check-chunks-live.ts
psst SPLOT_CONVEX_DEPLOY_KEY -- node --import tsx scripts/load-matching.ts
```

Testy live wymagają uruchomionego demo i kont z seed. Test obciążenia jest dostępny wyłącznie we właściwym projekcie `APP_ENV=demo`, `APP_PROJECT=splot-hubmi`. Dodaje tylko rekordy z zastrzeżonym prefiksem i usuwa dokładnie ten prefiks w `finally`. W ostatnim zakończonym pomiarze dodano 10000, usunięto 10000, pozostało 0. Testy publikacji zmieniają wersję korpusu i pozostawiają oznaczoną historię syntetycznych spraw; ich innowacje zostają wycofane, a obserwowanie wyłączone. Nie uruchamiać ich w trakcie backupu ani równoległej publikacji korpusu.

Dokumentacja techniczna: [Convex vector search](https://docs.convex.dev/search/vector-search), [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs), [OpenAI Images](https://developers.openai.com/api/reference/resources/images/methods/generate), [OpenAI Transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create).
