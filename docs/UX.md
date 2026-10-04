# Ekrany, stany i dostępność

DEFOZO SOFTWARE HOUSE. Michał Kiełtyka.

Interfejs jest aplikacją React. Układ mobilny wykorzystuje te same formularze i reguły co komputer. Narrację prowadzą trzy wejścia: rozwiązanie, pomysł, pomoc lub testowanie.

| Ekran | Ścieżka | Działanie i stan |
| --- | --- | --- |
| Start | `#/home` | Trzy wejścia, wyszukiwanie bez konta i krótkie karty innowacji |
| Potrzeba i wyniki | `#/search` | Opis, interpretacja, źródła, informacje i innowacje, warunki, jedno pytanie, porównanie |
| Brak dopasowania | `#/search` | Jawna odmowa, uzupełnienie opisu, zapis, konsultacja lub nowy pomysł |
| Biblioteka i mapa | `#/library` | Filtry, paginacja, aktualne źródła, mapa trzech syntetycznych wartości i równoważna tabela z rokiem, jednostką i źródłem; brak rzeczywistych danych ROPS jest jawny |
| Materiał wiedzy | `#/innovation/:id` | Źródło, wersja, ograniczenia, kurs lub film z napisami i transkrypcją; innowacja prowadzi do Karty, edukacja do opisu potrzeby |
| Sprawy | `#/cases` | Właściciel, historia, status, obserwowanie, cisza, potwierdzenie wspomaganego zgłoszenia |
| Karta wdrożenia | `#/card/:id` | Plan, adaptacje, dwa warianty, zasoby, rezerwacje, budżet i mierniki |
| Fiszka i Canwa | `#/idea/new` | Dwie części, szkic, proces tekstowy i graficzny, jawnie akceptowane propozycje AI |
| Nabory | `#/calls` | Otwarcie, zamknięcie, odrębne schematy i obserwowanie zmian |
| Wniosek | `#/application/:id` | Walidacja pól, przegląd, potwierdzenie i niezmienna przyjęta wersja |
| Testy | `#/pilots`, `#/pilot/:id` | Zapisy, zgoda, miejsca, zadania, feedback, wyniki i decyzja kuratora |
| Zasoby | `#/partners` | Oferty, zakres, terminy, przyjęcie, odnowienie i wycofanie |
| Rozmowy | `#/messages` | Dwie sesje, prywatny wątek, odpowiedź, odczyt i powiązanie ze sprawą |
| Panel ROPS | `#/admin` | Wiedza, źródła i import, sprawy, nabory, trendy, operacje i audyt; redakcja oraz trendy mają odrębne uprawnienia |
| Prywatność | `#/settings` | Własne dane, eksport i potwierdzane usunięcie |

## Stany szczególne

Brak logowania wyświetla wyjaśnienie i formularz dostępu. Serwerowa odmowa jest pokazywana w czytelnym komunikacie, bez prywatnej treści. Brak danych ma opis następnego kroku. Praca w toku ma tekst i wskaźnik oczekiwania. Po utracie sieci pojawia się komunikat, a lokalny szkic zachowuje treść. Nieudana generacja nie blokuje katalogu i formularzy. Wersja zmieniona w innej sesji wymaga odświeżenia przed zapisem. Złożony wniosek i opinia nie przechodzą ponownie do edycji.

Wymagania zasobów używają tekstowych stanów spełniony, niespełniony i nieznany. Pochodzenie treści odróżnia źródło, deklarację, przyjętą propozycję AI i niewiadomą. Nieznana cena nie przyjmuje wartości zero. Zmiana źródła nie nadpisuje przyjętej Karty, a utrata potwierdzonego zasobu wstrzymuje powiązany test.

Import skanowanego PDF wymaga osobnej zgody operatora na przekazanie pliku do OCR. Wynik pozostaje szkicem do redakcji. Stan indeksowania jest widoczny przed publikacją; niekompletna nowa wersja nie zastępuje poprzedniej. Niezapisana lub zmieniona w innej sesji Karta nie pozwala zatwierdzić nieaktualnego planu.

## Obsługa klawiaturą i dostępność

Formularze mają etykiety i przypisane komunikaty błędów. Nawigacja udostępnia widoczny fokus i skrót do treści. Dialogi zarządzają fokusem, a zakładki obsługują strzałki oraz Home/End. Statusy mają opisy tekstowe. Film instruktażowy ma polskie napisy i transkrypcję; mapa ma odpowiednik tabelaryczny.

Zakres wykonanych kontroli i ich interpretację opisuje [VALIDATION.md](VALIDATION.md). Przed wdrożeniem dla konkretnej grupy odbiorców potrzebne są testy z jej udziałem i stosowanymi technologiami asystującymi.
