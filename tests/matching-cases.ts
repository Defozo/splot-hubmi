export interface EvalCase {id:string;description:string;expected:string[];information?:string;split:'validation'|'holdout'}
const groups:Array<[string,string[],string[]]>=[
 ['samotnosc',['sasiedzi','telefon'],['Starsze osoby są samotne i chcą regularnych spotkań z sąsiadami.','Seniorzy nie mają z kim porozmawiać, potrzebują towarzystwa.','Chcemy zmniejszyć izolację osób starszych poprzez rozmowy telefoniczne.','Emeryci potrzebują relacji i odwiedzin, nie szkolenia komputerowego.']],
 ['transport',['mobilnosc'],['Brakuje dojazdu seniorów do centrum usług społecznych.','Osoby z ograniczoną mobilnością potrzebują przejazdów na spotkania.','W naszej wsi nie kursuje autobus, starsi potrzebują dowozu.','Szukamy sposobu organizowania transportu mieszkańców do usług.']],
 ['cyfrowe',['cyfrowy','cyfrowy-dom'],['Seniorzy nie umieją obsługiwać smartfonów i bankomatów.','Potrzebujemy zajęć z bezpiecznego korzystania z internetu dla starszych.','Babcia chce samodzielnie używać telefonu i aplikacji.','Chcemy ograniczyć wykluczenie cyfrowe emerytów.']],
 ['opieka',['wytchnienie'],['Rodzinni opiekunowie potrzebują odpoczynku od opieki nad osobą zależną.','Córki i synowie osób z demencją proszą o opiekę wytchnieniową.','Opiekujemy się niesamodzielnym rodzicem i potrzebujemy zastępstwa.','Potrzeba krótkich dyżurów opiekuńczych wspierających rodziny.']],
 ['psychiczne',['emocje'],['Nastolatki potrzebują spotkań o emocjach i radzeniu sobie ze stresem.','Szkoła szuka programu wzmacniania dobrostanu psychicznego młodzieży.','Uczniowie chcą wsparcia psychologa w rozmowach o lęku.','Szukamy bezpiecznych spotkań rówieśniczych dotyczących zdrowia psychicznego.']],
 ['praca',['praca'],['Osoby długotrwale bezrobotne chcą wrócić do pracy.','Szukamy wsparcia aktywizacji zawodowej osób bez zatrudnienia.','Mieszkańcy potrzebują mentora i kontaktów z pracodawcami.','Jak przygotować osoby bez pracy do próby zawodowej?']],
 ['dostepnosc',['dostepny'],['Osoby na wózkach napotykają bariery w urzędzie.','Chcemy sprawdzić dostępność usług urzędu z osobami z niepełnosprawnościami.','Niewidomi mieszkańcy potrzebują prostszej ścieżki załatwiania spraw.','Instytucja planuje audyt dostępności i usuwanie barier.']],
 ['integracja',['integracja'],['Nowi mieszkańcy z Ukrainy chcą ćwiczyć język polski z sąsiadami.','Potrzebujemy integracji migrantów z lokalną społecznością.','Uchodźcy chcą poznać usługi i uczyć się języka w parach.','Szukamy tandemu językowego dla nowych mieszkańców.']],
 ['zywnosc',['zywnosc'],['Chcemy przekazywać nadwyżki żywności rodzinom w trudnej sytuacji.','Lokalne sklepy marnują jedzenie, a mieszkańcom brakuje posiłków.','Potrzebujemy sieci bezpiecznego dzielenia się produktami spożywczymi.','Szukamy sposobu organizacji wspólnych posiłków i ograniczenia głodu.']],
 ['mieszkanie',['mieszkanie'],['Osoby zagrożone bezdomnością potrzebują asystenta mieszkaniowego.','Rodzinom grozi eksmisja, chcemy skoordynować wsparcie mieszkaniowe.','Potrzebujemy partnerów pomagających uniknąć utraty mieszkania.','Mieszkańcy bez dachu nad głową szukają ścieżki do stabilnego lokum.']],
];
export const matchingCases:EvalCase[]=groups.flatMap(([topic,expected,descriptions],groupIndex)=>descriptions.map((description,index)=>({id:`positive-${groupIndex+1}-${index+1}`,description,expected,information:`guide-${topic}`,split:index<2?'validation' as const:'holdout' as const})));
const negatives=['Potrzebuję planu remontu silnika odrzutowego.','Szukam sposobu prowadzenia eksperymentu w fizyce jądrowej.','Chcę prognozować kurs akcji spółek giełdowych.','Potrzebuję algorytmu optymalizacji lotu satelity.','Szukamy technologii drążenia tunelu kolejowego.','Rolnicy potrzebują nowego środka przeciw grzybom atakującym zboża.','Laboratorium chce opracować materiał odporny na temperaturę 3000 stopni.','Szukamy detektora fal grawitacyjnych.','Potrzebuję instrukcji rekonstrukcji więzadła kolanowego.','Chcemy ograniczyć korozję turbin w elektrowni.'];
matchingCases.push(...negatives.map((description,index)=>({id:`negative-${index+1}`,description,expected:[],split:index<5?'validation' as const:'holdout' as const})));
// Original smoke results were inspected during threshold calibration; they are regression cases now.
for(const row of matchingCases)row.split='validation';
const heldOut:Array<[string,string[]]>=[
 ['W małej miejscowości osoby starsze spędzają całe dni bez kontaktów z innymi.',['sasiedzi','telefon']],
 ['Chcemy zaprosić samotnych emerytów do regularnego kręgu rozmów.',['sasiedzi','telefon']],
 ['Seniorzy nie docierają do CUS, bo nie mają transportu.',['mobilnosc']],
 ['Mieszkańcy proszą gminę o skoordynowanie dojazdów na zajęcia.',['mobilnosc']],
 ['Starsze mieszkanki boją się biletomatu, potrzebują ćwiczeń z instruktorem.',['cyfrowy','cyfrowy-dom']],
 ['Szukamy domowej nauki korzystania z internetu dla emerytów.',['cyfrowy','cyfrowy-dom']],
 ['Opiekunka męża z demencją potrzebuje kilku godzin odciążenia tygodniowo.',['wytchnienie']],
 ['Klasa chce nauczyć się rozmawiać o emocjach z psychologiem.',['emocje']],
 ['Osoby od lat bezrobotne proszą o wsparcie mentora zawodowego.',['praca']],
 ['Niepełnosprawni klienci chcą wspólnie poprawić dostępność urzędu.',['dostepny']],
 ['Rodziny migrantów proszą o tandemy do ćwiczenia języka polskiego.',['integracja']],
 ['Restauracje mają nadwyżki żywności, chcemy dzielić się posiłkami.',['zywnosc']],
 ['Mieszkańcy zagrożeni eksmisją potrzebują koordynatora pomocy mieszkaniowej.',['mieszkanie']],
 ['Pragniemy przeciwdziałać samotności osób starszych bez nauki telefonu.',['sasiedzi','telefon']],
 ['Lokalni partnerzy chcą tworzyć program opieki wytchnieniowej.',['wytchnienie']],
 ['Potrzebujemy schematu hodowli kryształów w próżni.',[]],
 ['Chcę projekt anteny do odbioru sygnału z Marsa.',[]],
 ['Szukam układu elektronicznego do pomiaru drgań mostu.',[]],
 ['Jak obliczyć trajektorię meteorytu?',[]],
 ['Huta potrzebuje technologii rafinacji stopów niklu.',[]],
];
matchingCases.push(...heldOut.map(([description,expected],index)=>({id:`heldout-${index+1}`,description,expected,split:'holdout' as const})));
