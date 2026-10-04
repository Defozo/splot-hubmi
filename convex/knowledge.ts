import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { audit, currentUser, hasPermission, requirePermission } from "./lib/acl";
import { contentHash } from "../domain/rules";
import { paginationOptsValidator } from "convex/server";
import { validateIndicators } from "../domain/indicators";

async function bumpCorpus(ctx: any, id: any) {
  const row = await ctx.db.query("meta").withIndex("by_key", (q: any) => q.eq("key", "corpusVersion")).unique();
  const value = (row?.value || 0) + 1;
  if (row) await ctx.db.patch(row._id, { value }); else await ctx.db.insert("meta", { key: "corpusVersion", value });
  await ctx.scheduler.runAfter(300, internal.matching.rematchWatched, { corpusVersion: value, changedIds: [id] });
  const current = await ctx.db.get(id);
  const related = current ? await ctx.db.query("knowledge").withIndex("by_stable", (q: any) => q.eq("stableId", current.stableId)).collect() : [];
  for (const relatedId of new Set([id, ...related.map((k: any) => k._id)])) {
    const cards = await ctx.db.query("records").withIndex("by_kind_innovation", (q: any) => q.eq("kind", "card").eq("data.innovationId", relatedId)).collect();
    for (const card of cards) await ctx.db.patch(card._id, { data: { ...card.data, sourceReviewRequired: true, targetCorpusVersion: value }, updatedAt: Date.now() });
  }
  return value;
}
function publicationDate(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d{11,}$/.test(value) ? Number(value) : typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 8640000000000000) throw new ConvexError("Podaj poprawną datę publikacji źródła albo pozostaw ją nieznaną.");
  return parsed;
}
async function sourceFor(ctx: any, input: any, actorId: any) {
  if (input.sourceIds?.length) {
    if (!Array.isArray(input.sourceIds) || input.sourceIds.length > 20) throw new ConvexError("Wybierz od 1 do 20 źródeł.");
    for (const id of input.sourceIds) { if (!ctx.db.normalizeId("sources", id)) throw new ConvexError("Nieprawidłowy identyfikator źródła."); const s = await ctx.db.get(id); if (!s) throw new ConvexError("Nie znaleziono wskazanego źródła."); }
    return input.sourceIds;
  }
  const url = String(input.sourceUrl || "/sources/demo-corpus.html");
  if (!url.startsWith("/") && !/^https:\/\//.test(url)) throw new ConvexError("Źródło musi mieć adres HTTPS lub lokalny odnośnik do materiału demonstracyjnego.");
  const publishedAt = publicationDate(input.publishedAt);
  const hash = contentHash({ body: String(input.body || input.summary), url, title: String(input.sourceTitle || input.title), publisher: String(input.publisher || "Autor demonstracji Splot"), geography: String(input.geography || "Dane demonstracyjne"), rights: String(input.rights || "do weryfikacji"), publishedAt: publishedAt ?? null, period: input.period || "", reviewAt: input.reviewAt || null, locator: String(input.locator || "pełny opis") });
  const versions = await ctx.db.query("sources").withIndex("by_url", (q: any) => q.eq("url", url)).collect();
  const same = versions.find((s: any) => s.hash === hash); if (same) return [same._id];
  const id = await ctx.db.insert("sources", { title: String(input.sourceTitle || input.title), url, publisher: String(input.publisher || "Autor demonstracji Splot"), retrievedAt: Date.now(), ...(publishedAt !== undefined ? { publishedAt } : {}), geography: String(input.geography || "Dane demonstracyjne"), ...(input.period ? { period: String(input.period) } : {}), rights: String(input.rights || "do weryfikacji"), reviewAt: Number(input.reviewAt) || Date.now() + 180 * 86400000, hash, version: versions.length + 1, status: "draft", demo: input.demo !== false, body: String(input.body || input.summary), locator: String(input.locator || "pełny opis") });
  await audit(ctx, actorId, "source_import", id, { hash, url }); return [id];
}
function validate(input: any) {
  if (!input || typeof input.title !== "string" || input.title.trim().length < 3 || typeof input.summary !== "string" || input.summary.trim().length < 10) throw new ConvexError("Materiał wymaga tytułu (3 znaki) i opisu (10 znaków).");
  if (!["innovation", "report", "case", "video", "course", "map"].includes(input.kind || "innovation")) throw new ConvexError("Nieobsługiwany rodzaj wiedzy.");
  if (JSON.stringify(input).length > 200000) throw new ConvexError("Materiał przekracza limit 200 KB.");
  if (input.kind === "map") validateIndicators(input.metadata?.indicators);
  for (const r of input.requirements || []) if (!r.id || !r.key || !r.label || !["eq", "gte", "in", "oneOf"].includes(r.operator) || r.expected === undefined) throw new ConvexError("Warunek wymaga ID, pola, etykiety, operatora i wartości.");
}
async function saveDraft(ctx: any, input: any, userId: any, existing?: any) {
  validate(input);
  const sourceIds = await sourceFor(ctx, input, userId);
  const sources = await Promise.all(sourceIds.map((id: any) => ctx.db.get(id)));
  for (const requirement of input.requirements || []) if (requirement.sourceId && !sourceIds.includes(requirement.sourceId)) throw new ConvexError("Źródło warunku musi należeć do źródeł tego materiału.");
  const stableId = existing?.stableId || String(input.stableId || `knowledge-${contentHash({ title: input.title, at: Date.now() })}`);
  const siblings = await ctx.db.query("knowledge").withIndex("by_stable", (q: any) => q.eq("stableId", stableId)).collect();
  const version = existing && ["draft", "review"].includes(existing.status) ? existing.version : Math.max(0, ...siblings.map((s: any) => s.version)) + 1;
  const now = Date.now();
  const record = { stableId, version, status: "draft", kind: input.kind || "innovation", title: input.title.trim(), summary: input.summary.trim(), body: String(input.body || input.summary), tags: input.tags || [], problemTags: input.problemTags || [], audienceTags: input.audienceTags || [], sourceIds, requirements: (input.requirements || []).map((r: any) => ({ ...r, approved: false, sourceId: r.sourceId || sourceIds[0], sourceVersion: sources.find((s: any) => s._id === (r.sourceId || sourceIds[0]))!.version, responsible: r.responsible || "Do przypisania", reviewAt: r.reviewAt || now + 180 * 86400000 })), evidenceLevel: input.evidenceLevel || "concept", demo: input.demo !== false, searchText: `${input.title} ${input.summary} ${input.body || ""} ${(input.tags || []).join(" ")} ${(input.problemTags || []).join(" ")}`, publishedScope: "private:draft", createdAt: existing?.createdAt || now, updatedAt: now, ownerId: userId, ...(input.metadata ? { metadata: input.metadata } : {}) };
  if (existing && ["draft", "review"].includes(existing.status)) { await ctx.db.replace(existing._id, record); return existing._id; }
  return ctx.db.insert("knowledge", record);
}
export const list = query({ args: { type: v.optional(v.string()), search: v.optional(v.string()), admin: v.optional(v.boolean()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  if (args.admin) await requirePermission(ctx, "knowledge:edit");
  let rows: any[];
  if (args.admin) rows = args.type ? await ctx.db.query("knowledge").withIndex("by_kind", q => q.eq("kind", args.type!)).order("desc").take(150) : await ctx.db.query("knowledge").order("desc").take(150);
  else if (args.search?.trim()) rows = await ctx.db.query("knowledge").withSearchIndex("search_knowledge", q => { const base = q.search("searchText", args.search!.trim().split(/\s+/).slice(0, 16).join(" ")).eq("publishedScope", "public:published"); return args.type ? base.eq("kind", args.type) : base; }).take(Math.min(args.limit || 60, 100));
  else rows = await ctx.db.query("knowledge").withIndex("by_scope_kind", q => { const base = q.eq("publishedScope", "public:published"); return args.type ? base.eq("kind", args.type) : base; }).take(Math.min(args.limit || 60, 100));
  const result = [];
  for (const row of rows) {
    if (args.type && row.kind !== args.type) continue;
    const sources = await Promise.all(row.sourceIds.map((id: any) => ctx.db.get(id)));
    if (!args.admin && (row.status !== "published" || sources.some(s => !s || s.status !== "published" || s.reviewAt < Date.now()))) continue;
    const { embedding: _embedding, ...record } = row; result.push({ ...record, sources });
  }
  return result;
} });
export const page = query({ args: { type: v.optional(v.string()), search: v.optional(v.string()), admin: v.optional(v.boolean()), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  if (args.admin) await requirePermission(ctx, "knowledge:edit");
  let result;
  if (args.search?.trim()) result = await ctx.db.query("knowledge").withSearchIndex("search_knowledge", q => {
    let base = q.search("searchText", args.search!.trim().split(/\s+/).slice(0, 16).join(" "));
    if (!args.admin) base = base.eq("publishedScope", "public:published");
    return args.type ? base.eq("kind", args.type) : base;
  }).paginate(args.paginationOpts);
  else if (args.admin) result = args.type ? await ctx.db.query("knowledge").withIndex("by_kind", q => q.eq("kind", args.type!)).order("desc").paginate(args.paginationOpts) : await ctx.db.query("knowledge").order("desc").paginate(args.paginationOpts);
  else result = await ctx.db.query("knowledge").withIndex("by_scope_kind", q => { const base = q.eq("publishedScope", "public:published"); return args.type ? base.eq("kind", args.type) : base; }).paginate(args.paginationOpts);
  const page: any[] = [];
  for (const row of result.page) {
    const sources = await Promise.all(row.sourceIds.map(id => ctx.db.get(id)));
    if (!args.admin && (row.status !== "published" || sources.some(s => !s || s.status !== "published" || s.reviewAt < Date.now()))) continue;
    const { embedding: _embedding, ...record } = row; page.push({ ...record, sources });
  }
  return { ...result, page, hasMore: !result.isDone };
} });
export const get = query({ args: { id: v.id("knowledge") }, handler: async (ctx, { id }) => {
  const row = await ctx.db.get(id); if (!row) throw new ConvexError("Nie znaleziono materiału.");
  const who = await currentUser(ctx), sources = await Promise.all(row.sourceIds.map(id => ctx.db.get(id)));
  if ((row.status !== "published" || sources.some(s => !s || s.status !== "published" || s.reviewAt < Date.now())) && !(who && hasPermission(who.profile, "knowledge:edit"))) throw new ConvexError("Materiał nie jest dostępny publicznie.");
  const { embedding: _embedding, ...record } = row; return { ...record, sources };
} });
export const indicators = query({ args: {}, handler: async ctx => {
  const documents = await ctx.db.query("knowledge").withIndex("by_scope_kind", q => q.eq("publishedScope", "public:published").eq("kind", "map")).take(101);
  const rows: any[] = [];
  for (const doc of documents.slice(0, 100)) {
    if (doc.status !== "published") continue;
    const sources = await Promise.all(doc.sourceIds.map(id => ctx.db.get(id)));
    if (!sources.length || sources.some(source => !source || source.status !== "published" || source.reviewAt < Date.now())) continue;
    let indicators; try { indicators = validateIndicators(doc.metadata?.indicators); } catch { continue; }
    rows.push(...indicators.map((indicator, ordinal) => ({ ...indicator, id: `${doc._id}:${ordinal}`, knowledgeId: doc._id, version: doc.version, demo: doc.demo, sources: sources.map(source => ({ id: source!._id, title: source!.title, url: source!.url, version: source!.version, publisher: source!.publisher })) })));
  }
  return { rows, truncated: documents.length > 100, recordLimit: 100 };
} });
export const save = mutation({ args: { id: v.optional(v.id("knowledge")), data: v.any() }, handler: async (ctx, args) => {
  const { userId } = await requirePermission(ctx, "knowledge:edit"); const old = args.id ? await ctx.db.get(args.id) : undefined;
  const input = { ...(old || {}), ...args.data };
  // Source metadata belongs to an immutable source version, not the knowledge body.
  // A correction creates a new source and only repoints this draft's conditions.
  if (old?.sourceIds.length === 1 && input.sourceIds?.length === 1 && input.sourceIds[0] === old.sourceIds[0]) {
    const previous = await ctx.db.get(old.sourceIds[0]);
    if (previous) {
      const mapping: Record<string, string> = { sourceUrl: "url", sourceTitle: "title", publisher: "publisher", geography: "geography", rights: "rights", period: "period", locator: "locator", reviewAt: "reviewAt", publishedAt: "publishedAt" };
      const changed = Object.entries(mapping).some(([field, sourceField]) => args.data[field] !== undefined && args.data[field] !== (previous as any)[sourceField]);
      if (changed) {
        const metadata: any = { ...previous, sourceUrl: previous.url, sourceTitle: previous.title, sourceIds: undefined };
        for (const [field] of Object.entries(mapping)) if (args.data[field] !== undefined) metadata[field] = args.data[field];
        input.sourceIds = await sourceFor(ctx, metadata, userId);
        input.requirements = (input.requirements || []).map((requirement: any) => ({ ...requirement, ...(requirement.sourceId === previous._id ? { sourceId: input.sourceIds[0] } : {}) }));
      }
    }
  }
  const id = await saveDraft(ctx, input, userId, old); await audit(ctx, userId, "knowledge_edit", id); return id;
} });
export const transition = mutation({ args: { id: v.id("knowledge"), action: v.string() }, handler: async (ctx, args) => {
  const { userId } = await requirePermission(ctx, "knowledge:edit"); const row = await ctx.db.get(args.id); if (!row) throw new ConvexError("Nie znaleziono materiału.");
  if (args.action === "review") {
    if (row.status !== "draft") throw new ConvexError("Do weryfikacji przekazuje się szkic.");
    await ctx.db.patch(row._id, { status: "review", publishedScope: "private:review", reviewedBy: userId, updatedAt: Date.now() });
  } else if (args.action === "publish" || args.action === "restore" || args.action === "retry_index") {
    if (args.action === "publish" && row.status !== "review") throw new ConvexError("Przed publikacją przekaż materiał do weryfikacji.");
    if (args.action === "restore" && !["withdrawn", "superseded"].includes(row.status)) throw new ConvexError("Przywrócić można wycofaną wersję.");
    if (args.action === "retry_index" && row.status !== "indexing") throw new ConvexError("Ponowić można oczekujące indeksowanie.");
    for (const id of row.sourceIds) { const s = await ctx.db.get(id); if (!s || !s.rights || /do weryfikacji|nieznane/i.test(s.rights)) throw new ConvexError("Przed publikacją wyjaśnij prawa do źródła."); if (s.reviewAt < Date.now()) throw new ConvexError("Źródło wymaga aktualnego przeglądu. Zapisz nową wersję z terminem przeglądu."); if (s.status === "withdrawn") throw new ConvexError("Źródło zostało wycofane. Wymaga osobnej, audytowanej decyzji o przywróceniu."); }
    await ctx.db.patch(row._id, { status: "indexing", publishedScope: "private:indexing", retrievalScope: "private:indexing", reviewedBy: userId, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.search.indexPublished, { id: row._id, version: row.version });
  } else if (args.action === "withdraw") {
    if (row.status !== "published") throw new ConvexError("Wycofać można opublikowany materiał.");
    await ctx.db.patch(row._id, { status: "withdrawn", publishedScope: "private:withdrawn", retrievalScope: "private:withdrawn", embeddingPublished: false, updatedAt: Date.now() }); await bumpCorpus(ctx, row._id);
    await setChunkScope(ctx, row._id, "private:withdrawn");
  } else throw new ConvexError("Nieobsługiwana decyzja redakcyjna.");
  await audit(ctx, userId, `knowledge_${args.action}`, row._id, { version: row.version }); return row._id;
} });
async function setChunkScope(ctx: any, knowledgeId: any, scope: string) {
  const chunks = await ctx.db.query("knowledgeChunks").withIndex("by_knowledge", (q: any) => q.eq("knowledgeId", knowledgeId)).collect();
  for (const chunk of chunks) await ctx.db.patch(chunk._id, { publishedScope: scope.startsWith("public:") ? "public:published" : scope, retrievalScope: scope });
}
export const commitPublication = internalMutation({ args: { id: v.id("knowledge"), version: v.number() }, handler: async (ctx, args) => {
  const row = await ctx.db.get(args.id); if (!row || row.version !== args.version || row.status !== "indexing") return { published: false };
  const reviewer = row.reviewedBy ? await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", row.reviewedBy!)).unique() : null;
  if (!hasPermission(reviewer, "knowledge:edit")) throw new ConvexError("Osoba zatwierdzająca utraciła uprawnienia redakcyjne.");
  const chunks = await ctx.db.query("knowledgeChunks").withIndex("by_knowledge", q => q.eq("knowledgeId", row._id)).collect();
  if (!chunks.length || chunks.length !== row.metadata?.expectedChunkCount || chunks.some((c, index) => c.version !== row.version || c.embedding?.length !== 1536 || !c.embeddingModel) || [...chunks].sort((a, b) => a.ordinal - b.ordinal).some((c, index) => c.ordinal !== index)) throw new ConvexError("Publikacja oczekuje na pełny indeks fragmentów.");
  const sources = await Promise.all(row.sourceIds.map(id => ctx.db.get(id)));
  if (!sources.length || sources.some(s => !s || s.status === "withdrawn" || s.reviewAt < Date.now() || !s.rights || /do weryfikacji|nieznane/i.test(s.rights))) throw new ConvexError("Źródła wymagają ponownego przeglądu przed publikacją.");
  const siblings = await ctx.db.query("knowledge").withIndex("by_stable", q => q.eq("stableId", row.stableId)).collect();
  if (siblings.some(s => s.status === "published" && s.version > row.version)) { await ctx.db.patch(row._id, { status: "superseded", publishedScope: "private:superseded", retrievalScope: "private:superseded" }); return { published: false, superseded: true }; }
  for (const sibling of siblings.filter(s => s.status === "published" && s._id !== row._id)) { await ctx.db.patch(sibling._id, { status: "superseded", publishedScope: "private:superseded", retrievalScope: "private:superseded", embeddingPublished: false }); await setChunkScope(ctx, sibling._id, "private:superseded"); }
  for (const source of sources) await ctx.db.patch(source!._id, { status: "published" });
  await setChunkScope(ctx, row._id, `public:published:${row.kind === "innovation" ? "innovation" : "information"}`);
  await ctx.db.patch(row._id, { status: "published", publishedScope: "public:published", retrievalScope: `public:published:${row.kind === "innovation" ? "innovation" : "information"}`, embeddingPublished: true, requirements: row.requirements.map(r => ({ ...r, approved: true, responsible: row.reviewedBy })), updatedAt: Date.now() });
  if (row.metadata?.indexJobId) { const jobId = ctx.db.normalizeId("jobs", row.metadata.indexJobId); const job = jobId ? await ctx.db.get(jobId) : null; if (job && job.kind === "knowledge_index" && job.payload?.knowledgeId === row._id && job.payload?.version === row.version) await ctx.db.patch(job._id, { status: "completed", updatedAt: Date.now(), error: undefined }); }
  await bumpCorpus(ctx, row._id); await audit(ctx, row.reviewedBy, "knowledge_publication_indexed", row._id, { version: row.version, fragments: chunks.length });
  return { published: true, fragments: chunks.length };
} });
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { row.push(field); field = ""; } else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; } else field += c; }
  if (quoted) throw new ConvexError("Nieprawidłowy CSV: niedomknięty cudzysłów.");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || []; return rows.filter(r => r.some(Boolean)).map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] || ""])));
}
export const importData = mutation({ args: { text: v.string(), format: v.union(v.literal("json"), v.literal("csv")), sourceUrl: v.optional(v.string()) }, handler: async (ctx, args) => {
  const { userId } = await requirePermission(ctx, "knowledge:edit");
  if (args.text.length > 1000000) throw new ConvexError("Import może zawierać maksymalnie 1 MB tekstu.");
  const hash = contentHash({ text: args.text, sourceUrl: args.sourceUrl || "local" }); const key = `import:${hash}`;
  const existing = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", key)).unique(); if (existing) return { ...existing.value, duplicate: true };
  let rows: any[];
  try { const parsed = args.format === "json" ? JSON.parse(args.text) : parseCsv(args.text); rows = Array.isArray(parsed) ? parsed : parsed.records; if (!Array.isArray(rows) || rows.length > 100 || !rows.length) throw new Error("Import wymaga od 1 do 100 rekordów.");
    rows = rows.map(r => ({ ...r, ...(args.sourceUrl ? { sourceUrl: args.sourceUrl } : {}), tags: typeof r.tags === "string" ? r.tags.split("|") : r.tags || [], problemTags: typeof r.problemTags === "string" ? r.problemTags.split("|") : r.problemTags || [], audienceTags: typeof r.audienceTags === "string" ? r.audienceTags.split("|") : r.audienceTags || [] })); rows.forEach(validate);
  } catch (error) { await ctx.db.insert("jobs", { kind: "knowledge_import", status: "failed", attempts: 1, payload: { hash }, error: error instanceof Error ? error.message : "Nieprawidłowy format", createdAt: Date.now(), updatedAt: Date.now() }); return { count: 0, ids: [], error: "Import odrzucono. Popraw format i wymagane pola. Opublikowany korpus pozostał bez zmian." }; }
  const ids = []; for (const row of rows) ids.push(await saveDraft(ctx, row, userId));
  const result = { count: ids.length, ids }; await ctx.db.insert("meta", { key, value: result });
  await ctx.db.insert("jobs", { kind: "knowledge_import", status: "completed", attempts: 1, payload: { hash, count: ids.length }, createdAt: Date.now(), updatedAt: Date.now() }); await audit(ctx, userId, "knowledge_import", key, { count: ids.length }); return result;
} });
export const imported = internalMutation({ args: { actorId: v.id("users"), title: v.string(), body: v.string(), url: v.string(), rights: v.string(), metadata: v.optional(v.any()), inputHash: v.optional(v.string()), demo: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const p = await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", args.actorId)).unique(); if (!p || !hasPermission(p, "knowledge:edit")) throw new ConvexError("Utracono uprawnienia do importu.");
  const hash = contentHash({ input: args.inputHash || args.body, url: args.url, rights: args.rights }); const prior = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", `url-import:${hash}`)).unique(); if (prior) return prior.value;
  const id = await saveDraft(ctx, { title: args.title, summary: args.body.slice(0, 500), body: args.body, sourceUrl: args.url, rights: args.rights, kind: "report", demo: args.demo ?? false, ...(args.metadata ? { metadata: args.metadata } : {}), publisher: args.url.startsWith("https://") ? new URL(args.url).hostname : "Materiał przesłany przez redaktora" }, args.actorId); await ctx.db.insert("meta", { key: `url-import:${hash}`, value: id }); return id;
} });
export const withdrawSource = mutation({ args: { sourceId: v.id("sources") }, handler: async (ctx, args) => {
  const { userId } = await requirePermission(ctx, "knowledge:edit");
  const source = await ctx.db.get(args.sourceId); if (!source) throw new ConvexError("Nie znaleziono źródła.");
  if (source.status === "withdrawn") return { status: "withdrawn", duplicate: true };
  // Every public read and model result rechecks source.status, so withdrawal is effective in this transaction.
  await ctx.db.patch(source._id, { status: "withdrawn" });
  const corpus = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "corpusVersion")).unique(); const corpusVersion = Number(corpus?.value || 0) + 1;
  if (corpus) await ctx.db.patch(corpus._id, { value: corpusVersion }); else await ctx.db.insert("meta", { key: "corpusVersion", value: corpusVersion });
  await audit(ctx, userId, "source_withdraw", source._id, { version: source.version, corpusVersion });
  await ctx.scheduler.runAfter(0, internal.knowledge.invalidateSourceBatch, { sourceId: source._id, corpusVersion });
  return { status: "withdrawn", corpusVersion };
} });
export const invalidateSourceBatch = internalMutation({ args: { sourceId: v.id("sources"), corpusVersion: v.number(), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const source = await ctx.db.get(args.sourceId); if (!source || source.status !== "withdrawn") return;
  const page = await ctx.db.query("knowledge").paginate({ cursor: args.cursor || null, numItems: 20 });
  for (const row of page.page) if (row.sourceIds.includes(args.sourceId)) {
    if (["published", "indexing"].includes(row.status)) { await ctx.db.patch(row._id, { status: "withdrawn", publishedScope: "private:withdrawn", retrievalScope: "private:withdrawn", embeddingPublished: false, updatedAt: Date.now() }); await setChunkScope(ctx, row._id, "private:withdrawn"); }
    const cards = await ctx.db.query("records").withIndex("by_kind_innovation", q => q.eq("kind", "card").eq("data.innovationId", row._id)).collect();
    for (const card of cards) await ctx.db.patch(card._id, { data: { ...card.data, sourceReviewRequired: true, targetCorpusVersion: args.corpusVersion }, updatedAt: Date.now() });
  }
  if (!page.isDone) { await ctx.scheduler.runAfter(0, internal.knowledge.invalidateSourceBatch, { ...args, cursor: page.continueCursor }); return; }
  await ctx.scheduler.runAfter(0, internal.matching.rematchWatched, { corpusVersion: args.corpusVersion });
} });
export const restoreSource = mutation({ args: { sourceId: v.id("sources"), reason: v.string() }, handler: async (ctx, args) => {
  const { userId } = await requirePermission(ctx, "knowledge:edit"); const source = await ctx.db.get(args.sourceId);
  if (!source || source.status !== "withdrawn" || args.reason.trim().length < 10) throw new ConvexError("Przywrócenie wycofanego źródła wymaga uzasadnienia (minimum 10 znaków).");
  if (source.reviewAt < Date.now()) throw new ConvexError("Upłynął termin przeglądu źródła. Zaimportuj aktualną wersję.");
  await ctx.db.patch(source._id, { status: "published" }); await audit(ctx, userId, "source_restore", source._id, { reason: args.reason.trim(), version: source.version });
  return { status: "published", nextStep: "Przywróć wybrane wersje materiałów w kolejce redakcyjnej." };
} });

