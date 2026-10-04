/** Internal, demo-only load fixtures. Prefix isolation prevents touching application records. */
import {internalMutation,internalQuery} from './_generated/server';
import {v} from 'convex/values';
const PREFIX='__splot_load_20261003__';
function guard(){if(process.env.APP_ENV!=='demo'||process.env.APP_PROJECT!=='splot-hubmi')throw new Error('Test obciążenia wymaga wydzielonego projektu demonstracyjnego.');}
export const addLoadBatch=internalMutation({args:{offset:v.number(),count:v.number()},handler:async(ctx,args)=>{
 guard();if(!Number.isInteger(args.offset)||args.offset<0||!Number.isInteger(args.count)||args.count<1||args.count>100||args.offset+args.count>10000)throw new Error('Nieprawidłowa partia obciążenia.');
 const sources=await ctx.db.query('sources').withIndex('by_url',q=>q.eq('url','/sources/load-fixture')).collect();
 let source=sources[0]?._id;
 if(!source)source=await ctx.db.insert('sources',{title:'Tymczasowy korpus testu obciążenia',url:'/sources/load-fixture',publisher:'Automatyczny test Splot',retrievedAt:Date.now(),geography:'Syntetyczne dane obciążeniowe',rights:'Własna generacja testowa',reviewAt:Date.now()+86400000,hash:PREFIX,version:1,status:'published',demo:true,body:'Techniczne wypełnienie indeksu. Wektory są deterministyczne i syntetyczne, nie służą ocenie jakości semantycznej.'});
 let added=0;
 for(let i=args.offset;i<args.offset+args.count;i++){
  const stableId=PREFIX+String(i).padStart(5,'0');
  if(await ctx.db.query('knowledge').withIndex('by_stable',q=>q.eq('stableId',stableId)).first())continue;
  const embedding=Array(1536).fill(0);for(let j=0;j<24;j++)embedding[(i*31+j*61)%1536]=1/Math.sqrt(24);
  const kind=i%2?'report':'innovation',text=`Techniczny materiał obciążeniowy ${i}. Syntetyczny opis do pomiaru czasu odczytu indeksu, nie propozycja usługi społecznej.`;
  const knowledgeId=await ctx.db.insert('knowledge',{stableId,version:1,status:'published',kind,title:`Materiał obciążeniowy ${i}`,summary:text,body:text,tags:['load-fixture'],problemTags:['load-fixture'],audienceTags:[],sourceIds:[source],requirements:[],evidenceLevel:'concept',demo:true,searchText:text,embedding,embeddingPublished:true,publishedScope:'public:published',retrievalScope:`public:published:${kind==='innovation'?'innovation':'information'}`,metadata:{loadTest:PREFIX,embedding:'synthetic-sparse-1536'},createdAt:Date.now(),updatedAt:Date.now()});
  await ctx.db.insert('knowledgeChunks',{knowledgeId,stableId,version:1,ordinal:0,locator:'syntetyczny fragment obciążeniowy',text,hash:stableId,sourceIds:[source],searchText:text,embedding,embeddingModel:'synthetic-sparse-1536',publishedScope:'public:published',retrievalScope:`public:published:${kind==='innovation'?'innovation':'information'}`});added++;
 }
 return {added};
}});
export const removeLoadBatch=internalMutation({args:{},handler:async(ctx)=>{
 guard();const rows=await ctx.db.query('knowledge').withIndex('by_stable',q=>q.gte('stableId',PREFIX).lt('stableId',PREFIX+'\uffff')).take(100);
 for(const row of rows){if(!row.stableId.startsWith(PREFIX)||row.metadata?.loadTest!==PREFIX)throw new Error('Niezgodny identyfikator testowy.');const chunks=await ctx.db.query('knowledgeChunks').withIndex('by_knowledge',q=>q.eq('knowledgeId',row._id)).collect();for(const chunk of chunks)await ctx.db.delete(chunk._id);await ctx.db.delete(row._id);}
 if(!rows.length){const sources=await ctx.db.query('sources').withIndex('by_url',q=>q.eq('url','/sources/load-fixture')).collect();for(const source of sources)if(source.hash===PREFIX)await ctx.db.delete(source._id);}
 return {removed:rows.length};
}});
export const corpusStats=internalQuery({args:{},handler:async(ctx)=>{
 guard();const marker=await ctx.db.query('meta').withIndex('by_key',q=>q.eq('key','corpusVersion')).unique();const first=await ctx.db.query('knowledge').withIndex('by_stable',q=>q.gte('stableId',PREFIX).lt('stableId',PREFIX+'\uffff')).first();return {corpusVersion:marker?.value??0,fixturePresent:!!first};
}});
