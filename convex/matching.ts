import {action,query,internalAction,internalMutation,internalQuery} from './_generated/server';
import {internal} from './_generated/api';
import {v} from 'convex/values';
import {buildMatch,chooseQuestion,concepts,canCommitWatch,describeMaterialChange,stripPrivate,RULE_VERSION,PROMPT_VERSION} from '../domain/matching';
import {embed,interpret,explain,GENERATION_MODEL} from './ai';
import {retrieveCandidates} from './search';

type MatchArgs={description:string;audience?:string;municipality?:string;resources?:Record<string,any>;sessionId:string;mode?:'hybrid'|'lexical'|'vector';skipGeneration?:boolean};
async function runMatch(ctx:any,args:MatchArgs):Promise<any>{
  const start=Date.now();
  if(args.description.trim().length<8||args.description.length>6000)throw new Error('Opisz potrzebę w 8-6000 znakach.');
  const description=stripPrivate(args.description);
  let interpretation:any={problem:description,outcome:'Do uzupełnienia przez autora',audience:args.audience??'',context:args.municipality??'',constraints:[],unknowns:['Dostępne zasoby i warunki lokalne'],origin:'rules'};
  const warnings:string[]=[];
  const usage:Array<{model:string;inputTokens:number;outputTokens:number;costUsd:number}>=[];
  let uncertainProviderCharge=false;
  const requestedMode=args.mode??'hybrid';
  const base:any=await ctx.runQuery(internal.search.publicCandidates,{description});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({description,audience:args.audience??'',municipality:args.municipality??'',resources:args.resources??{},mode:requestedMode,scope:'public:published',corpus:base.corpusVersion,rules:RULE_VERSION,prompt:PROMPT_VERSION,model:GENERATION_MODEL(),generation:!args.skipGeneration})));
  const cacheKey='cache:matching:'+Array.from(new Uint8Array(hash)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const cached:any=await ctx.runQuery(internal.search.readCache,{key:cacheKey});
  if(cached){const valid:string[]=await ctx.runQuery(internal.search.verifyCandidates,{candidates:[...cached.innovations,...cached.information].map((item:any)=>({id:item.id,version:item.version}))});if(valid.length===cached.innovations.length+cached.information.length){const result={...cached,trace:{...cached.trace,cache:true,costUsd:0,durationMs:Date.now()-start,createdAt:Date.now()}};if(!args.skipGeneration)await ctx.runMutation(internal.search.persistRun,{result});return result;}}
  const budget:any=await ctx.runMutation(internal.search.reserveAI,{sessionId:args.sessionId,operation:'matching',reserveUsd:0.015});
  if(!budget.allowed)warnings.push(budget.reason);
  let vectorHits:any[]=[];
  let chunkIds:any[]=[];
  if(budget.allowed){
    const results=await Promise.allSettled([
      !args.skipGeneration ? interpret(description,args.audience,args.municipality) : Promise.resolve(null),
      requestedMode!=='lexical' ? embed([description]) : Promise.resolve(null)
    ]);
    const interpreted=results[0];
    if(interpreted.status==='fulfilled'&&interpreted.value){interpretation=interpreted.value.value;usage.push(interpreted.value.usage);}else if(interpreted.status==='rejected'){uncertainProviderCharge=true;warnings.push('Interpretacja AI niedostępna. Zachowano opis autora i reguły słownikowe.');}
    const embedded=results[1];
    if(embedded.status==='fulfilled'&&embedded.value){
      usage.push(embedded.value.usage);
      try{
        const groups=await Promise.all(['innovation','information'].map(kind=>ctx.vectorSearch('knowledgeChunks','by_embedding',{vector:embedded.value!.vectors[0],limit:20,filter:(q:any)=>q.eq('retrievalScope',`public:published:${kind}`)})));
        const hits=groups.flat().map((hit:any)=>({id:hit._id,score:hit._score}));chunkIds=hits.map(hit=>hit.id);
        vectorHits=await ctx.runQuery(internal.search.resolveChunkHits,{hits});
        if(!vectorHits.length)warnings.push('Indeks wektorowy jeszcze nie zawiera opublikowanych materiałów. Użyto toru tekstowego.');
      }catch{warnings.push('Indeks wektorowy niedostępny. Działa wyszukiwanie tekstowe.');}
    }else if(embedded.status==='rejected'){uncertainProviderCharge=true;warnings.push('Embedding niedostępny. Działa wyszukiwanie tekstowe.');}
  }
  const snapshot:any=vectorHits.length?await ctx.runQuery(internal.search.publicCandidates,{description,ids:vectorHits.map(hit=>hit.id),chunkIds}):base;
  const actualMode=requestedMode==='vector'&&!vectorHits.length?'lexical':requestedMode==='hybrid'&&!vectorHits.length?'lexical':requestedMode;
  // Public callers cannot award themselves expert verification or partner consent.
  const resources=Object.fromEntries(Object.entries(args.resources??{}).map(([key,raw]:[string,any])=>[key,raw&&typeof raw==='object'?{...raw,basis:'declaration',partnerConfirmed:false}:raw]));
  let result:any=buildMatch(`${description} ${args.audience??''}`,snapshot.records,snapshot.sources,resources,vectorHits,actualMode);
  let explanationOrigin='rules';
  if(budget.allowed&&!args.skipGeneration&&result.innovations.length){
    try{const explained=await explain(description,result.innovations.slice(0,3));usage.push(explained.usage);for(const item of result.innovations){const entry=explained.value.explanations.find((entry:any)=>entry.id===item.id&&entry.version===item.version);if(entry){item.why=entry.why;item.citedFragmentIds=entry.fragmentIds??[];}}explanationOrigin=explained.value.explanations.length?'ai':'rules';}catch{uncertainProviderCharge=true;warnings.push('Uzasadnienia AI niedostępne. Pokazano dopasowanie oparte na źródłach i regułach.');}
  }
  const valid:string[]=await ctx.runQuery(internal.search.verifyCandidates,{candidates:[...result.innovations,...result.information].map(item=>({id:item.id,version:item.version}))});
  const allowed=new Set(valid);
  result.innovations=result.innovations.filter((item:any)=>allowed.has(item.id));
  result.information=result.information.filter((item:any)=>allowed.has(item.id));
  result.question=chooseQuestion(snapshot.records.filter((item:any)=>result.innovations.slice(0,3).some((candidate:any)=>candidate.id===String(item._id))),resources);
  if(!result.innovations.length){result.question=null;result.abstention='Nie mamy teraz potwierdzonej propozycji w opublikowanym korpusie. Zapisz potrzebę i włącz obserwowanie lub skonsultuj ją z ROPS.';}
  if(budget.allowed){
    const total=usage.reduce((sum,item)=>({inputTokens:sum.inputTokens+item.inputTokens,outputTokens:sum.outputTokens+item.outputTokens,costUsd:sum.costUsd+item.costUsd}),{inputTokens:0,outputTokens:0,costUsd:0});
    await ctx.runMutation(internal.search.recordUsage,{...total,costUsd:uncertainProviderCharge?Math.max(total.costUsd,budget.reservation.amount):total.costUsd,model:[...new Set(usage.map(item=>item.model))].join('+')||'rules',operation:uncertainProviderCharge?'matching:estimated_after_failure':'matching',sessionId:args.sessionId,reservation:budget.reservation});
  }
  const finalResult={...result,interpretation,warnings,trace:{corpusVersion:snapshot.corpusVersion,needVersion:1,ruleVersion:RULE_VERSION,promptVersion:PROMPT_VERSION,model:usage.some(item=>item.model===GENERATION_MODEL())?GENERATION_MODEL():'rules',models:[...new Set(usage.map(item=>item.model))],mode:actualMode,requestedMode,explanationOrigin,durationMs:Date.now()-start,costUsd:usage.reduce((sum,item)=>sum+item.costUsd,0),costAccounting:uncertainProviderCharge?'Koszt znanych odpowiedzi; po awarii zachowano pełną rezerwę budżetu do uzgodnienia rachunku dostawcy.':'Szacunek z raportu tokenów i skonfigurowanych stawek.',sourceVersions:snapshot.sources.map((source:any)=>({id:String(source._id),version:source.version})),candidateVersions:result.innovations.map((item:any)=>({id:item.id,version:item.version})),scope:'public:published',createdAt:Date.now(),demo:result.innovations.some((item:any)=>item.demo)}};
  await ctx.runMutation(internal.search.writeCache,{key:cacheKey,result:finalResult});
  if(!args.skipGeneration)await ctx.runMutation(internal.search.persistRun,{result:finalResult});
  return finalResult;
}
export const match=action({args:{description:v.string(),audience:v.optional(v.string()),municipality:v.optional(v.string()),resources:v.optional(v.any()),sessionId:v.string(),token:v.optional(v.string()),mode:v.optional(v.union(v.literal('hybrid'),v.literal('lexical'),v.literal('vector')))},handler:(ctx,args):Promise<any>=>runMatch(ctx,args)});
export const preview=query({args:{description:v.string(),audience:v.optional(v.string()),resources:v.optional(v.any())},handler:async(ctx,args):Promise<any>=>{
  if(args.description.trim().length<8||args.description.length>6000)throw new Error('Opisz potrzebę w 8-6000 znakach.');
  const started=Date.now(),description=stripPrivate(args.description);
  const snapshot:any=await retrieveCandidates(ctx,{description,includeFragments:false});
  const resources=Object.fromEntries(Object.entries(args.resources??{}).map(([key,raw]:[string,any])=>[key,raw&&typeof raw==='object'?{...raw,basis:'declaration',partnerConfirmed:false}:raw]));
  return {...buildMatch(`${description} ${args.audience??''}`,snapshot.records,snapshot.sources,resources,[],'lexical'),interpretation:{problem:description,outcome:'Do uzupełnienia przez autora',audience:args.audience??'',context:'',constraints:[],unknowns:[],origin:'rules'},warnings:[],trace:{corpusVersion:snapshot.corpusVersion,ruleVersion:RULE_VERSION,promptVersion:PROMPT_VERSION,model:'rules',mode:'lexical',requestedMode:'lexical',durationMs:Date.now()-started,costUsd:0,scope:'public:published',createdAt:Date.now()}};
}});

