import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { internal } from '../convex/_generated/api';

const modules = import.meta.glob('../convex/**/*.ts');
async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async ctx => {
    const user = await ctx.db.insert('users', { name: 'Syntetyczna osoba' });
    const source = await ctx.db.insert('sources', { title: 'Źródło demo', url: '/sources/demo-corpus.html', publisher: 'Splot', retrievedAt: Date.now(), geography: 'Demo', rights: 'CC BY 4.0', reviewAt: Date.now() + 86400000, hash: 'test', version: 1, status: 'published', demo: true });
    const knowledge = await ctx.db.insert('knowledge', { stableId: 'new-solution', version: 1, status: 'published', kind: 'innovation', title: 'Nowa propozycja', summary: 'Wsparcie dla sąsiadów', body: 'Syntetyczny opis', tags: ['samotnosc'], problemTags: ['samotnosc'], audienceTags: ['seniorzy'], sourceIds: [source], requirements: [], evidenceLevel: 'concept', demo: true, searchText: 'samotnosc wsparcie', publishedScope: 'public:published' });
    const need = await ctx.db.insert('records', { kind: 'need', title: 'Potrzeba demo', status: 'open', version: 1, ownerId: user, memberIds: [], data: { description: 'Potrzebujemy wsparcia dla samotnych sąsiadów', watch: true, quiet: false, matchRevision: 2, targetCorpusVersion: 3, lastMatch: { innovations: [], information: [] } }, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.insert('meta', { key: 'corpusVersion', value: 3 });
    return { user, source, knowledge, need };
  });
  const result = { innovations: [{ id: data.knowledge, version: 1, title: 'Nowa propozycja', conditions: [], evidenceLevel: 'concept' }], information: [], trace: { corpusVersion: 3, sourceVersions: [{ id: data.source, version: 1 }] } };
  return { t, ...data, result };
}
describe('Transakcje obserwowanych potrzeb', () => {
  it('odrzuca źródło, którego przegląd wygasł po obliczeniu wyniku', async () => {
    const {t,need,source,result}=await fixture();await t.run(ctx=>ctx.db.patch(source,{reviewAt:Date.now()-1}));
    const saved=await t.mutation(internal.matching.commitWatch,{needId:need,needVersion:1,matchRevision:2,corpusVersion:3,result});
    expect(saved).toEqual({committed:false,reason:'source_changed'});
    expect(await t.run(ctx=>ctx.db.query('matches').collect())).toHaveLength(0);
    expect(await t.run(ctx=>ctx.db.query('outbox').collect())).toHaveLength(0);
  });
  it('starsze zadanie kończące się później nie nadpisuje nowszego wyniku ani nie tworzy wiadomości', async () => {
    const { t, need, result } = await fixture();
    const fresh = await t.mutation(internal.matching.commitWatch, { needId: need, needVersion: 1, matchRevision: 2, corpusVersion: 3, result });
    expect(fresh.committed).toBe(true);
    const stale = await t.mutation(internal.matching.commitWatch, { needId: need, needVersion: 1, matchRevision: 1, corpusVersion: 2, result: { ...result, innovations: [], trace: { ...result.trace, corpusVersion: 2 } } });
    expect(stale.committed).toBe(false);
    const state = await t.run(async ctx => ({ need: await ctx.db.get(need), matches: await ctx.db.query('matches').collect(), outbox: await ctx.db.query('outbox').collect() }));
    expect(state.need?.data.lastMatch.innovations).toHaveLength(1);
    expect(state.matches).toHaveLength(1);
    expect(state.outbox).toHaveLength(1);
  });
  it('ponowienie tej samej publikacji nie duplikuje powiadomienia', async () => {
    const { t, need, result } = await fixture();
    const input = { needId: need, needVersion: 1, matchRevision: 2, corpusVersion: 3, result };
    await t.mutation(internal.matching.commitWatch, input);
    await t.mutation(internal.matching.commitWatch, input);
    expect(await t.run(ctx => ctx.db.query('outbox').collect())).toHaveLength(1);
  });
  it('wyłączenie zgody i edycja potrzeby unieważniają oczekujący wynik', async () => {
    const { t, need, result } = await fixture();
    await t.run(async ctx => { const n = (await ctx.db.get(need))!; await ctx.db.patch(need, { version: 2, data: { ...n.data, watch: false } }); });
    const saved = await t.mutation(internal.matching.commitWatch, { needId: need, needVersion: 1, matchRevision: 2, corpusVersion: 3, result });
    expect(saved.committed).toBe(false);
    expect(await t.run(ctx => ctx.db.query('matches').collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query('outbox').collect())).toHaveLength(0);
  });
  it('wycofanie źródła między wyszukaniem i zapisem blokuje nieaktualną rekomendację', async () => {
    const { t, need, source, result } = await fixture();
    await t.run(ctx => ctx.db.patch(source, { status: 'withdrawn' }));
    const saved = await t.mutation(internal.matching.commitWatch, { needId: need, needVersion: 1, matchRevision: 2, corpusVersion: 3, result });
    expect(saved.committed).toBe(false);
    expect(await t.run(ctx => ctx.db.query('outbox').collect())).toHaveLength(0);
  });
  it('cisza pozwala zapisać aktualny wynik bez wysyłania powiadomienia', async () => {
    const { t, need, result } = await fixture();
    await t.run(async ctx => { const n = (await ctx.db.get(need))!; await ctx.db.patch(need, { data: { ...n.data, quiet: true } }); });
    const saved = await t.mutation(internal.matching.commitWatch, { needId: need, needVersion: 1, matchRevision: 2, corpusVersion: 3, result });
    expect(saved.committed).toBe(true);
    expect(await t.run(ctx => ctx.db.query('outbox').collect())).toHaveLength(0);
  });
});
