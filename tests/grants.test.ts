import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
const modules = import.meta.glob('../convex/**/*.ts');
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', { name: 'Autor' });
    const outsider = await ctx.db.insert('users', { name: 'Inna osoba' });
    for (const id of [userId, outsider]) await ctx.db.insert('profiles', { userId: id, name: 'Demo', role: 'resident' });
    const base = { ownerId: userId, memberIds: [], version: 1, createdAt: Date.now(), updatedAt: Date.now() };
    const ideaId = await ctx.db.insert('records', { ...base, kind: 'idea', title: 'Pomysł', status: 'draft', data: { problem: 'Izolacja', audience: 'Sąsiedzi' } });
    const callId = await ctx.db.insert('records', { ...base, kind: 'call', title: 'Mikrotest', status: 'open', data: { opensAt: Date.now() - 10000, closesAt: Date.now() + 100000, budgetLimitGrosz: 100000, schemaVersion: 1, fields: [{ key: 'goal', label: 'Cel', type: 'text', required: true }], schema: { type: 'object', required: ['goal'], additionalProperties: false, properties: { goal: { type: 'string', minLength: 12 } } } } });
    const id = await ctx.db.insert('records', { ...base, kind: 'application', title: 'Wniosek', status: 'draft', data: { ideaId, callId, values: { goal: 'Wspólne spotkania sąsiadów' }, budgetGrosz: 20000, schemaVersion: 1 } });
    return { userId, outsider, callId, id };
  });
  return { t, ...ids, author: t.withIdentity({ subject: ids.userId }), stranger: t.withIdentity({ subject: ids.outsider }) };
}
describe('Złożenie wniosku', () => {
  it('sprawdza pełny JSON Schema, nie tylko obecność pola', async () => {
    const { t, author, id } = await setup();
    await t.run(async ctx => { const app = (await ctx.db.get(id))!; await ctx.db.patch(id, { data: { ...app.data, values: { goal: 'Krótko' } } }); });
    await expect(author.action((api as any).grants.submit, { id, idempotencyKey: 'invalid' })).rejects.toThrow('Sprawdź formularz');
    expect((await t.run(ctx => ctx.db.get(id)))?.status).toBe('draft');
  });
  it('przyjmuje raz i zachowuje niezmienną migawkę oraz numer', async () => {
    const { t, author, id } = await setup();
    const first: any = await author.action((api as any).grants.submit, { id, idempotencyKey: 'same-request' });
    const repeated: any = await author.action((api as any).grants.submit, { id, idempotencyKey: 'same-request' });
    expect(first.data.receipt).toBe(repeated.data.receipt);
    expect(first.data.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.data.snapshot.values.goal).toBe('Wspólne spotkania sąsiadów');
    expect(await t.run(ctx => ctx.db.query('revisions').collect())).toHaveLength(1);
  });
  it('kontroluje właściciela i odrzuca innego użytkownika', async () => {
    const { stranger, id } = await setup();
    await expect(stranger.action((api as any).grants.submit, { id, idempotencyKey: 'attack' })).rejects.toThrow();
  });
  it('ponownie sprawdza termin na końcu i zachowuje szkic', async () => {
    const { t, author, callId, id } = await setup();
    await t.run(async ctx => { const call = (await ctx.db.get(callId))!; await ctx.db.patch(callId, { data: { ...call.data, closesAt: Date.now() - 1 } }); });
    await expect(author.action((api as any).grants.submit, { id, idempotencyKey: 'late' })).rejects.toThrow('Nabór jest zamknięty');
    expect((await t.run(ctx => ctx.db.get(id)))?.status).toBe('draft');
  });
  it('wykrywa zmianę schematu między walidacją i atomowym zapisem', async () => {
    const { t, author, callId, id } = await setup();
    const original: any = await author.query((internal as any).grantTransactions.validationInput, { id });
    await t.run(async ctx => { const call = (await ctx.db.get(callId))!; await ctx.db.patch(callId, { version: 2, data: { ...call.data, schemaVersion: 2 } }); });
    await expect(author.mutation((internal as any).grantTransactions.finalize, { id, idempotencyKey: 'stale', applicationVersion: 1, callVersion: 1, applicationContent: JSON.stringify({ title: original.application.title, data: original.application.data }), callContent: JSON.stringify(original.call.data), contentHash: 'validated-in-action', schemaHash: 'validated-in-action' })).rejects.toThrow('zmieniły się podczas walidacji');
  });
});
