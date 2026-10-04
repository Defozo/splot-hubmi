import { internalMutation, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { audit, notify, operators, requireRecord } from './lib/acl';
import { assertCallOpen, validateCallFields } from '../domain/rules';

export const validationInput = internalQuery({ args: { id: v.id('records') }, handler: async (ctx, { id }) => {
  const { record: application, userId } = await requireRecord(ctx, id);
  if (application.kind !== 'application' || application.ownerId !== userId) throw new ConvexError('Wniosek składa jego autor.');
  const call = await ctx.db.get(application.data.callId) as any;
  if (!call || call.kind !== 'call') throw new ConvexError('Nie znaleziono naboru.');
  return { application, call };
} });
export const finalize = internalMutation({ args: {
  id: v.id('records'), idempotencyKey: v.string(), applicationVersion: v.number(), callVersion: v.number(),
  applicationContent: v.string(), callContent: v.string(), contentHash: v.string(), schemaHash: v.string(),
}, handler: async (ctx, args) => {
  const { record: application, userId } = await requireRecord(ctx, args.id);
  if (application.kind !== 'application' || application.ownerId !== userId) throw new ConvexError('Wniosek składa jego autor.');
  if (application.status === 'submitted' && application.data.idempotencyKey === args.idempotencyKey) return application;
  if (application.status !== 'draft') throw new ConvexError('Ta wersja wniosku została już przyjęta.');
  if (!args.idempotencyKey || args.idempotencyKey.length > 120) throw new ConvexError('Nieprawidłowy klucz potwierdzenia.');
  const call = await ctx.db.get(application.data.callId) as any;
  const idea = await ctx.db.get(application.data.ideaId) as any;
  if (!call || call.kind !== 'call' || !idea || idea.kind !== 'idea' || idea.ownerId !== userId) throw new ConvexError('Wybierz własną fiszkę i prawidłowy nabór.');
  if (application.version !== args.applicationVersion || call.version !== args.callVersion || JSON.stringify({ title: application.title, data: application.data }) !== args.applicationContent || JSON.stringify(call.data) !== args.callContent) throw new ConvexError('Treść lub formularz zmieniły się podczas walidacji. Sprawdź nową wersję i złóż ponownie.');
  assertCallOpen(call, Date.now(), application.data.schemaVersion, application.data.budgetGrosz);
  validateCallFields(call.data.fields || [], application.data.values);
  const files = await ctx.db.query('files').withIndex('by_record', q => q.eq('recordId', application._id)).collect();
  for (const required of call.data.attachments || []) {
    const name = typeof required === 'string' ? required : required.name;
    if ((typeof required === 'string' || required.required) && !files.some(file => file.name === name && file.status === 'clean')) throw new ConvexError(`Brakuje sprawdzonego załącznika: ${name}.`);
  }
  const submittedAt = Date.now();
  const receipt = `HUBMI-${new Date(submittedAt).getUTCFullYear()}-${application._id.slice(-8).toUpperCase()}`;
  const data = { ...application.data, idempotencyKey: args.idempotencyKey, submittedAt, receipt,
    contentHash: args.contentHash, schemaHash: args.schemaHash, integrationStatus: 'accepted_in_hubmi',
    snapshot: { title: application.title, values: application.data.values, budgetGrosz: application.data.budgetGrosz,
      ideaId: idea._id, ideaVersion: idea.version, schemaVersion: call.data.schemaVersion, schema: call.data.schema || null,
      fields: call.data.fields, callTitle: call.title, attachments: files.filter(file => file.status === 'clean').map(file => ({ id: file._id, name: file.name, storageId: file.storageId })), demo: true },
  };
  await ctx.db.insert('revisions', { recordId: application._id, version: application.version, data: application.data, title: application.title, status: application.status, actorId: userId, createdAt: submittedAt });
  await ctx.db.patch(application._id, { status: 'submitted', data, updatedAt: submittedAt });
  await audit(ctx, userId, 'application_submitted', application._id, { receipt, schemaHash: args.schemaHash, contentHash: args.contentHash });
  for (const staff of await operators(ctx)) await notify(ctx, staff.userId, 'Przyjęto wniosek', `${application.title}, numer ${receipt}`, application._id, `application:${application._id}:submitted:${staff.userId}`);
  return ctx.db.get(application._id);
} });
