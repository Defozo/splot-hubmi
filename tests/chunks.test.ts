import {describe,it,expect} from 'vitest';
import {splitKnowledge} from '../domain/chunks';
import {convexTest} from 'convex-test';
import schema from '../convex/schema';
import {api,internal} from '../convex/_generated/api';
const modules=import.meta.glob('../convex/**/*.ts');
const base={title:'Materiał o relacjach',summary:'Opis syntetyczny',problemTags:['samotnosc']};
describe('Fragmenty dokumentów i przyrostowe indeksowanie',()=>{
 it('preserves page locators and bounds every fragment without silently truncating a long page',()=>{
  const body=`[Strona 1]\n${'Pierwsza strona. '.repeat(200)}\n[Strona 2, niepewny odczyt OCR]\nDruga strona i unikalna końcówka.`;
  const rows=splitKnowledge({...base,body});expect(rows.length).toBeGreaterThan(2);expect(rows.every(row=>row.text.length<=1600)).toBe(true);expect(rows[0].locator).toBe('strona 1, fragment 1');expect(rows.at(-1)?.locator).toBe('strona 2, fragment 1');expect(rows.at(-1)?.text).toContain('unikalna końcówka');
 });
 it('keeps unchanged section hashes when another page changes',()=>{const before=splitKnowledge({...base,body:'[Strona 1]\nStała treść pierwszej strony.\n[Strona 2]\nStara treść drugiej strony.'});const after=splitKnowledge({...base,body:'[Strona 1]\nStała treść pierwszej strony.\n[Strona 2]\nNowa treść drugiej strony.'});expect(before[0].hash).toBe(after[0].hash);expect(before[1].hash).not.toBe(after[1].hash);});
 it('rejects oversize material instead of dropping its tail',()=>expect(()=>splitKnowledge({...base,body:'a'.repeat(160000)})).toThrow('Podziel'));
 it('keeps the fast preview answer and sources while full retrieval supplies citation fragments',async()=>{
  const t=convexTest(schema,modules);const id=await t.run(async ctx=>{const source=await ctx.db.insert('sources',{title:'Źródło testowe',url:'/sources/test',publisher:'Test',retrievedAt:Date.now(),geography:'Demo',rights:'Własne',reviewAt:Date.now()+86400000,hash:'preview',version:1,status:'published',demo:true});const row={...base,title:'Sąsiedzkie rozmowy',summary:'Samotni seniorzy spotykają się z sąsiadami.',body:'[Strona 1]\nRegularne rozmowy sąsiedzkie i kontakt seniorów.',kind:'innovation',tags:['samotnosc'],audienceTags:['seniorzy'],requirements:[],evidenceLevel:'concept',demo:true,sourceIds:[source],stableId:'preview-fragments',searchText:'samotnosc seniorzy sąsiedzkie rozmowy',version:1,status:'published',publishedScope:'public:published',retrievalScope:'public:published:innovation'};const knowledgeId=await ctx.db.insert('knowledge',row);for(const part of splitKnowledge(row))await ctx.db.insert('knowledgeChunks',{...part,knowledgeId,stableId:row.stableId,version:1,sourceIds:[source],publishedScope:'public:published',retrievalScope:'public:published:innovation'});return knowledgeId;});
  const preview:any=await t.query(api.matching.preview,{description:'Samotni seniorzy potrzebują rozmów.'});const full:any=await t.query(internal.search.publicCandidates,{description:'Samotni seniorzy potrzebują rozmów.'});
  expect(preview.innovations.map((row:any)=>row.id)).toContain(id);expect(preview.innovations[0].sources[0].url).toBe('/sources/test');expect(preview.innovations[0].fragments).toHaveLength(0);expect(full.records.find((row:any)=>row._id===id).fragments[0].locator).toBe('strona 1, fragment 1');
 });
 it('reuses verified embeddings for unchanged chunks but stages a new version privately',async()=>{
  const t=convexTest(schema,modules);const data=await t.run(async ctx=>{const source=await ctx.db.insert('sources',{title:'Test',url:'/sources/test',publisher:'Test',retrievedAt:Date.now(),geography:'Demo',rights:'Własne',reviewAt:Date.now()+86400000,hash:'test',version:1,status:'published',demo:true});const common={...base,kind:'report',tags:[],audienceTags:[],requirements:[],evidenceLevel:'concept',demo:true,sourceIds:[source],stableId:'chunks-fixture',body:'[Strona 1]\nStała treść pierwszej strony.\n[Strona 2]\nStara treść drugiej strony.',searchText:'samotnosc'};const first=await ctx.db.insert('knowledge',{...common,version:1,status:'published',publishedScope:'public:published'});const next=await ctx.db.insert('knowledge',{...common,body:common.body.replace('Stara','Nowa'),version:2,status:'indexing',publishedScope:'private:indexing'});return {first,next};});
  const plan:any=await t.mutation(internal.search.stageChunks,{id:data.first,version:1,model:'model-test'});expect(plan.pending).toHaveLength(2);
  await t.mutation(internal.search.storeEmbeddings,{model:'model-test',rows:plan.pending.map((row:any)=>({id:row.id,version:1,vector:Array(1536).fill(.01)}))});
  const next:any=await t.mutation(internal.search.stageChunks,{id:data.next,version:2,model:'model-test'});expect(next.reused).toBe(1);expect(next.pending).toHaveLength(1);
  const chunks=await t.run(ctx=>ctx.db.query('knowledgeChunks').withIndex('by_knowledge',q=>q.eq('knowledgeId',data.next)).collect());expect(chunks.every(chunk=>chunk.publishedScope==='private:indexing')).toBe(true);
  const doc=await t.run(ctx=>ctx.db.get(data.next));expect(doc?.metadata.expectedChunkCount).toBe(2);
  await expect(t.mutation(internal.knowledge.commitPublication,{id:data.next,version:2})).rejects.toThrow();
 });
});
