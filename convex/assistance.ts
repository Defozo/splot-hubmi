import { mutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { audit, notify, requireRecord, requireRole, syncAccess } from './lib/acl';

// No public directory of residents. A helper must know the author's account address.
export const create = mutation({ args: { authorEmail: v.string(), description: v.string(), group: v.string(), municipality: v.string() }, handler: async (ctx, args) => {
  const helper = await requireRole(ctx, ['admin', 'operator']);
  if (args.description.trim().length < 12 || args.description.length > 5000) throw new ConvexError('Opis powinien mieć od 12 do 5000 znaków.');
  const author = await ctx.db.query('users').withIndex('email', q => q.eq('email', args.authorEmail.trim().toLowerCase())).unique();
  if (!author || author._id === helper.userId) throw new ConvexError('Wskaż istniejące konto autora inne niż konto pomocnika.');
  const now = Date.now();
  const id = await ctx.db.insert('records', { kind:'need', title:args.description.trim().slice(0,90), ownerId:author._id, memberIds:[helper.userId], status:'awaiting_author', version:1, createdAt:now, updatedAt:now,
    data:{description:args.description.trim(), group:args.group, municipality:args.municipality, resources:{}, watch:false, quiet:false, assistance:{helperId:helper.userId, helperName:helper.profile.name, createdAt:now}, authorConfirmed:false, nextStep:'Autor powinien przeczytać i potwierdzić treść w Moich sprawach.'} });
  await syncAccess(ctx, await ctx.db.get(id));
  await audit(ctx, helper.userId, 'assisted_submission_created', id, { authorId:author._id });
  await notify(ctx, author._id, 'Potwierdź treść potrzeby zapisanej z pomocą ROPS', 'Przeczytaj opis w Moich sprawach. Obserwowanie nie zostało włączone.', id);
  return id;
} });

export const confirm = mutation({ args:{ id:v.id('records'), expectedVersion:v.number() }, handler:async (ctx,args) => {
  const {record,userId} = await requireRecord(ctx,args.id);
  if (record.kind !== 'need' || !record.data.assistance || record.ownerId !== userId) throw new ConvexError('Tylko autor może potwierdzić swoją potrzebę.');
  if (record.version !== args.expectedVersion) throw new ConvexError('Treść zmieniła się. Przeczytaj aktualną wersję przed potwierdzeniem.');
  if (record.data.authorConfirmed) return record._id;
  await ctx.db.insert('revisions',{recordId:record._id, version:record.version, title:record.title,status:record.status,data:record.data,actorId:userId,createdAt:Date.now()});
  await ctx.db.patch(record._id,{status:'draft',version:record.version+1,updatedAt:Date.now(),data:{...record.data,authorConfirmed:true,authorConfirmedAt:Date.now(),authorConfirmedBy:userId,nextStep:'Porównaj propozycje lub poproś ROPS o konsultację.'}});
  await audit(ctx,userId,'assisted_submission_confirmed',record._id,{version:record.version});
  await notify(ctx,record.data.assistance.helperId,'Autor potwierdził treść potrzeby',record.title,record._id);
  return record._id;
} });
