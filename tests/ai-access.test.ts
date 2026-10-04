import {afterEach,describe,expect,it,vi} from 'vitest';
import {convexTest} from 'convex-test';
import schema from '../convex/schema';
import {api,internal} from '../convex/_generated/api';
const modules=import.meta.glob('../convex/**/*.ts');
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
async function fixture(){
 const t=convexTest(schema,modules);
 const ids=await t.run(async ctx=>{
  const user=await ctx.db.insert('users',{name:'Osoba testowa'});await ctx.db.insert('profiles',{userId:user,name:'Osoba testowa',role:'institution'});
  const source=await ctx.db.insert('sources',{title:'Syntetyczne źródło',url:'/sources/demo-corpus.html',publisher:'Test',retrievedAt:Date.now(),geography:'Demo',rights:'Własne',reviewAt:Date.now()+86400000,hash:'ai-test',version:1,status:'published',demo:true});
  const knowledge=await ctx.db.insert('knowledge',{stableId:'ai-verified',version:1,status:'published',kind:'innovation',title:'Testowy pomysł',summary:'Wsparcie kontaktów sąsiedzkich',body:'Opis syntetyczny',tags:['samotnosc'],problemTags:['samotnosc'],audienceTags:['seniorzy'],sourceIds:[source],requirements:[],evidenceLevel:'concept',demo:true,searchText:'samotnosc',publishedScope:'public:published'});
  const application=await ctx.db.insert('records',{kind:'application',title:'Złożony wniosek',status:'submitted',version:1,ownerId:user,memberIds:[],data:{},createdAt:Date.now(),updatedAt:Date.now()});
  const card=await ctx.db.insert('records',{kind:'card',title:'Zatwierdzona Karta',status:'approved',version:1,ownerId:user,memberIds:[],data:{},createdAt:Date.now(),updatedAt:Date.now()});
  return {user,source,knowledge,application,card};
 });
 return {t,who:t.withIdentity({subject:ids.user}),...ids};
}
describe('Kontrola źródeł asystenta i niezmienności dokumentów',()=>{
 it('rejects withdrawn source before provider context is returned',async()=>{const {t,who,source,knowledge}=await fixture();await t.run(ctx=>ctx.db.patch(source,{status:'withdrawn'}));await expect(who.query(internal.search.assistantContext,{innovationId:knowledge})).rejects.toThrow('Źródło wycofano');});
 it('rejects expired source before cron changes its published status, including cached candidates',async()=>{
  const {t,who,source,knowledge}=await fixture();await t.run(ctx=>ctx.db.patch(source,{reviewAt:Date.now()-1}));
  await expect(who.query(internal.search.assistantContext,{innovationId:knowledge})).rejects.toThrow('aktualnego przeglądu');
  expect(await who.query(internal.search.verifyCandidates,{candidates:[{id:knowledge,version:1}]})).toEqual([]);
  const retrieved=await who.query(internal.search.publicCandidates,{description:'Wsparcie sąsiedzkie dla samotnych osób',ids:[knowledge]});expect(retrieved.records).toEqual([]);
 });
 it('discards generated suggestions when source is withdrawn during inference',async()=>{
  const {t,who,source,knowledge}=await fixture();vi.stubEnv('GROQ_API_KEY','test');
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{await t.run(ctx=>ctx.db.patch(source,{status:'withdrawn'}));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({suggestions:[{field:'goal',text:'Propozycja oparta na wycofanym źródle',sourceIds:[source]}],missing:[]})}}],usage:{prompt_tokens:10,completion_tokens:10}}),{status:200});}));
  const result=await who.action(api.ai.assist,{kind:'middleman',content:'Chcemy rozwinąć lokalne wsparcie kontaktów sąsiedzkich.',innovationId:knowledge});
  expect(result.suggestions).toEqual([]);expect(result.disclaimer).toContain('Źródło wycofano');
 });
 it('blocks generated media for submitted applications and approved cards',async()=>{const {who,application,card}=await fixture();await expect(who.query(internal.search.mediaContext,{recordId:application})).rejects.toThrow('roboczej');await expect(who.query(internal.search.mediaContext,{recordId:card})).rejects.toThrow('roboczej');});
 it('enforces field enum and rejects invented monetary claims even if a provider ignores its schema',async()=>{
  const {who,knowledge}=await fixture();vi.stubEnv('GROQ_API_KEY','test');
  const provider=vi.fn().mockImplementation(async(_url:any,options:any)=>{
   const request=JSON.parse(options.body);expect(request.response_format.json_schema.schema.properties.suggestions.items.properties.field.enum).toContain('timeline');
   expect(request.response_format.json_schema.schema.properties.suggestions.items.properties.field.enum).not.toContain('planDzialan');
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({suggestions:[{field:'adaptations',text:'Koordynator: 30 PLN/h i materiały 5 PLN/osoba.',sourceIds:[]},{field:'planDzialan',text:'Pole spoza kontraktu.',sourceIds:[]},{field:'goal',text:'Propozycja regularnego kontaktu sąsiedzkiego.',sourceIds:[]}],missing:['Stawka 30 PLN do potwierdzenia','Brak uzgodnionego terminu.']})}}],usage:{prompt_tokens:10,completion_tokens:10}}),{status:200});
  });vi.stubGlobal('fetch',provider);
  const result=await who.action(api.ai.assist,{kind:'middleman',content:'Nie znamy stawek kosztów ani budżetu.',innovationId:knowledge});
  expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0].field).toBe('goal');expect(JSON.stringify(result)).not.toContain('30 PLN');expect(result.missing).toContain('Brak uzgodnionego terminu.');expect(result.promptVersion).toBe('editable-grounded-v2');
 });
 it('rechecks immutable document state when registering provider image',async()=>{const {t,who,application}=await fixture();const storageId=await t.run(ctx=>ctx.storage.store(new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'})));await expect(who.mutation(internal.search.registerMedia,{recordId:application,storageId,size:4,model:'test'})).rejects.toThrow('zatwierdzonej');expect(await t.run(ctx=>ctx.db.query('files').collect())).toHaveLength(0);});
});
