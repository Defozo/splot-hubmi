import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
const queryRef=(name:string)=>makeFunctionReference<'query'>(name);
const mutationRef=(name:string)=>makeFunctionReference<'mutation'>(name);
const actionRef=(name:string)=>makeFunctionReference<'action'>(name);
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();
if(!url)throw new Error('Brak adresu wdrożenia.');
async function login(email:string){const client=new ConvexHttpClient(url!);const result:any=await client.action(actionRef('auth:signIn'),{provider:'password',params:{email,password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});if(!result.tokens?.token)throw new Error('Logowanie nie powiodło się.');client.setAuth(result.tokens.token);return client;}
const owner=await login('instytucja@splot.demo'),operator=await login('rops@splot.demo');
const started=Date.now(),title=`Test obserwowania ${new Date().toISOString()}`;
const needId:any=await owner.mutation(mutationRef('hub:save'),{kind:'need',title,data:{description:'Samotni seniorzy potrzebują regularnego kontaktu i rozmów z sąsiadami.',group:'seniorzy',municipality:'Gmina testowa, dane syntetyczne',watch:true,quiet:false,resources:{}}});
async function waitFor<T>(description:string,read:()=>Promise<T>,predicate:(value:T)=>boolean,timeout=45000):Promise<T>{const start=Date.now();let last:T;do{last=await read();if(predicate(last))return last;await new Promise(resolve=>setTimeout(resolve,600));}while(Date.now()-start<timeout);throw new Error(`Nie spełniono warunku: ${description}`);}
const readNeed=()=>owner.query(queryRef('hub:get'),{id:needId}) as Promise<any>;
const notices=async()=>((await owner.query(queryRef('hub:notifications'),{})) as any[]).filter(row=>row.recordId===needId);
const baseline:any=await waitFor('baseline zapisanej potrzeby',readNeed,row=>!!row.data.lastMatch);
const noInitialNotification=(await notices()).length===0;
let innovation:any=null;
const report:any={executedAt:new Date().toISOString(),url,needId,baseline:{needVersion:baseline.version,matchRevision:baseline.data.matchRevision,innovationCount:baseline.data.lastMatch.innovations.length,noInitialNotification},checks:[]};
try{
 innovation=await operator.mutation(mutationRef('knowledge:save'),{data:{stableId:`watch-live-${started}`,title:'Testowy krąg rozmów sąsiedzkich',summary:'Regularny kontakt i małe kręgi rozmów seniorów odczuwających samotność. Autorski syntetyczny rekord do technicznego testu obserwowania.',body:`Autorski syntetyczny rekord do testu publikacji, obserwowania i wycofania wiedzy. Nie ma potwierdzonej skuteczności społecznej i nie opisuje realnej usługi. Identyfikator próby ${started}.`,kind:'innovation',tags:['samotnosc','seniorzy'],problemTags:['samotnosc'],audienceTags:['seniorzy'],requirements:[],evidenceLevel:'concept',demo:true,sourceUrl:'/sources/watch-fixture.html',sourceTitle:'Źródło technicznego testu obserwowania Splot',rights:'Autorska treść demonstracyjna CC BY 4.0'}});
 await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'review'});
 const publicationRequestedAt=Date.now();await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'publish'});
 await waitFor('ukończenie indeksu i publikacja',()=>operator.query(queryRef('knowledge:get'),{id:innovation}) as Promise<any>,row=>row.status==='published');const publishedAt=Date.now();
 const afterPublication:any=await waitFor('dopasowanie nowej publikacji',readNeed,row=>row.data.lastMatch?.innovations.some((item:any)=>item.id===innovation));
 const notificationRows:any[]=await waitFor('powiadomienie po publikacji',notices,rows=>rows.length===1);
 const concreteDiffAndSource=notificationRows[0].body.includes('Testowy krąg')&&afterPublication.data.lastMatchChange?.entries.some((entry:any)=>entry.sources.some((source:any)=>source.url==='/sources/watch-fixture.html'));
 report.checks.push({name:'new-publication',passed:!!concreteDiffAndSource,notificationCount:notificationRows.length,elapsedMs:Date.now()-publishedAt,elapsedFromPublicationRequestMs:Date.now()-publicationRequestedAt,key:notificationRows[0].key,body:notificationRows[0].body,diff:afterPublication.data.lastMatchChange,concreteDiffAndSource,matchRevision:afterPublication.data.matchRevision,corpusVersion:afterPublication.data.targetCorpusVersion});
 await new Promise(resolve=>setTimeout(resolve,1500));report.checks.push({name:'no-duplicate-notification',passed:(await notices()).length===1});
 const withdrawnAt=Date.now();await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'withdraw'});
 const afterWithdrawal:any=await waitFor('wycofanie podstawy wyniku',readNeed,row=>row.data.targetCorpusVersion>afterPublication.data.targetCorpusVersion&&!row.data.lastMatch?.innovations.some((item:any)=>item.id===innovation));
 const withdrawalNotices:any[]=await waitFor('powiadomienie o wycofaniu',notices,rows=>rows.length===2);
 report.checks.push({name:'withdrawn-source-basis',passed:withdrawalNotices.some(row=>row.key.endsWith(':source_withdrawn')),elapsedMs:Date.now()-withdrawnAt,corpusVersion:afterWithdrawal.data.targetCorpusVersion});
 await owner.mutation(mutationRef('hub:transition'),{id:needId,action:'quiet',data:{quiet:true}});
 await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'restore'});
 await waitFor('przywrócenie po pełnym indeksie',()=>operator.query(queryRef('knowledge:get'),{id:innovation}) as Promise<any>,row=>row.status==='published');
 await waitFor('przeliczenie w trybie ciszy',readNeed,row=>row.data.lastMatch?.innovations.some((item:any)=>item.id===innovation));
 await new Promise(resolve=>setTimeout(resolve,1500));report.checks.push({name:'quiet-suppresses-notification',passed:(await notices()).length===2});
 await owner.mutation(mutationRef('hub:transition'),{id:needId,action:'unwatch'});
 const beforeConsentOff:any=await readNeed();await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'withdraw'});
 await new Promise(resolve=>setTimeout(resolve,2500));const consentOff:any=await readNeed();report.checks.push({name:'consent-off-no-refresh-or-notice',passed:consentOff.data.watch===false&&consentOff.data.matchRevision===beforeConsentOff.data.matchRevision&&(await notices()).length===2});
}finally{
 if(innovation){const record:any=await operator.query(queryRef('knowledge:get'),{id:innovation});if(record.status==='published')await operator.mutation(mutationRef('knowledge:transition'),{id:innovation,action:'withdraw'});}
 const need:any=await readNeed();if(need.data.watch)await owner.mutation(mutationRef('hub:transition'),{id:needId,action:'unwatch'});
 report.final={watched:false,publishedTestInnovation:false,durationMs:Date.now()-started};await mkdir('artifacts',{recursive:true});await writeFile('artifacts/watch-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(!noInitialNotification||report.checks.some((check:any)=>!check.passed))process.exitCode=1;

