import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {readFile,writeFile} from 'node:fs/promises';
const a=(name:string)=>makeFunctionReference<'action'>(name),q=(name:string)=>makeFunctionReference<'query'>(name);
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url)throw new Error('Brak URL');
const client=new ConvexHttpClient(url),anon=new ConvexHttpClient(url);
const auth:any=await client.action(a('auth:signIn'),{provider:'password',params:{email:'rops@splot.demo',password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});client.setAuth(auth.tokens.token);
const input={base64:(await readFile('artifacts/fixtures/ocr-scan.pdf')).toString('base64'),name:'Syntetyczny skan kontrolny OCR',sourceUrl:'/sources/ocr-fixture.html',rights:'Własny materiał syntetyczny DEFOZO SOFTWARE HOUSE, CC BY 4.0',demo:true};
const withoutConsent:any=await client.action(a('imports:importPdf'),input);if(!withoutConsent.requiresOcr)throw new Error('Skrypt wymaga obrazowego PDF bez warstwy tekstowej.');
const started=performance.now();const imported:any=await client.action(a('imports:importPdf'),{...input,allowOcr:true,ocrConsent:true});
const durationMs=performance.now()-started;
const material:any=await client.query(q('knowledge:get'),{id:imported.id});
let privateDraftProtected=false;try{await anon.query(q('knowledge:get'),{id:imported.id});}catch{privateDraftProtected=true;}
const expected=['samotni mieszkańcy','cotygodniowe spotkania','12 uczestników','4 spotkania','2026','ą ć ę ł ń ó ś ź ż'];
const normalized=(material.body as string).toLocaleLowerCase('pl');const checks=expected.map(phrase=>({phrase,found:normalized.includes(phrase)}));
const report={executedAt:new Date().toISOString(),url,fixture:'artifacts/fixtures/ocr-scan.pdf',withoutConsent:{requiresOcr:withoutConsent.requiresOcr,status:withoutConsent.status},id:imported.id,status:material.status,durationMs,extraction:imported.extraction,privateDraftProtected,checks,passed:checks.every(check=>check.found)&&privateDraftProtected&&material.status==='draft'&&imported.extraction.method==='ocr',limitations:['Jedna czytelna syntetyczna strona obrazowa. To rzeczywista inferencja i zapis szkicu, nie benchmark trudnych skanów.','Nie opublikowano wyniku automatycznie; redaktor musi porównać pełny tekst z oryginałem.']};await writeFile('artifacts/ocr-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
