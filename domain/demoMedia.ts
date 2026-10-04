export const demoMediaTranscript = `Splot dla HubMI: opis potrzeby i pierwszy wynik
DEFOZO SOFTWARE HOUSE. Michał Kiełtyka. CC BY 4.0.
Nagranie działającego prototypu. Wszystkie osoby, potrzeby i materiały są demonstracyjne.

0:00-0:14. Użytkowniczka opisuje samotność starszych mieszkańców i potrzebę cotygodniowych spotkań. Wyszukiwarka przedstawia interpretację oraz pyta o możliwość zapewnienia koordynatora spotkań. Zaczynamy od potrzeby, nie od formularza instytucji.
0:14-0:26. Użytkowniczka porównuje wyniki i przechodzi do Karty wdrożenia. Obok innowacji są informacje pomocnicze, źródła i jawne warunki. Odpowiedź na pytanie zmienia ocenę gotowości konkretnego rozwiązania. Nie oznacza to dowodu skuteczności społecznej.

Film nie zawiera wypowiedzi głosowej. Polskie napisy są dostępne jako ścieżka WebVTT w odtwarzaczu. Ten tekst opisuje także czynności pokazywane na ekranie.`;

export const demoLearningSteps = [
  { title: "Opisz sytuację", body: "Napisz, co chcesz zmienić i kogo dotyczy potrzeba. Możesz wskazać miejscowość. Nie podawaj danych osobowych ani szczegółów zdrowotnych." },
  { title: "Sprawdź interpretację", body: "Przeczytaj proponowany cel. Jeśli odbiega od Twojej potrzeby, popraw oczekiwany efekt i wyszukaj ponownie. Interpretacja AI jest propozycją do sprawdzenia." },
  { title: "Odróżnij informację od innowacji", body: "Informacje pomagają zrozumieć problem, a innowacje są propozycjami do rozważenia. Otwórz podane źródło i sprawdź, czy materiał jest demonstracyjny oraz jaki ma poziom dowodów." },
  { title: "Odpowiedz na istotne pytanie", body: "Zadeklaruj rzeczywisty zasób, jeśli znasz odpowiedź. Wybór „nie wiem” zachowuje niewiadomą. Spełnienie warunków nie jest dowodem skuteczności rozwiązania." },
  { title: "Wybierz kolejny krok", body: "Możesz zapisać potrzebę, poprosić ROPS o konsultację albo, jako instytucja, przygotować Kartę wdrożenia. Powiadomienia o nowej wiedzy wymagają Twojej zgody." },
];

export const demoMediaMetadata = {
  videoUrl: "/media/splot-intro.mp4",
  vttUrl: "/media/splot-intro.vtt",
  transcript: demoMediaTranscript,
  transcriptUrl: "/media/splot-intro-transcript.txt",
  durationSeconds: 26,
  author: "Michał Kiełtyka, DEFOZO SOFTWARE HOUSE",
  license: "CC BY 4.0",
  sourceType: "Nagranie własnej aplikacji z syntetycznymi danymi",
};