export const queueWatched=internalMutation({args:{corpusVersion:v.number(),changedIds:v.optional(v.array(v.id('knowledge'))),cursor:v.optional(v.string())},handler:async(ctx,args)=>{
  const page=await ctx.db.query('records').withIndex('by_kind',q=>q.eq('kind','need')).paginate({cursor:args.cursor??null,numItems:80});
  const changed=await Promise.all((args.changedIds??[]).map(id=>ctx.db.get(id)));
  const topics=new Set(changed.flatMap(item=>item?.problemTags??[]));
  let count=0;
  for(const need of page.page){
    if(!need.data.watch)continue;
    const matchedIds=(need.data.lastMatch?.innovations??[]).map((item:any)=>item.id);
    const dependencies=(args.changedIds??[]).some(id=>matchedIds.includes(String(id)));
    if(topics.size&&!dependencies&&!concepts(need.data.description??'').some(topic=>topics.has(topic)))continue;
    const matchRevision=Number(need.data.matchRevision??0)+1;
    await ctx.db.patch(need._id,{data:{...need.data,matchRevision,targetCorpusVersion:args.corpusVersion},updatedAt:Date.now()});
    await ctx.scheduler.runAfter(count*200,internal.matching.processWatch,{needId:need._id,needVersion:need.version,matchRevision,corpusVersion:args.corpusVersion,attempt:0});
    count++;
  }
  if(!page.isDone)await ctx.scheduler.runAfter(500,internal.matching.queueWatched,{...args,cursor:page.continueCursor});
  return count;
}});
export const rematchWatched=internalAction({args:{corpusVersion:v.number(),changedIds:v.optional(v.array(v.id('knowledge')))},handler:async(ctx,args):Promise<any>=>ctx.runMutation(internal.matching.queueWatched,args)});
export const watchInput=internalQuery({args:{needId:v.id('records'),needVersion:v.number(),matchRevision:v.number(),corpusVersion:v.number()},handler:async(ctx,args)=>{
  const need=await ctx.db.get(args.needId);
  if(!canCommitWatch(need,args))return null;
  return need;
}});
export const commitWatch=internalMutation({args:{needId:v.id('records'),needVersion:v.number(),matchRevision:v.number(),corpusVersion:v.number(),result:v.any()},handler:async(ctx,args)=>{
  const need=await ctx.db.get(args.needId);
  if(!canCommitWatch(need,args)||!need)return {committed:false,reason:'stale_revision_or_consent'};
  const corpus=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key','corpusVersion')).unique();
  if(Number(corpus?.value??1)!==args.corpusVersion||args.result.trace.corpusVersion!==args.corpusVersion)return {committed:false,reason:'corpus_changed'};
  for(const candidate of [...args.result.innovations,...args.result.information]){const item:any=await ctx.db.get(candidate.id);if(!item||item.version!==candidate.version||item.status!=='published'||item.publishedScope!=='public:published')return {committed:false,reason:'candidate_changed'};for(const id of item.sourceIds){const source:any=await ctx.db.get(id);if(source?.status!=='published'||source.reviewAt<Date.now())return {committed:false,reason:'source_changed'};}}
  const previous=need.data.lastMatch??(await ctx.db.query('matches').withIndex('by_need',q=>q.eq('needId',need._id)).order('desc').first())?.result;
  // Saving or enabling a watch first establishes a baseline, without claiming
  // that the already-visible corpus is new knowledge.
  const change=previous?describeMaterialChange(previous,args.result):null;
  const changeType=change?.type??null;
  await ctx.db.insert('matches',{needId:need._id,ownerId:need.ownerId,needVersion:args.needVersion,matchRevision:args.matchRevision,corpusVersion:args.corpusVersion,result:args.result,createdAt:Date.now()});
  await ctx.db.patch(need._id,{data:{...need.data,lastMatch:args.result,lastMatchedAt:Date.now(),...(change?{lastMatchChange:{...change,createdAt:Date.now()}}:{})},updatedAt:Date.now()});
  let notification=false;
  if(changeType&&!need.data.quiet){
    const key=`${need._id}:${need.version}:${args.corpusVersion}:${changeType}`;
    const duplicate=await ctx.db.query('outbox').withIndex('by_key',q=>q.eq('key',key)).first();
    if(!duplicate){await ctx.db.insert('outbox',{key,kind:'watch_change',payload:{recipientId:need.ownerId,needId:need._id,needVersion:need.version,matchRevision:args.matchRevision,changeType,title:'Nowa wiedza dla obserwowanej potrzeby',message:change!.message,sourceIds:args.result.trace.sourceVersions.map((source:any)=>source.id),corpusVersion:args.corpusVersion},status:'pending',createdAt:Date.now()});notification=true;}
  }
  if(notification)await ctx.scheduler.runAfter(0,(internal as any).jobs.deliverOutbox,{});
  return {committed:true,changeType,notification};
}});
export const processWatch=internalAction({args:{needId:v.id('records'),needVersion:v.number(),matchRevision:v.number(),corpusVersion:v.number(),attempt:v.number()},handler:async(ctx,args):Promise<any>=>{
  const {attempt,...revision}=args;
  const need:any=await ctx.runQuery(internal.matching.watchInput,revision);
  if(!need)return {skipped:true};
  try{
    const persistedResources=Object.fromEntries(Object.entries(need.data.resources??{}).map(([key,raw]:[string,any])=>[key,raw&&typeof raw==='object'?{...raw,confirmedAt:raw.confirmedAt??need.createdAt}:{value:raw,confirmedAt:need.createdAt,basis:'declaration'}]));
    const result=await runMatch(ctx,{description:need.data.description,audience:need.data.group,municipality:need.data.municipality,resources:persistedResources,sessionId:`watch:${need._id}`,skipGeneration:true});
    return await ctx.runMutation(internal.matching.commitWatch,{...revision,result:{...result,trace:{...result.trace,needVersion:args.needVersion,matchRevision:args.matchRevision}}});
  }catch(error){
    if(attempt<2)await ctx.scheduler.runAfter(2000*2**attempt,internal.matching.processWatch,{...args,attempt:attempt+1});
    else await ctx.runMutation(internal.matching.watchFailure,{...revision,message:error instanceof Error?error.message:'Błąd ponownego dopasowania'});
    return {retry:attempt<2};
  }
}});
export const watchFailure=internalMutation({args:{needId:v.id('records'),needVersion:v.number(),matchRevision:v.number(),corpusVersion:v.number(),message:v.string()},handler:async(ctx,args)=>{
  const key=`watch-failed:${args.needId}:${args.matchRevision}`;
  if(await ctx.db.query('outbox').withIndex('by_key',q=>q.eq('key',key)).first())return;
  await ctx.db.insert('outbox',{key,kind:'job_failure',payload:{...args},status:'failed',createdAt:Date.now()});
}});
export const periodicReview=internalAction({args:{},handler:async(ctx):Promise<any>=>{
  const data:any=await ctx.runQuery(internal.search.publicCandidates,{description:'przegląd okresowy'});
  return ctx.runMutation(internal.matching.queueWatched,{corpusVersion:data.corpusVersion});
}});
