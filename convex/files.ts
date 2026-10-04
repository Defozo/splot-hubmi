import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { audit, requireRecord } from "./lib/acl";
function mutableRecord(record: any) { if (record.kind === "application" && record.status !== "draft") throw new ConvexError("Załączniki przyjętego wniosku są niezmienne."); }
export const generateUploadUrl = mutation({ args: { recordId: v.id("records") }, handler: async (ctx, args) => { const { record } = await requireRecord(ctx, args.recordId); mutableRecord(record); return ctx.storage.generateUploadUrl(); } });
export const list = query({ args: { recordId: v.id("records") }, handler: async (ctx, args) => { await requireRecord(ctx, args.recordId); return ctx.db.query("files").withIndex("by_record", q => q.eq("recordId", args.recordId)).take(50); } });
export const authorize = internalQuery({ args: { recordId: v.optional(v.id("records")), fileId: v.optional(v.id("files")) }, handler: async (ctx, args) => {
  const file = args.fileId ? await ctx.db.get(args.fileId) : null; const id = file?.recordId || args.recordId;
  if (!id) throw new ConvexError("Nie znaleziono pliku."); const { userId } = await requireRecord(ctx, id); return { userId, recordId: id, file };
} });
export const quarantine = mutation({ args: { recordId: v.id("records"), storageId: v.id("_storage"), name: v.string() }, handler: async (ctx, args) => {
  const { userId, record } = await requireRecord(ctx, args.recordId); mutableRecord(record); const metadata = await ctx.db.system.get(args.storageId);
  if (!metadata || metadata.size > 10 * 1024 * 1024 || !args.name || args.name.length > 200) throw new ConvexError("Plik jest nieprawidłowy lub przekracza 10 MB.");
  const existing = await ctx.db.query("files").withIndex("by_storage", q => q.eq("storageId", args.storageId)).first();
  if (existing) { if (existing.recordId === args.recordId && existing.ownerId === userId) return existing._id; throw new ConvexError("Ten plik jest już przypisany do innego dokumentu."); }
  return ctx.db.insert("files", { ownerId: userId, recordId: args.recordId, storageId: args.storageId, name: args.name.replace(/[\\/\x00-\x1f]/g, "_"), mimeType: (metadata.contentType || "application/octet-stream").split(";")[0], size: metadata.size, status: "quarantined", scan: "pending", createdAt: Date.now() });
} });
export const scanResult = internalMutation({ args: { id: v.id("files"), actorId: v.id("users"), clean: v.boolean(), detail: v.string() }, handler: async (ctx, args) => {
  const { file } = await (async () => { const file = await ctx.db.get(args.id); if (!file || file.ownerId !== args.actorId) throw new ConvexError("Brak dostępu do pliku."); return { file }; })();
  await ctx.db.patch(file._id, { status: args.clean ? "clean" : "rejected", scan: args.detail }); await audit(ctx, args.actorId, "attachment_scan", file._id, { clean: args.clean, scanner: "content-policy-v1" });
} });
export const remove = mutation({ args: { id: v.id("files") }, handler: async (ctx, args) => {
  const file = await ctx.db.get(args.id); if (!file) throw new ConvexError("Nie znaleziono pliku."); const { userId, record } = await requireRecord(ctx, file.recordId); mutableRecord(record);
  if (userId !== file.ownerId) throw new ConvexError("Plik usuwa jego autor."); await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id); await audit(ctx, userId, "attachment_delete", file.recordId);
} });
