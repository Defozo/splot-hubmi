import {internalMutation,internalQuery,action,internalAction} from './_generated/server';
import {internal} from './_generated/api';
import {v} from 'convex/values';
import {currentUser,requireUser,requirePermission,requireRecord} from './lib/acl';
import {searchTokens,problemConcepts,lexicalRanking} from '../domain/matching';
import {embed,EMBEDDING_MODEL} from './ai';
import {splitKnowledge,CHUNKING_VERSION} from '../domain/chunks';
import type {QueryCtx} from './_generated/server';
import type {Id} from './_generated/dataModel';

export async function retrieveCandidates(ctx:QueryCtx,args:{description:string;ids?:Id<'knowledge'>[];chunkIds?:Id<'knowledgeChunks'>[];includeFragments?:boolean}) {
  const rows=new Map<string,any>();
  const chunks=new Map<string,any>();
  for(const id of args.chunkIds??[]){const chunk=await ctx.db.get(id);if(chunk?.publishedScope==='public:published')chunks.set(String(id),chunk);}
  for(const id of args.ids ?? []){const row=await ctx.db.get(id);if(row)rows.set(String(id),row);}
  // Published documents index their canonical problem tags. Once a topic is known,
  // repeating every inflected word adds database work without new eligible results.
  const topics=problemConcepts(args.description);
  const tokens=topics.length?topics:searchTokens(args.description).slice(0,10);
  for(const token of tokens){
    const groups=await Promise.all(['innovation','information'].map(kind=>ctx.db.query('knowledge').withSearchIndex('search_knowledge',q=>q.search('searchText',token).eq('retrievalScope',`public:published:${kind}`)).take(20)));
    for(const row of groups.flat())rows.set(String(row._id),row);
    if(args.includeFragments!==false){
      const fragmentGroups=await Promise.all(['innovation','information'].map(kind=>ctx.db.query('knowledgeChunks').withSearchIndex('by_text',q=>q.search('searchText',token).eq('retrievalScope',`public:published:${kind}`)).take(20)));
      for(const chunk of fragmentGroups.flat())chunks.set(String(chunk._id),chunk);
    }
  }
  for(const chunk of chunks.values()){if(!rows.has(String(chunk.knowledgeId))){const row=await ctx.db.get(chunk.knowledgeId);if(row)rows.set(String(row._id),row);}}
  const published=[...rows.values()].filter(row=>row.status==='published'&&row.publishedScope==='public:published');
  const sourceIds=[...new Set(published.flatMap(row=>row.sourceIds))];
  const sources=(await Promise.all(sourceIds.map(id=>ctx.db.get(id as any)))).filter((source:any)=>source&&source.status==='published'&&source.reviewAt>=Date.now());
  const allowed=new Set(sources.map((source:any)=>String(source._id)));
  const valid=published.filter(row=>row.sourceIds.length>0&&row.sourceIds.every((id:any)=>allowed.has(String(id))));
  const lexicalIds=new Set(lexicalRanking(args.description,valid).filter(hit=>valid.find(item=>item._id===hit.id)?.kind==='innovation').slice(0,20).concat(lexicalRanking(args.description,valid).filter(hit=>valid.find(item=>item._id===hit.id)?.kind!=='innovation').slice(0,20)).map(hit=>hit.id));
  const vectorIds=new Set([...(args.ids ?? []).map(String),...([...chunks.values()].filter(chunk=>(args.chunkIds??[]).includes(chunk._id)).map(chunk=>String(chunk.knowledgeId)))]);
  const records=valid.filter(row=>lexicalIds.has(String(row._id))||vectorIds.has(String(row._id))).map(({embedding,...row})=>({...row,fragments:[...chunks.values()].filter(chunk=>chunk.knowledgeId===row._id&&chunk.version===row.version).slice(0,4).map(({embedding,...chunk})=>({id:String(chunk._id),locator:chunk.locator,text:chunk.text,sourceIds:chunk.sourceIds,version:chunk.version}))}));
  const corpus=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key','corpusVersion')).unique();
  return {records,sources,corpusVersion:Number(corpus?.value ?? 1)};
}
export const publicCandidates=internalQuery({args:{description:v.string(),ids:v.optional(v.array(v.id('knowledge'))),chunkIds:v.optional(v.array(v.id('knowledgeChunks')))},handler:retrieveCandidates});
export const resolveChunkHits=internalQuery({args:{hits:v.array(v.object({id:v.id('knowledgeChunks'),score:v.number()}))},handler:async(ctx,args)=>{const docs=new Map<string,{id:Id<'knowledge'>;score:number}>();for(const hit of args.hits){const chunk=await ctx.db.get(hit.id);if(!chunk||chunk.publishedScope!=='public:published')continue;const prior=docs.get(String(chunk.knowledgeId));if(!prior||hit.score>prior.score)docs.set(String(chunk.knowledgeId),{id:chunk.knowledgeId,score:hit.score});}return [...docs.values()];}});
export const verifyCandidates=internalQuery({args:{candidates:v.array(v.object({id:v.id('knowledge'),version:v.number()}))},handler:async(ctx,args)=>{
  const valid:string[]=[];
  for(const candidate of args.candidates){const row=await ctx.db.get(candidate.id);if(row?.status!=='published'||row.publishedScope!=='public:published'||row.version!==candidate.version)continue;let sourcesValid=row.sourceIds.length>0;for(const id of row.sourceIds){const source=await ctx.db.get(id);if(source?.status!=='published'||source.reviewAt<Date.now())sourcesValid=false;}if(sourcesValid)valid.push(String(row._id));}
  return valid;
}});
export const assistantContext=internalQuery({args:{innovationId:v.optional(v.string())},handler:async(ctx,args)=>{
  const {userId}=await requireUser(ctx);
  let innovation=null;
  if(args.innovationId){const id=ctx.db.normalizeId('knowledge',args.innovationId);if(!id)throw new Error('Nieznana innowacja.');innovation=await ctx.db.get(id);if(innovation?.status!=='published'||innovation.publishedScope!=='public:published')throw new Error('Innowacja nie jest opublikowana.');if(!innovation.sourceIds.length)throw new Error('Innowacja wymaga zweryfikowanego źródła.');for(const sourceId of innovation.sourceIds){const source=await ctx.db.get(sourceId);if(source?.status!=='published'||source.reviewAt<Date.now())throw new Error('Źródło wycofano albo wymaga aktualnego przeglądu.');}}
  return {userId,innovation};
}});
const reserveArgs={sessionId:v.string(),operation:v.string(),reserveUsd:v.number(),requireAccount:v.optional(v.boolean())};
export const reserveAI=internalMutation({args:reserveArgs,handler:async(ctx,args)=>{
  if(args.requireAccount)await requireUser(ctx);
  if(!/^[a-zA-Z0-9:_-]{8,180}$/.test(args.sessionId))return {allowed:false,reason:'Nieprawidłowa sesja wyszukiwania.'};
  const actor:any=await currentUser(ctx);
  const effectiveSession=actor?`user:${actor.userId}`:args.sessionId;
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),hour=new Date(now).toISOString().slice(0,13);
  const keys=[`ai:day:${day}`,`ai:month:${month}`,`ai:session:${effectiveSession}:${hour}`];
  const rows=await Promise.all(keys.map(key=>ctx.db.query('meta').withIndex('by_key',q=>q.eq('key',key)).unique()));
  const dailyLimit=Number(process.env.AI_DAILY_BUDGET_USD??3),monthlyLimit=Number(process.env.AI_MONTHLY_BUDGET_USD??30),sessionLimit=Number(args.operation==='chunk_indexing'?process.env.AI_INDEX_HOURLY_LIMIT??2000:process.env.AI_SESSION_HOURLY_LIMIT??40);
  if(Number(rows[0]?.value?.spent??0)+args.reserveUsd>dailyLimit||Number(rows[1]?.value?.spent??0)+args.reserveUsd>monthlyLimit)return {allowed:false,reason:'Wyczerpano budżet AI. Dostępne pozostaje wyszukiwanie słownikowe, katalog i formularze.'};
  if(Number(rows[2]?.value?.count??0)>=sessionLimit)return {allowed:false,reason:'Osiągnięto limit generacji w tej godzinie. Dostępne pozostaje wyszukiwanie słownikowe.'};
  for(let i=0;i<keys.length;i++){const value={spent:Number(rows[i]?.value?.spent??0)+args.reserveUsd,count:Number(rows[i]?.value?.count??0)+1,expiresAt:now+(i===1?35:2)*86400000};if(rows[i])await ctx.db.patch(rows[i]!._id,{value});else await ctx.db.insert('meta',{key:keys[i],value});}
  return {allowed:true,reservation:{keys,amount:args.reserveUsd}};
}});
export const recordUsage=internalMutation({args:{sessionId:v.string(),operation:v.string(),model:v.string(),inputTokens:v.number(),outputTokens:v.number(),costUsd:v.number(),reservation:v.optional(v.any())},handler:async(ctx,args)=>{
  const user:any=await currentUser(ctx);
  await ctx.db.insert('aiUsage',{...(user?.userId?{userId:user.userId}:{}),sessionId:args.sessionId,operation:args.operation,model:args.model,inputTokens:args.inputTokens,outputTokens:args.outputTokens,costUsd:args.costUsd,createdAt:Date.now()});
  if(args.reservation)for(const key of args.reservation.keys){const row=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key',key)).unique();if(row)await ctx.db.patch(row._id,{value:{...row.value,spent:Math.max(0,Number(row.value.spent)-args.reservation.amount+args.costUsd)}});}
}});
export const pendingEmbeddings=internalQuery({args:{admin:v.optional(v.boolean()),cursor:v.optional(v.string())},handler:async(ctx,args)=>{
  if(args.admin)await requirePermission(ctx,'knowledge:edit');
  const page=await ctx.db.query('knowledge').withIndex('by_scope_kind',q=>q.eq('publishedScope','public:published')).paginate({cursor:args.cursor??null,numItems:8});
  return {rows:page.page.filter(row=>row.status==='published').map(row=>({id:row._id,version:row.version})),cursor:page.isDone?null:page.continueCursor};
}});
export const stageChunks=internalMutation({args:{id:v.id('knowledge'),version:v.number(),model:v.string()},handler:async(ctx,args)=>{
  const row=await ctx.db.get(args.id);if(!row||row.version!==args.version||!['indexing','published'].includes(row.status))return null;
  const parts=splitKnowledge(row),existing=await ctx.db.query('knowledgeChunks').withIndex('by_knowledge',q=>q.eq('knowledgeId',row._id)).collect();
  for(const stale of existing)if(!parts.some(part=>part.ordinal===stale.ordinal&&part.hash===stale.hash))await ctx.db.delete(stale._id);
  const pending=[];
  for(const part of parts){
    let chunk=existing.find(chunk=>chunk.ordinal===part.ordinal&&chunk.hash===part.hash);
    if(!chunk){const reusable=(await ctx.db.query('knowledgeChunks').withIndex('by_stable_hash',q=>q.eq('stableId',row.stableId).eq('hash',part.hash)).take(50)).find(chunk=>chunk.embedding?.length===1536&&chunk.embeddingModel===args.model&&chunk.searchText===part.searchText);
      const id=await ctx.db.insert('knowledgeChunks',{...part,knowledgeId:row._id,stableId:row.stableId,version:row.version,sourceIds:row.sourceIds,publishedScope:row.status==='published'?'public:published':'private:indexing',retrievalScope:row.status==='published'?`public:published:${row.kind==='innovation'?'innovation':'information'}`:'private:indexing',...(reusable?{embedding:reusable.embedding,embeddingModel:args.model}:{})});chunk=(await ctx.db.get(id))!;
    }
    if(!chunk.embedding?.length||chunk.embeddingModel!==args.model)pending.push({id:chunk._id,text:part.searchText});
  }
  const priorJobId=typeof row.metadata?.indexJobId==='string'?ctx.db.normalizeId('jobs',row.metadata.indexJobId):null;
  const priorJob=priorJobId?await ctx.db.get(priorJobId):null;
  let indexJobId=priorJob?.payload?.knowledgeId===row._id?priorJob._id:null;
  if(indexJobId)await ctx.db.patch(indexJobId,{status:'processing',attempts:priorJob!.attempts+1,updatedAt:Date.now()});
  else indexJobId=await ctx.db.insert('jobs',{kind:'knowledge_index',status:'processing',attempts:1,payload:{knowledgeId:row._id,version:row.version},createdAt:Date.now(),updatedAt:Date.now()});
  await ctx.db.patch(row._id,{metadata:{...row.metadata,expectedChunkCount:parts.length,chunkingVersion:CHUNKING_VERSION,indexJobId}});
  return {id:row._id,version:row.version,status:row.status,pending,count:parts.length,reused:parts.length-pending.length};
}});
export const indexState=internalMutation({args:{id:v.id('knowledge'),version:v.number(),error:v.optional(v.string())},handler:async(ctx,args)=>{
  const row=await ctx.db.get(args.id);if(!row||row.version!==args.version)return;
  const jobId=typeof row.metadata?.indexJobId==='string'?ctx.db.normalizeId('jobs',row.metadata.indexJobId):null;
  const job=jobId?await ctx.db.get(jobId):null;if(job?.payload?.knowledgeId!==row._id)return;
  await ctx.db.patch(job!._id,{status:args.error?'failed':'completed',...(args.error?{error:args.error.slice(0,600)}:{}),updatedAt:Date.now()});
}});
export const storeEmbeddings=internalMutation({args:{model:v.string(),rows:v.array(v.object({id:v.id('knowledgeChunks'),version:v.number(),vector:v.array(v.number())}))},handler:async(ctx,args)=>{
  let stored=0;
  for(const row of args.rows){if(row.vector.length!==1536||row.vector.some(n=>!Number.isFinite(n)))throw new Error('Nieprawidłowy wektor.');const item=await ctx.db.get(row.id);if(!item||item.version!==row.version)continue;const doc=await ctx.db.get(item.knowledgeId);if(!doc||!['indexing','published'].includes(doc.status)||doc.version!==row.version)continue;await ctx.db.patch(row.id,{embedding:row.vector,embeddingModel:args.model});stored++;}
  return stored;
}});
async function indexDocument(ctx:any,id:Id<'knowledge'>,version:number):Promise<any>{
  const plan:any=await ctx.runMutation(internal.search.stageChunks,{id,version,model:EMBEDDING_MODEL()});if(!plan)return {indexed:0,skipped:true};
  let indexed=0;
  for(let offset=0;offset<plan.pending.length;offset+=16){const pending=plan.pending.slice(offset,offset+16);const reservation:any=await ctx.runMutation(internal.search.reserveAI,{sessionId:'system:indexing',operation:'chunk_indexing',reserveUsd:.004});
    if(!reservation.allowed){await ctx.runMutation(internal.search.indexState,{id,version,error:reservation.reason});return {indexed,error:reservation.reason};}
    try{const result=await embed(pending.map((item:any)=>item.text));indexed+=await ctx.runMutation(internal.search.storeEmbeddings,{model:result.usage.model,rows:pending.map((item:any,index:number)=>({id:item.id,version,vector:result.vectors[index]}))});await ctx.runMutation(internal.search.recordUsage,{...result.usage,operation:'chunk_indexing',sessionId:'system:indexing',reservation:reservation.reservation});}
    catch(error){await ctx.runMutation(internal.search.recordUsage,{model:EMBEDDING_MODEL(),inputTokens:0,outputTokens:0,costUsd:.004,operation:'chunk_indexing:failed_estimated_reserve',sessionId:'system:indexing',reservation:reservation.reservation});await ctx.runMutation(internal.search.indexState,{id,version,error:'Dostawca embeddingów nie ukończył indeksu. Ponów indeksowanie po sprawdzeniu konfiguracji i budżetu.'});throw error;}
  }
  try{if(plan.status==='indexing')await ctx.runMutation(internal.knowledge.commitPublication,{id,version});else await ctx.runMutation(internal.search.indexState,{id,version});}
  catch(error){await ctx.runMutation(internal.search.indexState,{id,version,error:'Nie zatwierdzono publikacji. Sprawdź kompletność indeksu i aktualność źródeł.'});throw error;}
  return {indexed,reused:plan.reused,chunks:plan.count};
}
async function indexBatch(ctx:any,admin=false,cursor?:string):Promise<any>{
  const page:any=await ctx.runQuery(internal.search.pendingEmbeddings,{admin,cursor});
  let indexed=0;for(const row of page.rows){const result=await indexDocument(ctx,row.id,row.version);if(result.error)return {...result,indexed};indexed+=result.indexed;}
  return {indexed,remaining:!!page.cursor,cursor:page.cursor};
}
export const reindex=action({args:{},handler:async(ctx):Promise<any>=>{const result=await indexBatch(ctx,true);if(result.cursor)await ctx.scheduler.runAfter(1000,internal.search.indexPublished,{cursor:result.cursor});return result;}});
export const indexPublished=internalAction({args:{id:v.optional(v.id('knowledge')),version:v.optional(v.number()),cursor:v.optional(v.string())},handler:async(ctx,args):Promise<any>=>{if(args.id){if(args.version===undefined)throw new Error('Brak wersji indeksowanego materiału.');return indexDocument(ctx,args.id,args.version);}const result=await indexBatch(ctx,false,args.cursor);if(result.cursor)await ctx.scheduler.runAfter(1000,internal.search.indexPublished,{cursor:result.cursor});return result;}});
export const persistRun=internalMutation({args:{result:v.any()},handler:async(ctx,args)=>{
  const user:any=await currentUser(ctx);
  return ctx.db.insert('matches',{...(user?{ownerId:user.userId}:{}),needVersion:1,corpusVersion:args.result.trace.corpusVersion,result:args.result,createdAt:Date.now()});
}});
export const readCache=internalQuery({args:{key:v.string()},handler:async(ctx,args)=>{
  const entry=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key',args.key)).unique();
  return entry&&entry.value.expiresAt>Date.now()?entry.value.result:null;
}});
export const writeCache=internalMutation({args:{key:v.string(),result:v.any()},handler:async(ctx,args)=>{
  const row=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key',args.key)).unique();
  const value={result:args.result,expiresAt:Date.now()+60000};
  if(row)await ctx.db.patch(row._id,{value});else await ctx.db.insert('meta',{key:args.key,value});
}});
export const mediaContext=internalQuery({args:{recordId:v.optional(v.id('records')),fileId:v.optional(v.id('files'))},handler:async(ctx,args)=>{
  let file=null;
  if(args.fileId){file=await ctx.db.get(args.fileId);if(!file)throw new Error('Brak pliku.');}
  const recordId=args.recordId??file?.recordId;
  if(!recordId)throw new Error('Media wymagają zapisanej sprawy.');
  const access=await requireRecord(ctx,recordId);
  if(!['idea','card','need'].includes(access.record.kind)||!['draft','open','review_required','changes_requested'].includes(access.record.status))throw new Error('Media można tworzyć dla roboczej potrzeby, pomysłu lub Karty. Zatwierdzona wersja pozostaje niezmienna.');
  if(file&&(file.recordId!==recordId||file.status!=='clean'))throw new Error('Plik jest w kwarantannie albo niedostępny.');
  return {userId:access.userId,recordId,file,enabled:process.env.ENABLE_MEDIA_AI==='true'};
}});
export const registerMedia=internalMutation({args:{recordId:v.id('records'),storageId:v.id('_storage'),size:v.number(),model:v.string()},handler:async(ctx,args)=>{
  const {userId,record}=await requireRecord(ctx,args.recordId);
  if(!['idea','card','need'].includes(record.kind)||!['draft','open','review_required','changes_requested'].includes(record.status))throw new Error('Stan dokumentu zmienił się. Nie można dopisać obrazu do zatwierdzonej wersji.');
  const metadata=await ctx.db.system.get(args.storageId);
  if(!metadata||metadata.size!==args.size||metadata.contentType!=='image/png')throw new Error('Niepoprawny wygenerowany obraz.');
  return ctx.db.insert('files',{ownerId:userId,recordId:args.recordId,storageId:args.storageId,name:'koncepcja-AI-do-przegladu.png',mimeType:'image/png',size:args.size,status:'clean',scan:`provider-generated:${args.model}`,createdAt:Date.now()});
}});
export const purgeTransient=internalMutation({args:{table:v.optional(v.union(v.literal('matches'),v.literal('meta'))),cursor:v.optional(v.string())},handler:async(ctx,args)=>{
  const now=Date.now(),table=args.table??'matches';
  let removed=0;
  if(table==='matches'){
    const page=await ctx.db.query('matches').paginate({cursor:args.cursor??null,numItems:100});
    for(const row of page.page){const ttl=row.ownerId?30*86400000:86400000;if(!row.needId&&row.createdAt<now-ttl){await ctx.db.delete(row._id);removed++;}}
    if(!page.isDone)await ctx.scheduler.runAfter(0,internal.search.purgeTransient,{table,cursor:page.continueCursor});
    else await ctx.scheduler.runAfter(0,internal.search.purgeTransient,{table:'meta'});
  }else{
    const page=await ctx.db.query('meta').paginate({cursor:args.cursor??null,numItems:100});
    for(const row of page.page)if(row.value?.expiresAt&&row.value.expiresAt<now){await ctx.db.delete(row._id);removed++;}
    if(!page.isDone)await ctx.scheduler.runAfter(0,internal.search.purgeTransient,{table,cursor:page.continueCursor});
  }
  return {removed};
}});
