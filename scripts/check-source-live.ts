import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
const queryRef=(name:string)=>makeFunctionReference<'query'>(name);
const mutationRef=(name:string)=>makeFunctionReference<'mutation'>(name);
const actionRef=(name:string)=>makeFunctionReference<'action'>(name);
import {readFile,writeFile} from 'node:fs/promises';
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url)throw new Error('Brak adresu wdrożenia.');
const operator=new ConvexHttpClient(url),anonymous=new ConvexHttpClient(url);
const login:any=await operator.action(actionRef('auth:signIn'),{provider:'password',params:{email:'rops@splot.demo',password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});operator.setAuth(login.tokens.token);
const list:any[]=await operator.query(queryRef('knowledge:list'),{admin:true});
const fixture=list.filter(row=>row.stableId.startsWith('watch-live-')&&row.sources.every((source:any)=>source.status==='published')).sort((a,b)=>(b.createdAt??0)-(a.createdAt??0))[0];
if(!fixture||!fixture.sources.every((source:any)=>source.url==='/sources/watch-fixture.html'))throw new Error('Brak odizolowanego źródła poprzedniego testu.');
await operator.mutation(mutationRef('knowledge:transition'),{id:fixture._id,action:'restore'});
const publishWait=Date.now();while((await operator.query(queryRef('knowledge:get'),{id:fixture._id}) as any).status!=='published'){if(Date.now()-publishWait>45000)throw new Error('Indeks nie ukończył publikacji.');await new Promise(resolve=>setTimeout(resolve,500));}
const args={description:'Samotni seniorzy potrzebują regularnego kontaktu i rozmów z sąsiadami.',sessionId:'source-withdrawal-verification-20261003'};
const before:any=await anonymous.action(actionRef('matching:match'),args);
if(!before.innovations.some((row:any)=>row.id===fixture._id))throw new Error('Opublikowany kandydat nie znalazł się w wyniku kontrolnym.');
const started=Date.now();const withdrawal:any=await operator.mutation(mutationRef('knowledge:withdrawSource'),{sourceId:fixture.sourceIds[0]});
let directReadDenied=false;try{await anonymous.query(queryRef('knowledge:get'),{id:fixture._id});}catch{directReadDenied=true;}
const after:any=await anonymous.action(actionRef('matching:match'),args);
const duplicate:any=await operator.mutation(mutationRef('knowledge:withdrawSource'),{sourceId:fixture.sourceIds[0]});
const report={executedAt:new Date().toISOString(),url,knowledgeId:fixture._id,sourceId:fixture.sourceIds[0],checks:{sourceWithdrawn:true,directReadDenied,candidateRemoved:!after.innovations.some((row:any)=>row.id===fixture._id),newCorpusVersion:after.trace.corpusVersion>before.trace.corpusVersion,cacheDidNotLeakWithdrawnResult:after.trace.cache!==true},corpusBefore:before.trace.corpusVersion,corpusAfter:after.trace.corpusVersion,elapsedMs:Date.now()-started,withdrawal,duplicate};
await writeFile('artifacts/source-withdrawal-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(Object.values(report.checks).some(value=>value!==true))process.exitCode=1;

