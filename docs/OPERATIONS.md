# Uruchomienie i utrzymanie

## Konfiguracja

Frontend wymaga `VITE_CONVEX_URL`. Backend korzysta z `APP_ENV`, `APP_PROJECT`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `GROQ_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `SOURCE_ALLOWLIST`, `TIME_ZONE`, `AI_DAILY_BUDGET_USD` i `AI_MONTHLY_BUDGET_USD`. Inicjalizację opisuje [README](../README.md), a przykład bez sekretów znajduje się w [.env.example](../.env.example).

Klucze dostawców i sesji należą do konfiguracji serwera. Zmiana modelu embeddingowego lub wymiaru wymaga przebudowy indeksu. OCR ma osobną konfigurację `OCR_MODEL`, `OCR_INPUT_USD_PER_MILLION` i `OCR_OUTPUT_USD_PER_MILLION` oraz wymaga świadomej zgody operatora na przekazanie dokumentu dostawcy.

## Aktualizacje i kontrola

Przed wydaniem wykonaj sprawdzenie TypeScript, testy domenowe i build. Przepływy przeglądarkowe sprawdź na osobnym demo. Wdrożenie backendu i publikacja plików frontendu są osobnymi operacjami. `provision.mjs` służy do inicjalizacji i rotuje klucz sesji, więc nie zastępuje zwykłego wdrożenia.

Operator obserwuje błędy zadań i importu, kompletność indeksowania, kolejkę powiadomień, ważność źródeł, zużycie AI, storage i transfer. Aplikacja rezerwuje koszt przed wywołaniem AI i rozlicza użycie po odpowiedzi. Po wyczerpaniu limitu pozostają katalog, formularze i komunikacja; nowe generacje wymagają dostępnego budżetu.

Publikacja materiału wiedzy wymaga decyzji redaktora, praw do źródła oraz kompletnego indeksu. Wycofanie źródła wyklucza je z nowych rekomendacji. Istniejąca Karta zachowuje wersję i sygnał potrzeby przeglądu.

## Kopie i odzyskiwanie

`scripts/backup-restore.mjs` eksportuje bazę wraz z plikami i odtwarza ją w oddzielnym projekcie. Do wykonania wymaga `CONVEX_ACCESS_TOKEN` i `SPLOT_CONVEX_DEPLOY_KEY` przez psst. Zapisz kopię poza publiczną dystrybucją, określ retencję i sprawdź odzyskane dane, logowanie oraz odmowy dostępu. Skrypt tworzy środowisko odzyskiwania; jego uruchomienie zużywa zasoby konta Convex.

Testy obciążeniowe, seedy i reset wykonuj w wyznaczonym demo. Nie uruchamiaj ich równolegle z pomiarem, prezentacją, publikacją korpusu lub wykonywaniem kopii. Kontrola nazw `APP_ENV=demo` i `APP_PROJECT=splot-hubmi` ogranicza operacje demonstracyjne do właściwego środowiska.

## Organizacja usługi

Właściciel usługi odpowiada za konta dostawców i budżet. Kurator prowadzi bibliotekę i prawa do źródeł. Opiekun spraw koordynuje konsultacje i pilotaże. Ekspert ocenia przypisane warunki i adaptacje. Osoba techniczna prowadzi aktualizacje, monitoring i odzyskiwanie. Kalkulację usług oraz pracy opisuje [COSTS.md](COSTS.md).

Wartość Splotu wynika ze wspólnej historii potrzeby, decyzji, partnerstwa i wyniku testu. W pilotażu instytucjonalnym można mierzyć czas od zgłoszenia do uzgodnienia Karty, liczbę potwierdzonych partnerstw i wykorzystanie opublikowanych doświadczeń. Te wskaźniki są propozycją pomiaru wdrożenia, nie uzyskanymi wynikami społecznymi.

## Praca z rzeczywistymi danymi

Publiczne konta demo są przeznaczone wyłącznie do danych syntetycznych. Wdrożenie instytucjonalne wymaga własnej konfiguracji tożsamości i odzyskiwania kont, zatwierdzonych danych i szablonów, zasad retencji oraz przetwarzania przez dostawców. Obecny kontroler plików sprawdza format i aktywną treść; nie jest produkcyjnym skanerem antywirusowym. Połączenie z rzeczywistym systemem grantowym wymaga jego kontraktu API i potwierdzenia odbioru. Symulator w demo nie potwierdza formalnego złożenia wniosku ani przyznania grantu.
