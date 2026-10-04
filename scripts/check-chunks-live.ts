import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {readFile,writeFile} from 'node:fs/promises';
const a=(name:string)=>makeFunctionReference<'action'>(name),q=(name:string)=>makeFunctionReference<'query'>(name),m=(name:string)=>makeFunctionReference<'mutation'>(name);
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url||!process.env.SPLOT_CONVEX_DEPLOY_KEY)throw new Error('Wymagany adres demo i klucz wdrożenia przez psst.');
const client=new ConvexHttpClient(url),reader=new ConvexHttpClient(url),anon=new ConvexHttpClient(url);(reader as any).setAdminAuth(process.env.SPLOT_CONVEX_DEPLOY_KEY);
const auth:any=await client.action(a('auth:signIn'),{provider:'password',params:{email:'rops@splot.demo',password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});client.setAuth(auth.tokens.token);
const marker=Date.now();const body=`[Strona 1]\n${'Samotni seniorzy spotykają się na regularnych rozmowach sąsiedzkich. Przykład syntetyczny służy wyłącznie kontroli indeksowania, nie jest dowodem skuteczności. '.repeat(14)}\n[Strona 2]\n${'Koordynator omawia dostępność sali, spokojną rozmowę i dogodny dojazd. Druga strona opisuje organizację spotkania i dobrowolny udział mieszkańców. '.repeat(15)}\nKoniec pełnego materiału ${marker}.`;
let id:any;const report:any={executedAt:new Date().toISOString(),url};
try{
 id=await client.mutation(m('knowledge:save'),{data:{stableId:`chunks-live-${marker}`,kind:'innovation',title:'Syntetyczna dwustronicowa instrukcja rozmów',summary:'Materiał techniczny do sprawdzenia stron i pełnego indeksu.',body,tags:['samotnosc','seniorzy'],problemTags:['samotnosc'],audienceTags:['seniorzy'],requirements:[],evidenceLevel:'concept',demo:true,sourceUrl:'/sources/watch-fixture.html',sourceTitle:'Syntetyczne źródło testu indeksowania stron',rights:'Autorska treść demonstracyjna CC BY 4.0'}});
 await client.mutation(m('knowledge:transition'),{id,action:'review'});await client.mutation(m('knowledge:transition'),{id,action:'publish'});
 let row:any=await client.query(q('knowledge:get'),{id});report.observedAfterRequest=row.status;let privateDuringIndexing:null|boolean=null;
 if(row.status==='indexing'){try{await anon.query(q('knowledge:get'),{id});privateDuringIndexing=false;}catch{privateDuringIndexing=true;}}
 const started=Date.now();while(row.status==='indexing'&&Date.now()-started<45000){await new Promise(resolve=>setTimeout(resolve,300));row=await client.query(q('knowledge:get'),{id});}
 const candidates:any=await reader.query(q('search:publicCandidates'),{description:'Samotni seniorzy potrzebują rozmów.',ids:[id]});const result=candidates.records.find((record:any)=>record._id===id);
 report.knowledgeId=id;report.status=row.status;report.expectedChunks=row.metadata?.expectedChunkCount;report.privateDuringIndexing=privateDuringIndexing;report.fragments=result?.fragments?.map((fragment:any)=>({id:fragment.id,locator:fragment.locator,version:fragment.version,textLength:fragment.text.length,containsEnd:fragment.text.includes(`Koniec pełnego materiału ${marker}`)}))??[];
 report.checks={publishedAfterIndex:row.status==='published'&&row.metadata?.expectedChunkCount>=4,privateIndex:privateDuringIndexing!==false,firstPage:report.fragments.some((fragment:any)=>fragment.locator.startsWith('strona 1')),secondPage:report.fragments.some((fragment:any)=>fragment.locator.startsWith('strona 2')),completeBody:row.body===body};report.passed=Object.values(report.checks).every(Boolean);
}finally{if(id){const row:any=await client.query(q('knowledge:get'),{id});if(row.status==='published')await client.mutation(m('knowledge:transition'),{id,action:'withdraw'});}report.fixtureWithdrawn=!!id;await writeFile('artifacts/chunks-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
