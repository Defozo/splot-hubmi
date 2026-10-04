import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { audit, requireUser, syncAccess } from "./lib/acl";

async function deletePrivateRecord(ctx: any, record: any) {
  for (const table of ["revisions", "recordAccess", "files"] as const) {
    const rows = await ctx.db.query(table).withIndex("by_record", (q: any) => q.eq("recordId", record._id)).collect();
    for (const row of rows) { if (table === "files") await ctx.storage.delete(row.storageId); await ctx.db.delete(row._id); }
  }
  const matches = await ctx.db.query("matches").withIndex("by_need", (q: any) => q.eq("needId", record._id)).collect();
  for (const match of matches) await ctx.db.delete(match._id);
  await ctx.db.delete(record._id);
}
/** Explicit request, account remains usable. Submitted records are removed only by this audited erasure path. */
export const eraseMyData = mutation({ args: { confirmation: v.string() }, handler: async (ctx, args) => {
  const { userId, profile } = await requireUser(ctx);
  if (args.confirmation !== "USUŃ MOJE DANE") throw new ConvexError("Aby usunąć prywatne dane, wpisz dokładnie USUŃ MOJE DANE.");
  if (["admin", "operator"].includes(profile.role)) throw new ConvexError("Dane urzędowego konta wymagają przekazania opieki. Ta funkcja usuwa prywatne dane mieszkańca, instytucji lub eksperta.");
  const active = (await ctx.db.query("jobs").withIndex("by_status", q => q.eq("status", "running")).collect()).find(j => j.kind === "privacy_erasure" && j.payload.userId === userId);
  if (active) return { jobId: active._id, status: "running" };
  const jobId = await ctx.db.insert("jobs", { kind: "privacy_erasure", status: "running", attempts: 1, payload: { userId, cutoff: Date.now(), erasedIds: [], count: 0 }, createdAt: Date.now(), updatedAt: Date.now() });
  await audit(ctx, userId, "privacy_erasure_requested", jobId, { scope: "private_workspace_and_derived_files", accountPreserved: true });
  await ctx.scheduler.runAfter(0, internal.privacy.purgeOwned, { jobId });
  return { jobId, status: "running", message: "Usuwanie prywatnych danych zostało zlecone. Konto pozostaje aktywne. Opublikowana wiedza i minimalny dziennik operacji są zachowane; kopie podlegają osobnej retencji operatora." };
} });
export const purgeOwned = internalMutation({ args: { jobId: v.id("jobs") }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId); if (!job || job.kind !== "privacy_erasure" || job.status !== "running") return;
  const rows = await ctx.db.query("records").withIndex("by_owner_kind", q => q.eq("ownerId", job.payload.userId)).filter(q => q.lte(q.field("createdAt"), job.payload.cutoff)).take(50);
  for (const row of rows) await deletePrivateRecord(ctx, row);
  const payload = { ...job.payload, erasedIds: [...job.payload.erasedIds, ...rows.map(r => r._id)], count: job.payload.count + rows.length };
  await ctx.db.patch(job._id, { payload, updatedAt: Date.now() });
  if (rows.length) { await ctx.scheduler.runAfter(0, internal.privacy.purgeOwned, args); return; }
  for (const notification of await ctx.db.query("notifications").withIndex("by_user", q => q.eq("userId", job.payload.userId)).collect()) await ctx.db.delete(notification._id);
  for (const match of await ctx.db.query("matches").withIndex("by_owner", q => q.eq("ownerId", job.payload.userId)).collect()) await ctx.db.delete(match._id);
  for (const usage of await ctx.db.query("aiUsage").withIndex("by_user", q => q.eq("userId", job.payload.userId)).collect()) await ctx.db.patch(usage._id, { userId: undefined, sessionId: "erased-user" });
  await ctx.scheduler.runAfter(0, internal.privacy.purgePrivateKnowledge, { jobId: job._id });
} });
export const purgePrivateKnowledge = internalMutation({ args: { jobId: v.id("jobs"), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId); if (!job || job.kind !== "privacy_erasure" || job.status !== "running") return;
  const page = await ctx.db.query("knowledge").withIndex("by_owner", q => q.eq("ownerId", job.payload.userId)).paginate({ cursor: args.cursor || null, numItems: 20 });
  const candidates = new Set<string>(job.payload.sourceCandidates || []);
  for (const doc of page.page) if (["draft", "review", "indexing"].includes(doc.status) && (doc.createdAt || 0) <= job.payload.cutoff) {
    for (const chunk of await ctx.db.query("knowledgeChunks").withIndex("by_knowledge", q => q.eq("knowledgeId", doc._id)).collect()) await ctx.db.delete(chunk._id);
    for (const sourceId of doc.sourceIds) candidates.add(sourceId);
    if (doc.metadata?.indexJobId) { const indexJobId = ctx.db.normalizeId("jobs", doc.metadata.indexJobId); const indexJob = indexJobId ? await ctx.db.get(indexJobId) : null; if (indexJob?.payload?.knowledgeId === doc._id) await ctx.db.delete(indexJob._id); }
    await ctx.db.delete(doc._id);
  }
  await ctx.db.patch(job._id, { payload: { ...job.payload, sourceCandidates: [...candidates] }, updatedAt: Date.now() });
  if (!page.isDone) { await ctx.scheduler.runAfter(0, internal.privacy.purgePrivateKnowledge, { jobId: job._id, cursor: page.continueCursor }); return; }
  if (candidates.size) await ctx.scheduler.runAfter(0, internal.privacy.purgeOrphanSources, { jobId: job._id });
  else await ctx.scheduler.runAfter(0, internal.privacy.purgeReferences, { jobId: job._id });
} });
export const purgeOrphanSources = internalMutation({ args: { jobId: v.id("jobs"), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId); if (!job || job.kind !== "privacy_erasure" || job.status !== "running") return;
  const candidates = new Set<string>(job.payload.sourceCandidates || []);
  const page = await ctx.db.query("knowledge").paginate({ cursor: args.cursor || null, numItems: 50 });
  for (const doc of page.page) for (const sourceId of doc.sourceIds) candidates.delete(sourceId);
  await ctx.db.patch(job._id, { payload: { ...job.payload, sourceCandidates: [...candidates] }, updatedAt: Date.now() });
  if (!page.isDone && candidates.size) { await ctx.scheduler.runAfter(0, internal.privacy.purgeOrphanSources, { jobId: job._id, cursor: page.continueCursor }); return; }
  for (const candidate of candidates) { const id = ctx.db.normalizeId("sources", candidate); const source = id ? await ctx.db.get(id) : null; if (source && ["draft", "approved"].includes(source.status)) await ctx.db.delete(source._id); }
  await ctx.scheduler.runAfter(0, internal.privacy.purgeReferences, { jobId: job._id });
} });
export const purgeReferences = internalMutation({ args: { jobId: v.id("jobs"), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId); if (!job || job.status !== "running") return;
  const erased = new Set(job.payload.erasedIds), userId = job.payload.userId;
  const page = await ctx.db.query("records").paginate({ cursor: args.cursor || null, numItems: 100 });
  for (const record of page.page) {
    const depends = ["needId", "ideaId", "cardId", "threadId", "pilotId", "recordId", "offerId"].some(key => erased.has(record.data[key]));
    if (depends && ["message", "feedback", "enrollment", "thread"].includes(record.kind)) { await deletePrivateRecord(ctx, record); continue; }
    const memberIds = record.memberIds.filter(id => id !== userId);
    if (depends) {
      const data = { ...record.data, dependencyErased: true, reviewReason: "Usunięto prywatne dane powiązanej sprawy." };
      for (const key of ["cardSnapshot", "sourceSnapshot", "snapshot", "approval", "assigneeId"]) delete data[key];
      await ctx.db.patch(record._id, { memberIds, status: "review_required", data, updatedAt: Date.now() });
    } else if (memberIds.length !== record.memberIds.length) await ctx.db.patch(record._id, { memberIds });
    await syncAccess(ctx, await ctx.db.get(record._id));
  }
  if (!page.isDone) { await ctx.scheduler.runAfter(0, internal.privacy.purgeReferences, { jobId: job._id, cursor: page.continueCursor }); return; }
  await ctx.scheduler.runAfter(0, internal.privacy.purgeTransient, { jobId: job._id, table: "outbox" });
} });
export const purgeTransient = internalMutation({ args: { jobId: v.id("jobs"), table: v.union(v.literal("outbox"), v.literal("meta"), v.literal("files")), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await ctx.db.get(args.jobId); if (!job || job.status !== "running") return;
  const erased = new Set(job.payload.erasedIds); const page = await (ctx.db.query(args.table) as any).paginate({ cursor: args.cursor || null, numItems: 100 });
  for (const row of page.page) {
    if (args.table === "outbox" && (row.payload?.userId === job.payload.userId || row.payload?.recipientId === job.payload.userId || erased.has(row.payload?.needId) || erased.has(row.payload?.recordId))) await ctx.db.delete(row._id);
    // Cache carries sanitized text with public scope. Drop transient copies on an erasure request, then recompute on demand.
    if (args.table === "meta" && (row.key.startsWith("cache:") || row.key.includes(`user:${job.payload.userId}:`))) await ctx.db.delete(row._id);
    if (args.table === "files" && row.ownerId === job.payload.userId) { await ctx.storage.delete(row.storageId); await ctx.db.delete(row._id); }
  }
  if (!page.isDone) { await ctx.scheduler.runAfter(0, internal.privacy.purgeTransient, { ...args, cursor: page.continueCursor }); return; }
  if (args.table !== "files") { await ctx.scheduler.runAfter(0, internal.privacy.purgeTransient, { jobId: job._id, table: args.table === "outbox" ? "meta" : "files" }); return; }
  await ctx.db.patch(job._id, { status: "completed", payload: { userId: job.payload.userId, count: job.payload.count, cutoff: job.payload.cutoff, accountPreserved: true }, updatedAt: Date.now() });
  await audit(ctx, job.payload.userId, "privacy_erasure_completed", job._id, { erasedRecords: job.payload.count, publicKnowledgePreserved: true });
} });
