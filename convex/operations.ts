import { internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { requireRecord, requireRole, isOperator } from './lib/acl';

export const inventory = internalQuery({ args: {}, handler: async ctx => {
  const counts: Record<string, number> = {};
  for (const table of ['users', 'profiles', 'records', 'recordAccess', 'revisions', 'sources', 'knowledge', 'knowledgeChunks', 'matches', 'notifications', 'outbox', 'jobs', 'audit', 'files', 'aiUsage', 'meta'] as const) counts[table] = (await ctx.db.query(table).collect()).length;
  return { project: process.env.APP_PROJECT, environment: process.env.APP_ENV, counts };
} });
export const exportRecord = query({ args: { id: v.id('records') }, handler: async (ctx, { id }) => {
  const { record, profile, userId } = await requireRecord(ctx, id);
  if (record.kind === 'pilot' && record.ownerId !== userId && !isOperator(profile) && profile.role !== 'expert') {
    const data = { ...record.data };
    for (const key of ['cardSnapshot', 'snapshot', 'approvals', 'moderation', 'coordinatorNotes']) delete data[key];
    const { memberIds: _members, ...visible } = record;
    return { format: 'splot-record', formatVersion: 1, exportedAt: Date.now(), demo: process.env.APP_ENV === 'demo', record: { ...visible, data }, revisions: [], sources: [] };
  }
  const revisions = await ctx.db.query('revisions').withIndex('by_record', q => q.eq('recordId', id)).collect();
  const sourceIds = record.data.sourceIds || [];
  const sources = await Promise.all(sourceIds.map((sourceId: any) => ctx.db.get(sourceId)));
  return { format: 'splot-record', formatVersion: 1, exportedAt: Date.now(), demo: process.env.APP_ENV === 'demo', record, revisions, sources };
} });
export const auditFor = query({ args: { id: v.id('records') }, handler: async (ctx, { id }) => {
  await requireRecord(ctx, id);
  return ctx.db.query('audit').withIndex('by_entity', q => q.eq('entityId', id)).order('desc').take(100);
} });
export const health = query({ args: {}, handler: async ctx => ({ application: 'Splot dla HubMI', environment: process.env.APP_ENV, corpusVersion: (await ctx.db.query('meta').withIndex('by_key', q => q.eq('key', 'corpusVersion')).unique())?.value ?? 0, status: 'ok' }) });
