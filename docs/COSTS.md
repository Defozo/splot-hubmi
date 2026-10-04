# Koszt i zasoby utrzymania

Splot dla HubMI. DEFOZO SOFTWARE HOUSE, Michał Kiełtyka. Wycena techniczna z 3 października 2026 r., USD netto, bez kursu walutowego i podatków.

## Scenariusz miesięczny

Przykładowy miesięczny wolumen: 10 tys. analiz interaktywnych, 2 tys. ponownych dopasowań obserwowanych potrzeb, 2 tys. operacji kreatora i podsumowań, 5 mln tokenów embeddingów. Wielkości są założeniami budżetowymi.

| Pozycja | Obliczenie lub założenie | USD / miesiąc |
| --- | --- | ---: |
| Analizy i ponowne dopasowania | 12 000 × (8000 × 0,15 + 2000 × 0,60) / 1 mln | 28,80 |
| Kreator i podsumowania | 2000 × (12 000 × 0,15 + 3000 × 0,60) / 1 mln | 7,20 |
| Embeddingi | 5 mln × 0,02 / 1 mln | 0,10 |
| Bufor AI | 30% × 36,10 | 10,83 |
| Convex Professional | Przykładowe 2 konta utrzymania × 25 USD | 50,00 |
| Hosting, domena, kopie i import | Rezerwa do wyceny | 30,00–80,00 |
| Backend i transfer ponad pakiet | Rezerwa zależna od użycia i regionu | 40,00–100,00 |
| Zmiana modelu lub opcjonalne media | Rezerwa | 50,00 |
| Razem usługi techniczne | Suma stawek i rezerw | **216,93–326,93** |

Do planowania: **220–330 USD miesięcznie**. Bieżące demo serwuje frontend z HTTP Convex, więc nie wymaga drugiego dostawcy hostingu. Rezerwy uwzględniają możliwe przyszłe potrzeby, nie stanowią rachunku za to wdrożenie. Kalkulacja obejmuje dwa konta utrzymania instytucjonalnego.

Stawki sprawdzono na oficjalnych stronach: [Groq GPT-OSS 120B](https://console.groq.com/docs/models) 0,15 USD za mln tokenów wejścia i 0,60 USD wyjścia, [OpenAI text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small) 0,02 USD za mln tokenów, [Convex](https://www.convex.dev/pricing) 25 USD za dewelopera miesięcznie w planie Professional. Ceny i pakiety mogą się zmieniać.

## Pomiar w aplikacji

Każde wywołanie zapisuje liczbę raportowanych tokenów, model, cel, czas i oszacowany koszt. Rezerwacja budżetu poprzedza wywołanie, a zakończenie zwalnia niewykorzystaną część. Demo ma limit dzienny 5 USD i miesięczny 50 USD. Limit dostawcy i koszt storage, odczytów, indeksu wektorowego oraz transferu wymagają osobnego monitoringu.

Koszt wyliczony z tokenów nie jest fakturą dostawcy. Opcjonalne audio i obrazy mają osobny przełącznik oraz konserwatywną rezerwację kosztu. Bez aktywacji pozostają wyłączone.

Własny 26-sekundowy film instruktażowy `public/media/splot-intro.mp4`, napisy i pięciostopniowy kurs są udostępnione na CC BY 4.0 i nie dodają opłat licencyjnych. MP4 ma około 0,5 MB. Odtwarzanie korzysta ze zwykłego storage i transferu aplikacji, bez wywołania generatywnego modelu. Transfer planuje się jako rozmiar faktycznie pobranych fragmentów razy liczba odtworzeń; powtórzenia i cache wpływają na wynik. Publikacja tekstu filmu i kursu uruchamia zwykłe, mierzone indeksowanie fragmentów. To odrębne od opcjonalnego generowania nowych obrazów lub audio.

Rzeczywisty import jednego czytelnego skanu PDF przez OCR trwał 3828 ms i zapisał szacowany koszt 0,0005233 USD. Ten pomiar obejmuje jedną syntetyczną stronę i użyty model `gpt-6-luna`; nie jest stawką za dowolny dokument ani wyceną archiwum ROPS. Import wymaga osobnej zgody operatora, rezerwacji budżetu i późniejszego przeglądu redakcyjnego. Koszt tego przeglądu należy doliczyć jako pracę osoby.

## Praca i odpowiedzialność

Pełny koszt utrzymania to usługi techniczne oraz:

`H_redakcja × R_redakcja + H_koordynacja × R_koordynacja + H_eksperci × R_eksperci + H_techniczne × R_techniczne`

ROPS ustala godziny i stawki na podstawie wolumenu spraw. Potrzebni są właściciel produktu, kurator wiedzy i dostępności, koordynator spraw, ekspert merytoryczny oraz opiekun techniczny. Finansowanie działań społecznych i grantów jest odrębne. Przeliczenie na PLN wymaga kursu wskazanego w uzgodnieniu rozliczeniowym.

Demo pozostaje na kontach dostawców autora do czasu przekazania. Instytucja powinna przejąć własne konta, rozliczenia, uprawnienia i politykę retencji. SLA, okres finansowania i wymagania odbioru ustala się w umowie utrzymania.
