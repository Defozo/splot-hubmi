# Sprawdzenie działania Splotu

Poniższe wyniki dotyczą wykonanych prób technicznych na danych syntetycznych. Kod testów jest w `tests/` i `domain/`; polecenia uruchomienia opisuje [README](../README.md).

## Wersja i wyniki

| Kontrola | Wynik | Wersja i data |
| --- | --- | --- |
| Testy domenowe | 115 zaliczonych, 0 niezaliczonych | 3 października 2026; ponowione przy publikacji źródeł 4 października |
| Scenariusze Playwright | 22 zaliczone, 0 niezaliczonych, pominiętych i niestabilnych | Publiczny build `072826ccc85afd79`, 3 października 2026, 21:20:20–21:22:11 UTC |
| Instalacja, TypeScript i build | Zakończone poprawnie | Izolowana kopia źródeł, Node.js 24.13.0, 4 października 2026 |
| Odtworzenie bazy i plików | Zgodność tabel, działające logowanie i kontrola dostępu do pliku | Oddzielne środowisko odzyskiwania, 3 października 2026; 99,128 s dla tej kopii demo |

Identyfikator publicznego builda sprawdzono przed i po próbie Playwright. SHA-256 raportu tego przebiegu: `574098a235aa4db5f90be294646ad2ad9ad4af858ef0d93364f9ccb7c8d5e8a2`. Porządkowanie dokumentacji nie zmienia kodu produktu ani nie stanowi nowego przebiegu E2E.

## Zakres sprawdzeń

Testy obejmują wyszukiwanie i pytanie o warunek wdrożenia, fiszkę, Canwę, wniosek grantowy, rozmowę między sesjami oraz obieg czterech ról od Karty do publikacji doświadczenia. Testy domenowe sprawdzają uprawnienia, wersjonowanie, współbieżność, kompletność indeksu, import, pliki, obserwowanie i kontrakty odpowiedzi AI.

Regresje interfejsu obejmują nawigację klawiaturą, zakładki, komunikaty biblioteki, powiązanie błędu z polem, widoczną etykietę mobilną i spójność tytułów prób. Test tytułów używa kontrolnej odpowiedzi transportu i sprawdza renderowanie, bez oceny modelu.

Odtwarzacz instruktażowy sprawdzono pod kątem odtwarzania, przewijania i polskich napisów; kurs ma pięć kroków. Mapa przedstawia trzy oznaczone, syntetyczne wartości z jednostką, rokiem i źródłem oraz równoważną tabelą.

## Interpretacja

Techniczny zbiór dopasowania obejmuje 70 autorskich przypadków: 50 używanych przy ustalaniu reguł i 20 dodanych po ich zamrożeniu. Jest testem regresji, bez niezależnej oceny merytorycznej ROPS. Nie wykazuje skuteczności społecznej ani przewagi wyszukiwania hybrydowego dla rzeczywistych mieszkańców.

Próby obciążeniowe korzystały z syntetycznych rekordów i mierzyły odpowiedź klienta HTTP, bez renderowania React. Czas odzyskania dotyczy konkretnej kopii demo, bez gwarancji RTO/RPO. Próba OCR obejmowała jedną czytelną stronę syntetyczną; nie jest benchmarkiem trudnych skanów.

Wykonano automatyczne skany axe oraz wybrane kontrole klawiatury i układu mobilnego. Zakres nie obejmuje pełnego audytu WCAG, wszystkich kombinacji stanów, NVDA, VoiceOver ani badania użyteczności z reprezentatywnymi odbiorcami. Dane demo, wymagania integracji i zasady użycia pozostają opisane w [źródłach](SOURCES.md) i [utrzymaniu](OPERATIONS.md).
