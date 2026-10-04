import {ConvexHttpClient,ConvexClient} from 'convex/browser';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {api,internal} from '../convex/_generated/api';
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();
const deployKey=process.env.SPLOT_CONVEX_DEPLOY_KEY;
if(!url||!deployKey)throw new Error('Uruchom przez psst SPLOT_CONVEX_DEPLOY_KEY -- npx tsx scripts/load-matching.ts');
const admin=new ConvexHttpClient(url);(admin as any).setAdminAuth(deployKey);
const fixtureApi=(internal as any).evaluation;
const initial:any=await admin.query(fixtureApi.corpusStats,{});
const results:any[]=[];let added=0,removed=0;
const activeClients:ConvexClient[]=[];
const p95=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
async function fixtureMutation(name:any,args:any):Promise<any>{for(let attempt=0;;attempt++){try{return await admin.mutation(name,args);}catch(error){if(attempt>=4||!String(error).includes('TooManyWrites'))throw error;await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}}}
try{
 for(let offset=0;offset<10000;offset+=100){const result:any=await fixtureMutation(fixtureApi.addLoadBatch,{offset,count:100});added+=result.added;if(offset%1000===0)console.log(`Dodano partię ${offset+100}/10000.`);await new Promise(resolve=>setTimeout(resolve,1100));}
 const stable:any=await admin.query(fixtureApi.corpusStats,{});if(initial.corpusVersion!==stable.corpusVersion)throw new Error('Korpus aplikacji zmienił się podczas przygotowania. Powtórz test w stabilnym stanie.');
 for(let index=0;index<100;index++)activeClients.push(new ConvexClient(url));
 await Promise.all(activeClients.map(client=>client.query(api.hub.me,{})));
 const descriptions=['Samotni seniorzy potrzebują rozmów i kontaktów z sąsiadami.','Seniorzy potrzebują ćwiczeń obsługi smartfonów i bankomatów.','Osoby starsze nie mają transportu do usług społecznych.'];
 const burst=await Promise.all(Array.from({length:100},async(_,index)=>{const client=new ConvexHttpClient(url);const start=performance.now();try{const result:any=await client.query(api.matching.preview,{description:descriptions[index%3]});return {session:index,durationMs:performance.now()-start,serverMs:result.trace.durationMs,returned:result.innovations.length,ok:result.innovations.length>0};}catch(error){return {session:index,durationMs:performance.now()-start,ok:false,error:String(error)};}}));
 results.push({scenario:'100 concurrent anonymous sessions, first lexical results',sessions:100,syntheticAdditionalCards:10000,p95Ms:p95(burst.map(row=>row.durationMs)),success:burst.filter(row=>row.ok).length,rows:burst});
 console.log(JSON.stringify({scenario:'100 sessions',p95Ms:results[0].p95Ms,success:results[0].success}));
 const generated:any[]=[];const minuteStart=Date.now();
 for(let index=0;index<10;index++){
  const waitUntil=minuteStart+index*6000;if(Date.now()<waitUntil)await new Promise(resolve=>setTimeout(resolve,waitUntil-Date.now()));
  generated.push((async()=>{const client=new ConvexHttpClient(url);const start=performance.now();try{const result:any=await client.action(api.matching.match,{description:`${descriptions[index%3]} Opis próbny numer ${index+1} w teście wydajności.`,sessionId:`load-session-${index}-${minuteStart}`});return {session:index,durationMs:performance.now()-start,trace:result.trace,warnings:result.warnings,ok:result.innovations.length>0};}catch(error){return {session:index,durationMs:performance.now()-start,ok:false,error:String(error)};}})());
 }
 const calls=await Promise.all(generated);
 results.push({scenario:'10 new AI tasks started at six-second intervals',tasks:10,arrivalWindowMs:54000,wallTimeMs:Date.now()-minuteStart,p95Ms:p95(calls.map(row=>row.durationMs)),success:calls.filter(row=>row.ok).length,rows:calls});
 const distinct=await Promise.all(Array.from({length:100},async(_,index)=>{const client=new ConvexHttpClient(url);const start=performance.now();try{const result:any=await client.query(api.matching.preview,{description:`${descriptions[index%3]} Osobna potrzeba w sesji ${index+1}.`});return {session:index,durationMs:performance.now()-start,serverMs:result.trace.durationMs,returned:result.innovations.length,ok:result.innovations.length>0};}catch(error){return {session:index,durationMs:performance.now()-start,ok:false,error:String(error)};}}));
 results.push({scenario:'100 concurrent anonymous sessions with distinct descriptions across three social topics',sessions:100,distinctDescriptions:100,syntheticAdditionalCards:10000,p95Ms:p95(distinct.map(row=>row.durationMs)),success:distinct.filter(row=>row.ok).length,rows:distinct});
 const connected=await Promise.all(activeClients.map(async(client,index)=>{const start=performance.now();try{const result:any=await client.query(api.matching.preview,{description:`${descriptions[index%3]} Potrzeba aktywnej sesji ${index+1}.`});return {session:index,durationMs:performance.now()-start,returned:result.innovations.length,ok:result.innovations.length>0};}catch(error){return {session:index,durationMs:performance.now()-start,ok:false,error:String(error)};}}));
 results.push({scenario:'100 already-connected WebSocket sessions with distinct descriptions',sessions:100,distinctDescriptions:100,syntheticAdditionalCards:10000,p95Ms:p95(connected.map(row=>row.durationMs)),success:connected.filter(row=>row.ok).length,rows:connected});
 const end:any=await admin.query(fixtureApi.corpusStats,{});if(end.corpusVersion!==initial.corpusVersion)throw new Error('Korpus aplikacji zmienił się podczas pomiaru. Wynik nieważny.');
}finally{
 await Promise.all(activeClients.map(client=>client.close()));
 for(;;){const result:any=await fixtureMutation(fixtureApi.removeLoadBatch,{});removed+=result.removed;if(!result.removed)break;}
 const report={executedAt:new Date().toISOString(),url,baseCorpusVersion:initial.corpusVersion,fixtureAdded:added,fixtureRemoved:removed,fixtureRemaining:(await admin.query(fixtureApi.corpusStats,{})).fixturePresent,limitations:['Dodatkowe 10 tys. kart ma syntetyczne rzadkie wektory, służą pomiarowi wielkości indeksu, nie jakości semantycznej.','100 niezależnych klientów HTTP to jednoczesne sesje wyszukiwania, nie pełna symulacja użytkowników przeglądarki. Pierwsza seria ma trzy powtarzające się opisy, trzecia sto różnych opisów w tych samych trzech tematach.','serverMs zapytania korzysta z transakcyjnego Date.now i nie stanowi niezależnego pomiaru CPU serwera. P95 dotyczy rzeczywistego czasu klienta HTTP.','Pomiar jednego środowiska demo nie stanowi SLA regionalnego.'],results};
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/matching-load.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:results.map(({rows,...summary})=>summary)},null,2));
}
