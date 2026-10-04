/** Adapt real captured scenes to the reviewed narration, keeping raw recordings intact. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const work=resolve('output/_video_work');
const source=resolve(process.argv[2] || 'output/_video_work/manifests/capture.json');
const capture=JSON.parse(await readFile(source,'utf8'));
const narration=JSON.parse(await readFile(`${work}/audio-script.json`,'utf8'));
const captions=[
  'Starsi mieszkańcy chcą regularnych spotkań. Instytucja opisuje potrzebę w Splocie. Scenariusz demonstracyjny.',
  'Innowacje, materiały i źródła. Jedna odpowiedź pokazuje, co trzeba uzgodnić przed wdrożeniem.',
  'Karta wdrożenia: cel, działania, terminy i zaproszenie dla partnera.',
  'Partner potwierdza udział. Sala otrzymuje rezerwację.',
  'Własny pomysł: od fiszki przez Canwę do planu pierwszego testu.',
  'Dane z fiszki trafiają do formularza naboru. Złożony wniosek ma numer przyjęcia w HubMI.',
  'Pytania i ustalenia pozostają przy konkretnej sprawie.',
  'Opiekun odpowiada ze swojego konta. Autorka widzi odpowiedź.',
  'Autorka akceptuje plan, a opiekun zatwierdza tę wersję Karty.',
  'Gotowy plan przechodzi do pilotażu. Koordynator otwiera zapisy.',
  'Mieszkanka zgłasza udział. Koordynator przyjmuje ją do testu.',
  'Warunki i rezerwacja są potwierdzone. Rusza test usługi.',
  'Opinia uczestniczki prowadzi do konkretnej zmiany: instrukcji dojścia do dostępnego wejścia.',
  'Opiekun zapisuje wniosek z testu i zatwierdza opis doświadczenia.',
  'Opublikowane doświadczenie może wykorzystać kolejna instytucja.',
  'Nowa wiedza wraca do obserwowanej potrzeby. Autorka dostaje powiadomienie.',
  'Przy potrzebie spoza źródeł Splot proponuje konsultację i zapis sprawy.',
  'Demo: agile-kiwi-698.eu-west-1.convex.site · Plan usług: 220–330 USD/mies. + praca.\nDEFOZO SOFTWARE HOUSE · Michał Kiełtyka',
];
if(capture.scenes.length!==18)throw new Error('Incomplete recording');
capture.scenes=capture.scenes.map((scene,index)=>({ ...scene, caption:captions[index], targetDuration:narration.segments[index].duration }));
capture.duration=capture.scenes.reduce((sum,scene)=>sum+scene.targetDuration,0);
capture.revision={createdAt:new Date().toISOString(),sourceManifest:source,sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),scope:'New Polish narration, original quiet music, pitch captions, same real 18-scene workflow, updated UI recording.'};
await mkdir(`${work}/plans`,{recursive:true});
await writeFile(`${work}/manifests/pitch-capture.json`,JSON.stringify(capture,null,2));
console.log(JSON.stringify({duration:capture.duration,sceneCount:capture.scenes.length,manifest:`${work}/manifests/pitch-capture.json`}));
