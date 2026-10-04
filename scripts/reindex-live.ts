import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {readFile,writeFile} from 'node:fs/promises';
import {CHUNKING_VERSION} from '../domain/chunks';
const a=(name:string)=>makeFunctionReference<'action'>(name),q=(name:string)=>makeFunctionReference<'query'>(name);
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url)throw new Error('Brak URL');
const client=new ConvexHttpClient(url);
const auth:any=await client.action(a('auth:signIn'),{provider:'password',params:{email:'rops@splot.demo',password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});client.setAuth(auth.tokens.token);
const start=Date.now();const first:any=await client.action(a('search:reindex'),{});if(first.error)throw new Error(first.error);
let published:any[]=[],jobs:any[]=[];
for(;;){const [library,stats]:any[]=await Promise.all([client.query(q('knowledge:list'),{admin:true}),client.query(q('hub:adminStats'),{})]);published=library.filter((row:any)=>row.status==='published');const ids=new Set(published.map(row=>row._id));jobs=stats.jobs.filter((job:any)=>job.kind==='knowledge_index'&&ids.has(job.payload?.knowledgeId));
 if(jobs.some(job=>job.status==='failed'))throw new Error('Zadanie indeksowania zakończyło się błędem; sprawdź panel operatora.');
 if(published.every(row=>row.metadata?.chunkingVersion===CHUNKING_VERSION&&row.metadata?.expectedChunkCount>0)&&!jobs.some(job=>job.status==='processing'))break;
 if(Date.now()-start>180000)throw new Error('Indeksowanie nie ukończyło się w limicie pomiaru.');await new Promise(resolve=>setTimeout(resolve,1200));}
const report={executedAt:new Date().toISOString(),url,chunkingVersion:CHUNKING_VERSION,publishedDocuments:published.length,expectedChunks:published.reduce((n,row)=>n+row.metadata.expectedChunkCount,0),durationMs:Date.now()-start,firstBatch:first,visibleIndexJobs:jobs.map(job=>({id:job._id,status:job.status,knowledgeId:job.payload.knowledgeId})),passed:true};await writeFile('artifacts/reindex-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
