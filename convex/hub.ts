import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { audit, canAccess, currentUser, isOperator, notify, operators, requireRecord, requireRole, requirePermission, requireUser, syncAccess } from "./lib/acl";
import { paginationOptsValidator } from "convex/server";
import { assertReservation, contentHash, moneyTotal } from "../domain/rules";

const fields: Record<string, string[]> = {
  need: ["description", "group", "municipality", "resources", "watch", "quiet", "interpretation", "classification"],
  idea: ["problem", "audience", "stage", "context", "resources", "trials", "canvas", "publicConsent", "description", "kind", "fieldOrigins"],
  call: ["opensAt", "closesAt", "budgetLimitGrosz", "schemaVersion", "fields", "criteria", "description", "schema", "uiSchema", "attachments", "limits"],
  application: ["callId", "ideaId", "values", "budgetGrosz", "schemaVersion"],
  card: ["needId", "innovationId", "goal", "audience", "mechanism", "adaptations", "resources", "budgetItems", "risks", "accessibility", "metrics", "timeline", "technicalChange", "assumptions", "alternatives", "provenance", "fieldOrigins"],
  offer: ["resourceKey", "capacity", "validUntil", "territory", "conditions", "description", "startsAt", "confirmedAt"],
  partnership: ["offerId", "cardId", "scope", "startsAt", "endsAt", "quantity", "sharedStage", "costShareGrosz"],
  pilot: ["cardId", "capacity", "startsAt", "endsAt", "criteria", "tasks", "metrics", "description"],
  enrollment: ["pilotId", "consent", "motivation"],
  feedback: ["pilotId", "rating", "barrier", "improvement", "completedTask", "before", "after", "measurementType"],
  thread: ["recordId", "description", "participantIds"],
  message: ["threadId", "body"],
  call_watch: ["callId", "quiet"],
};
function clean(kind: string, input: any) {
  if (!fields[kind]) throw new ConvexError("Nieobsługiwany rodzaj rekordu.");
  const output: any = {};
  for (const field of fields[kind]) if (input[field] !== undefined) output[field] = input[field];
  if (JSON.stringify(output).length > 100000) throw new ConvexError("Dokument przekracza limit 100 KB.");
  return output;
}
function publicRecord(record: any) {
  return (record.kind === "call" && ["open", "scheduled", "closed"].includes(record.status)) || (record.kind === "pilot" && ["recruiting", "running", "completed", "reviewed"].includes(record.status)) || (record.kind === "offer" && record.status === "active");
}
function publicView(record: any) {
  const { memberIds: _members, ...result } = record;
  const data = { ...record.data };
  delete data.approvals; delete data.snapshot; delete data.moderation; delete data.coordinatorNotes; delete data.cardSnapshot;
  return { ...result, data, demo: true };
}
function fullPilotAccess(record: any, who: any) { return who && (record.ownerId === who.userId || isOperator(who.profile) || (who.profile.role === "expert" && record.memberIds.includes(who.userId))); }
async function currentCardSources(ctx: any, data: any, validThrough = Date.now(), allowPendingReview = false) {
  if (data.sourceReviewRequired && !allowPendingReview) throw new ConvexError("Źródła Karty wymagają świadomego przeglądu opiekuna. Otwórz przegląd źródeł przed ponowną akceptacją.");
  const innovation = data.innovationId ? await ctx.db.get(data.innovationId) : null;
  if (!innovation || innovation.kind !== "innovation" || innovation.status !== "published" || innovation.publishedScope !== "public:published" || (data.innovationVersion !== undefined && innovation.version !== data.innovationVersion)) throw new ConvexError("Przypięta innowacja nie jest aktualną publikacją. Utwórz nową Kartę z aktualnej innowacji w bibliotece; wcześniejszy plan pozostaje zachowany.");
  if (!innovation.sourceIds.length || (data.sourceIds && contentHash([...data.sourceIds].sort()) !== contentHash([...innovation.sourceIds].sort()))) throw new ConvexError("Źródła przypiętej Karty są niepełne. Utwórz nową Kartę z aktualnej innowacji w bibliotece.");
  for (const id of innovation.sourceIds) {
    const source = await ctx.db.get(id);
    if (!source || source.status !== "published" || source.reviewAt < validThrough) throw new ConvexError("Źródło Karty zostało wycofane albo wymaga aktualnego przeglądu na cały okres pilotażu. Skontaktuj się z redaktorem, a po publikacji aktualnego materiału utwórz nową Kartę.");
  }
  return innovation;
}
async function revision(ctx: any, record: any, userId: any) {
  await ctx.db.insert("revisions", { recordId: record._id, version: record.version, title: record.title, status: record.status, data: record.data, actorId: userId, createdAt: Date.now() });
}
async function change(ctx: any, record: any, userId: any, patch: any, action: string) {
  await revision(ctx, record, userId);
  await ctx.db.patch(record._id, { ...patch, updatedAt: Date.now() });
  await audit(ctx, userId, action, record._id, { from: record.status, to: patch.status || record.status, version: patch.version || record.version });
  return await ctx.db.get(record._id);
}
async function notifyStaff(ctx: any, title: string, body: string, id: any) {
  for (const staff of await operators(ctx)) await notify(ctx, staff.userId, title, body, id);
}
async function invalidateOffer(ctx: any, offer: any, actorId: any, reason: string) {
  const partnerships = await ctx.db.query("records").withIndex("by_kind_offer", (q: any) => q.eq("kind", "partnership").eq("data.offerId", offer._id)).collect();
  for (const p of partnerships.filter((r: any) => r.data.offerId === offer._id && r.status === "accepted")) {
    await ctx.db.patch(p._id, { status: "conflict", updatedAt: Date.now() });
    const card = await ctx.db.get(p.data.cardId);
    if (card) {
      await change(ctx, card, actorId, { status: "review_required", data: { ...card.data, conflict: reason } }, "resource_conflict");
      await notify(ctx, card.ownerId, "Zasób wymaga ponownego uzgodnienia", reason, card._id);
      const pilots = await ctx.db.query("records").withIndex("by_kind_card", (q: any) => q.eq("kind", "pilot").eq("data.cardId", card._id)).collect();
      for (const pilot of pilots.filter((r: any) => r.data.cardId === card._id && ["recruiting", "running"].includes(r.status))) {
        await ctx.db.patch(pilot._id, { status: "blocked", data: { ...pilot.data, blockReason: reason }, updatedAt: Date.now() });
        for (const userId of new Set([pilot.ownerId, ...pilot.memberIds])) await notify(ctx, userId, "Pilotaż wymaga decyzji opiekuna", reason, pilot._id);
      }
    }
  }
}

export const me = query({ args: {}, handler: async ctx => {
  const who = await currentUser(ctx); if (!who) return null;
  const user = await ctx.db.get(who.userId);
  return { userId: who.userId, name: who.profile.name, email: user?.email, role: who.profile.role, organization: who.profile.organization || "", permissions: who.profile.permissions || [] };
} });
export const people = query({ args: {}, handler: async ctx => {
  const { userId } = await requireUser(ctx);
  const groups = await Promise.all(["expert", "operator", "admin", "institution"].map(role => ctx.db.query("profiles").withIndex("by_role", q => q.eq("role", role)).take(25)));
  const self = await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", userId)).unique();
  return [...new Map([...groups.flat(), ...(self ? [self] : [])].map(p => [p._id, p])).values()].map(p => ({ _id: p.userId, name: p.name, role: p.role, organization: p.organization || "" }));
} });
export const list = query({ args: { kind: v.string(), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const who = await currentUser(ctx);
  const limit = Math.min(200, Math.max(1, args.limit || 100));
  let records = await ctx.db.query("records").withIndex("by_kind", q => q.eq("kind", args.kind)).order("desc").take(limit);
  if (who && !isOperator(who.profile)) {
    const owned = await ctx.db.query("records").withIndex("by_owner_kind", q => q.eq("ownerId", who.userId).eq("kind", args.kind)).order("desc").take(limit);
    const access = await ctx.db.query("recordAccess").withIndex("by_user_kind", q => q.eq("userId", who.userId).eq("kind", args.kind)).order("desc").take(limit);
    const assigned = (await Promise.all(access.map(entry => ctx.db.get(entry.recordId)))).filter(Boolean) as typeof records;
    records = [...new Map([...records.filter(publicRecord), ...owned, ...assigned].map(row => [row._id, row])).values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return records.filter(r => publicRecord(r) || (who && canAccess(who.profile, who.userId, r))).map(r => (r.kind === "pilot" && !fullPilotAccess(r, who)) || (publicRecord(r) && !(who && canAccess(who.profile, who.userId, r))) ? publicView(r) : r);
} });
export const page = query({ args: { kind: v.string(), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  const who = await requireUser(ctx);
  if (isOperator(who.profile)) return ctx.db.query("records").withIndex("by_kind", q => q.eq("kind", args.kind)).order("desc").paginate(args.paginationOpts);
  const access = await ctx.db.query("recordAccess").withIndex("by_user_kind", q => q.eq("userId", who.userId).eq("kind", args.kind)).order("desc").paginate(args.paginationOpts);
  const records = (await Promise.all(access.page.map(row => ctx.db.get(row.recordId)))).filter((r): r is NonNullable<typeof r> => !!r && canAccess(who.profile, who.userId, r)).map(r => r.kind === "pilot" && !fullPilotAccess(r, who) ? publicView(r) : r);
  return { ...access, page: records };
} });
export const get = query({ args: { id: v.id("records") }, handler: async (ctx, { id }) => {
  const record = await ctx.db.get(id); if (!record) throw new ConvexError("Nie znaleziono dokumentu.");
  const who = await currentUser(ctx);
  if (record.kind === "pilot" && !fullPilotAccess(record, who) && (publicRecord(record) || (who && canAccess(who.profile, who.userId, record)))) return { ...publicView(record), history: [] };
  if (!who || !canAccess(who.profile, who.userId, record)) {
    if (publicRecord(record)) return { ...publicView(record), history: [] };
    throw new ConvexError("Nie znaleziono obiektu lub brak dostępu.");
  }
  const history = await ctx.db.query("revisions").withIndex("by_record", q => q.eq("recordId", id)).order("desc").take(50);
  return { ...record, history };
} });
export const save = mutation({ args: { kind: v.string(), id: v.optional(v.id("records")), title: v.string(), data: v.any(), expectedVersion: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { userId, profile } = await requireUser(ctx);
  if (!args.title.trim() || args.title.length > 250) throw new ConvexError("Podaj tytuł od 1 do 250 znaków.");
  const existing = args.id ? (await requireRecord(ctx, args.id)).record : null;
  if (existing && existing.kind !== args.kind) throw new ConvexError("Rodzaj dokumentu nie może się zmienić.");
  if (existing?.kind === "card" && args.expectedVersion === undefined) throw new ConvexError("Zapis Karty wymaga numeru odczytanej wersji. Wczytaj dokument ponownie.");
  if (existing && args.expectedVersion !== undefined && existing.version !== args.expectedVersion) throw new ConvexError("Dokument został zmieniony w innej sesji. Odśwież go przed zapisem.");
  if (existing && existing.ownerId !== userId && !isOperator(profile)) throw new ConvexError("Tylko autor lub opiekun może edytować dokument.");
  if (existing && ["application", "feedback", "message", "partnership", "enrollment"].includes(args.kind) && existing.status !== "draft") throw new ConvexError("Przyjęta wersja jest niezmienna.");
  if (existing && args.kind === "card" && ["piloting", "evaluated"].includes(existing.status)) throw new ConvexError("Trwający pilotaż zachowuje przypiętą Kartę. Utwórz nową Kartę do kolejnego testu.");
  const data = { ...(existing?.data || {}), ...clean(args.kind, args.data) };
  if (data.fieldOrigins) data.fieldOrigins = Object.fromEntries(Object.entries(data.fieldOrigins).map(([key, origin]: [string, any]) => [key, { basis: origin?.basis === "ai_proposal" ? "ai_proposal" : "local_declaration", generatedAt: Number(origin?.generatedAt) || Date.now(), model: String(origin?.model || "author").slice(0, 100), sourceIds: Array.isArray(origin?.sourceIds) ? origin.sourceIds.filter((id: any) => typeof id === "string").slice(0, 20) : [] }]));
  let memberIds: any[] = existing?.memberIds || [], status = existing?.status || "draft";
  if (args.kind === "idea") data.canvasTemplateVersion = existing?.data.canvasTemplateVersion || "demo-1";
  if (args.kind === "call") {
    if (!isOperator(profile)) throw new ConvexError("Naborami zarządza operator.");
    if (!Number.isFinite(data.opensAt) || !Number.isFinite(data.closesAt) || data.opensAt >= data.closesAt || !Number.isSafeInteger(data.budgetLimitGrosz) || data.budgetLimitGrosz < 0) throw new ConvexError("Sprawdź terminy i limit naboru.");
    if (!Array.isArray(data.fields) || !data.fields.length) throw new ConvexError("Nabór musi mieć formularz.");
    data.schemaVersion = existing ? existing.data.schemaVersion + 1 : 1;
  }
  if (args.kind === "need") {
    if (typeof data.description !== "string" || data.description.trim().length < 10) throw new ConvexError("Opisz potrzebę w co najmniej 10 znakach.");
    if (existing?.data.assistance) {
      const contentChanged = ['description','group','municipality'].some(key => data[key] !== existing.data[key]);
      if (contentChanged) { data.authorConfirmed = false; delete data.authorConfirmedAt; delete data.authorConfirmedBy; status = 'awaiting_author'; }
      if (!data.authorConfirmed) { data.watch = false; data.nextStep = 'Autor powinien potwierdzić aktualną treść potrzeby.'; }
      if (data.watch && existing.ownerId !== userId) throw new ConvexError('Obserwowanie potrzeby włącza jej autor.');
    }
    data.matchRevision = (existing?.data.matchRevision || 0) + 1;
    data.targetCorpusVersion = (await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "corpusVersion")).unique())?.value || 1;
    data.watch = data.watch === true; data.quiet = data.quiet === true;
    data.nextStep = data.assistance && !data.authorConfirmed ? "Autor powinien potwierdzić aktualną treść potrzeby." : "Porównaj propozycje lub poproś ROPS o konsultację.";
  }
  if (args.kind === "card") {
    if (!existing && !["institution", "operator", "admin"].includes(profile.role)) throw new ConvexError("Kartę wdrożenia przygotowuje instytucja lub opiekun.");
    if (existing && (data.needId !== existing.data.needId || data.innovationId !== existing.data.innovationId)) throw new ConvexError("Karta zachowuje przypiętą potrzebę i innowację. Dla innego źródła utwórz nową Kartę.");
    const need = (await requireRecord(ctx, data.needId)).record;
    if (need.data.assistance && !need.data.authorConfirmed) throw new ConvexError('Autor powinien najpierw potwierdzić treść potrzeby.');
    if (need.kind !== "need") throw new ConvexError("Wybierz dostępną potrzebę.");
    const innovation = await currentCardSources(ctx, data, Date.now(), true);
    if (!existing) { data.needVersion = need.version; data.innovationVersion = innovation.version; data.sourceIds = innovation.sourceIds; data.requirements = innovation.requirements; data.sourceSnapshot = { title: innovation.title, body: innovation.body, requirements: innovation.requirements }; }
    data.resources = Object.fromEntries(Object.entries(data.resources || {}).map(([key, raw]: [string, any]) => [key, raw && typeof raw === "object" ? { value: raw.value, basis: "declaration", confirmedAt: Date.now(), validUntil: Number(raw.validUntil) || Date.now() + 90 * 86400000 } : { value: raw, basis: "declaration", confirmedAt: Date.now(), validUntil: Date.now() + 90 * 86400000 }]));
    data.budget = moneyTotal(data.budgetItems || []); data.approvals = {}; data.expertVerified = false; data.demo = true;
    status = "draft";
  }
  if (args.kind === "application") {
    const idea = (await requireRecord(ctx, data.ideaId)).record;
    const call = await ctx.db.get(data.callId as any) as any;
    if (idea.kind !== "idea" || idea.ownerId !== userId || !call || call.kind !== "call") throw new ConvexError("Wybierz własną fiszkę i istniejący nabór.");
    data.schemaVersion = data.schemaVersion ?? call.data.schemaVersion;
  }
  if (args.kind === "offer") {
    if (!Number.isInteger(data.capacity) || data.capacity < 1 || !Number.isFinite(data.validUntil) || data.validUntil <= Date.now()) throw new ConvexError("Oferta wymaga dodatniej pojemności i przyszłej daty ważności.");
    data.confirmedAt = Date.now(); status = "active";
    if (existing) await invalidateOffer(ctx, existing, userId, "Partner opublikował nową wersję oferty. Potwierdź zakres ponownie.");
  }
  if (args.kind === "partnership") {
    const card = (await requireRecord(ctx, data.cardId)).record;
    const offer = await ctx.db.get(data.offerId as any) as any;
    if (card.kind !== "card" || !offer || offer.kind !== "offer" || offer.status !== "active") throw new ConvexError("Wybierz aktualną ofertę i Kartę wdrożenia.");
    if (offer.ownerId === userId) throw new ConvexError("Własny zasób dodaj do zasobów instytucji. Partnerstwo potwierdza druga strona.");
    if (data.endsAt <= data.startsAt || !Number.isInteger(data.quantity) || data.quantity < 1) throw new ConvexError("Sprawdź termin i zakres zaproszenia.");
    data.offerVersion = offer.version; status = "invited"; memberIds = [...new Set([offer.ownerId, card.ownerId, ...card.memberIds])];
  }
  if (args.kind === "pilot") {
    const card = (await requireRecord(ctx, data.cardId)).record;
    if (card.kind !== "card" || !["approved", "piloting"].includes(card.status)) throw new ConvexError("Pilotaż wymaga Karty zatwierdzonej przez autora i opiekuna.");
    if (!Number.isInteger(data.capacity) || data.capacity < 1 || data.endsAt <= data.startsAt) throw new ConvexError("Sprawdź liczbę miejsc i terminy.");
    if (!existing) { data.cardVersion = card.version; data.cardSnapshot = card.data; status = "proposed"; memberIds = card.memberIds; }
    if (existing && !["proposed", "approved"].includes(existing.status)) throw new ConvexError("Opublikowany pilotaż zachowuje zakres i wersję usługi.");
  }
  if (args.kind === "enrollment") {
    const pilot = await ctx.db.get(data.pilotId as any) as any;
    if (!pilot || pilot.kind !== "pilot" || pilot.status !== "recruiting") throw new ConvexError("Rekrutacja do testu jest zamknięta.");
    if (data.consent !== true) throw new ConvexError("Potwierdź zgodę na udział w demonstracyjnym teście.");
    const prior = (await ctx.db.query("records").withIndex("by_owner_kind", q => q.eq("ownerId", userId).eq("kind", "enrollment")).collect()).find(r => r.data.pilotId === data.pilotId && r.status !== "withdrawn");
    if (prior) return prior._id;
    const assignees = await Promise.all(pilot.memberIds.map((id: any) => ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", id)).unique()));
    memberIds = [pilot.ownerId, ...assignees.filter((p: any) => p && ["expert", "operator", "admin"].includes(p.role)).map((p: any) => p.userId)]; status = "pending"; data.cardVersion = pilot.data.cardVersion;
  }
  if (args.kind === "feedback") {
    const pilot = await ctx.db.get(data.pilotId as any) as any;
    const enrollment = (await ctx.db.query("records").withIndex("by_owner_kind", q => q.eq("ownerId", userId).eq("kind", "enrollment")).collect()).find(r => r.data.pilotId === data.pilotId && r.status === "accepted");
    if (!pilot || !enrollment || !["running", "completed"].includes(pilot.status)) throw new ConvexError("Opinię składa przyjęty uczestnik rozpoczętego testu.");
    if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) throw new ConvexError("Wybierz ocenę od 1 do 5.");
    const assignees = await Promise.all(pilot.memberIds.map((id: any) => ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", id)).unique()));
    data.cardVersion = pilot.data.cardVersion; memberIds = [pilot.ownerId, ...assignees.filter((p: any) => p && ["expert", "operator", "admin"].includes(p.role)).map((p: any) => p.userId)];
  }
  if (args.kind === "thread") {
    if (data.recordId) { const related = (await requireRecord(ctx, data.recordId)).record; memberIds = [...new Set([related.ownerId, ...related.memberIds])]; }
    for (const id of data.participantIds || []) {
      const selected = await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", id)).unique();
      if (!selected || !["expert", "operator", "admin"].includes(selected.role)) throw new ConvexError("Wybierz eksperta lub opiekuna z katalogu konsultacji.");
      memberIds = [...new Set([...memberIds, id])];
    }
    status = "open";
  }
  if (args.kind === "message") {
    const thread = (await requireRecord(ctx, data.threadId)).record;
    if (thread.kind !== "thread" || typeof data.body !== "string" || !data.body.trim() || data.body.length > 10000) throw new ConvexError("Wpisz wiadomość do istniejącego wątku (maksymalnie 10 000 znaków).");
    memberIds = [...new Set([thread.ownerId, ...thread.memberIds])]; status = "sent";
  }
  if (args.kind === "call_watch") {
    const call = await ctx.db.get(data.callId as any) as any;
    if (!call || call.kind !== "call") throw new ConvexError("Nie znaleziono naboru.");
    const prior = (await ctx.db.query("records").withIndex("by_owner_kind", q => q.eq("ownerId", userId).eq("kind", "call_watch")).collect()).find(r => r.data.callId === data.callId);
    if (prior) { await ctx.db.patch(prior._id, { status: "active", data: { ...prior.data, quiet: data.quiet === true }, updatedAt: Date.now() }); return prior._id; }
    status = "active";
  }
  const now = Date.now();
  const id = existing ? existing._id : await ctx.db.insert("records", { kind: args.kind, title: args.title.trim(), data, ownerId: userId, memberIds, status, version: 1, createdAt: now, updatedAt: now });
  if (existing) await change(ctx, existing, userId, { title: args.title.trim(), data, status, memberIds, version: existing.version + 1 }, "edit");
  else await audit(ctx, userId, "create", id, { kind: args.kind });
  await syncAccess(ctx, await ctx.db.get(id));
  if (args.kind === "need" && data.watch) await ctx.scheduler.runAfter(0, internal.matching.processWatch, { needId: id, needVersion: existing ? existing.version + 1 : 1, matchRevision: data.matchRevision, corpusVersion: data.targetCorpusVersion, attempt: 0 });
  if (!existing && ["need", "idea", "thread", "enrollment"].includes(args.kind)) await notifyStaff(ctx, "Nowe zgłoszenie w HubMI", args.title, id);
  if (args.kind === "message") {
    for (const recipient of memberIds.filter(u => u !== userId)) await notify(ctx, recipient, "Nowa odpowiedź w rozmowie", data.body.slice(0, 180), data.threadId);
    if (!isOperator(profile)) await notifyStaff(ctx, "Wiadomość do ROPS", data.body.slice(0, 180), data.threadId);
    await ctx.db.patch(data.threadId as any, { status: isOperator(profile) || profile.role === "expert" ? "answered" : "waiting", updatedAt: now });
  }
  if (args.kind === "partnership") for (const recipient of memberIds.filter(u => u !== userId)) await notify(ctx, recipient, "Zaproszenie do partnerstwa", data.scope || args.title, id);
  if (existing && args.kind === "call") {
    const watches = await ctx.db.query("records").withIndex("by_kind_call", q => q.eq("kind", "call_watch").eq("data.callId", id)).collect();
    for (const watch of watches.filter(w => w.data.callId === id && w.status === "active" && !w.data.quiet)) await notify(ctx, watch.ownerId, "Zmiana zasad naboru", `Formularz naboru ${args.title} ma nową wersję. Sprawdź szkic przed złożeniem.`, id);
  }
  return id;
} });

async function verifyPilotReady(ctx: any, pilot: any, permitNewVersion = false) {
  const card = await ctx.db.get(pilot.data.cardId);
  if (!card || card.status !== "approved" || (!permitNewVersion && card.version !== pilot.data.cardVersion)) throw new ConvexError("Karta pilotażu wymaga ponownego zatwierdzenia.");
  await currentCardSources(ctx, card.data, pilot.data.endsAt);
  const partnerships = await ctx.db.query("records").withIndex("by_kind_card", (q: any) => q.eq("kind", "partnership").eq("data.cardId", card._id)).collect();
  const assigned = partnerships.filter((p: any) => p.data.cardId === card._id && ["accepted", "conflict"].includes(p.status));
  for (const p of assigned) {
    const offer = await ctx.db.get(p.data.offerId);
    if (p.status !== "accepted" || !offer || offer.status !== "active" || offer.version !== p.data.offerVersion || offer.data.validUntil < pilot.data.endsAt || p.data.startsAt > pilot.data.startsAt || p.data.endsAt < pilot.data.endsAt) throw new ConvexError("Rezerwacja nie pokrywa okresu pilotażu lub oferta wymaga potwierdzenia.");
  }
  for (const requirement of card.data.requirements || []) {
    if (!requirement.mandatory) continue;
    if (!requirement.approved || (requirement.reviewAt && requirement.reviewAt < pilot.data.endsAt)) throw new ConvexError(`Warunek wymaga aktualnego przeglądu eksperta: ${requirement.label}.`);
    const declared = card.data.resources?.[requirement.key];
    const value = declared && typeof declared === "object" ? declared.value : declared;
    const current = !declared?.validUntil || declared.validUntil >= pilot.data.endsAt;
    const match = requirement.operator === "gte" ? typeof value === "number" && value >= requirement.expected : ["in", "oneOf"].includes(requirement.operator) ? Array.isArray(requirement.expected) && requirement.expected.includes(value) : value === requirement.expected;
    const matchingPartners = assigned.filter((p: any) => p.status === "accepted" && p.data.resourceKey === requirement.key);
    const partnerQuantity = matchingPartners.reduce((sum: number, p: any) => sum + p.data.quantity, 0);
    const partner = requirement.allowPartner && (requirement.operator === "gte" ? partnerQuantity >= Number(requirement.expected) : requirement.expected === true && matchingPartners.length > 0);
    if (!(current && match) && !partner) throw new ConvexError(`Nie potwierdzono obowiązkowego warunku: ${requirement.label}.`);
  }
  if (card.data.technicalChange && !card.data.expertVerified) throw new ConvexError("Zmiana merytoryczna wymaga weryfikacji eksperta.");
}

export const transition = mutation({ args: { id: v.id("records"), action: v.string(), data: v.optional(v.any()) }, handler: async (ctx, args) => {
  const { record: r, userId, profile } = await requireRecord(ctx, args.id);
  const d = args.data || {}, data = { ...r.data }; let status = r.status;
  const staff = isOperator(profile), owner = r.ownerId === userId;
  const ownOrStaff = () => { if (!owner && !staff) throw new ConvexError("Decyzję podejmuje autor lub opiekun."); };
  const onlyStaff = () => { if (!staff) throw new ConvexError("Ta decyzja wymaga uprawnień opiekuna."); };
  const allowed = (states: string[]) => { if (!states.includes(r.status)) throw new ConvexError(`Nie można wykonać tej czynności w stanie ${r.status}.`); };
  if (r.kind === "need" && ["watch", "unwatch", "quiet", "classify"].includes(args.action)) {
    ownOrStaff();
    if (args.action === "watch" && data.assistance && (!data.authorConfirmed || r.ownerId !== userId)) throw new ConvexError("Obserwowanie włącza autor po potwierdzeniu treści.");
    if (args.action === "watch" || args.action === "unwatch") { data.watch = args.action === "watch"; data.matchRevision = (data.matchRevision || 0) + 1; data.targetCorpusVersion = (await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "corpusVersion")).unique())?.value || 1; }
    if (args.action === "quiet") data.quiet = d.quiet !== false;
    if (args.action === "classify") data.classification = String(d.classification || "no_knowledge");
  } else if (r.kind === "idea" && args.action === "submit") { ownOrStaff(); allowed(["draft", "changes_requested"]); if (!data.problem || !data.audience) throw new ConvexError("Uzupełnij problem i odbiorców."); status = "submitted"; await notifyStaff(ctx, "Pomysł czeka na ocenę", r.title, r._id);
  } else if (r.kind === "idea" && ["accept", "reject", "request_changes"].includes(args.action)) { onlyStaff(); allowed(["submitted"]); status = { accept: "accepted", reject: "rejected", request_changes: "changes_requested" }[args.action]!; data.reviewComment = String(d.comment || "");
  } else if (r.kind === "application" && args.action === "submit") {
    throw new ConvexError("Wniosek wymaga serwerowej walidacji formularza. Użyj operacji grants.submit.");
  } else if (r.kind === "application" && args.action === "export_simulator") { onlyStaff(); allowed(["submitted"]); data.integrationStatus = "transferred_to_simulator"; data.integrationSimulator = true; data.externalId = `SIM-${data.receipt}`;
  } else if (r.kind === "application" && args.action === "confirm_simulator") { onlyStaff(); if (data.integrationStatus !== "transferred_to_simulator") throw new ConvexError("Najpierw przekaż wniosek do symulatora."); data.integrationStatus = "confirmed_by_simulator"; data.confirmedAt = Date.now();
  } else if (r.kind === "call" && ["open", "close", "archive"].includes(args.action)) { onlyStaff(); status = { open: "open", close: "closed", archive: "archived" }[args.action]!;
  } else if (r.kind === "card" && args.action === "review_sources") {
    onlyStaff(); allowed(["draft", "expert_review", "review_required", "approved"]);
    if (d.expectedVersion !== r.version) throw new ConvexError("Karta zmieniła się w innej sesji. Przeczytaj aktualną wersję przed przeglądem źródeł.");
    if (typeof d.reason !== "string" || d.reason.trim().length < 10 || d.reason.trim().length > 2000) throw new ConvexError("Uzasadnij przegląd źródeł w 10-2000 znakach.");
    await currentCardSources(ctx, data, Date.now(), true);
    data.sourceReviewRequired = false; data.sourceReviewDecision = { userId, at: Date.now(), reason: d.reason.trim(), innovationId: data.innovationId, innovationVersion: data.innovationVersion, sourceIds: data.sourceIds, corpusVersion: data.targetCorpusVersion || null };
    data.approvals = {}; data.expertVerified = false; status = "draft";
  } else if (r.kind === "card" && args.action === "request_review") { ownOrStaff(); allowed(["draft", "review_required"]); if (d.expectedVersion !== undefined && d.expectedVersion !== r.version) throw new ConvexError("Karta zmieniła się w innej sesji. Przeczytaj aktualną wersję przed decyzją."); status = "expert_review";
  } else if (r.kind === "card" && args.action === "verify") { if (profile.role !== "expert" || !r.memberIds.includes(userId)) throw new ConvexError("Zmianę weryfikuje przypisany ekspert."); if (d.expectedVersion !== undefined && d.expectedVersion !== r.version) throw new ConvexError("Karta zmieniła się w innej sesji. Przeczytaj aktualną wersję przed decyzją."); data.expertVerified = { userId, version: r.version, at: Date.now() };
  } else if (r.kind === "card" && args.action === "approve") {
    if (d.expectedVersion !== undefined && d.expectedVersion !== r.version) throw new ConvexError("Karta zmieniła się w innej sesji. Przeczytaj aktualną wersję przed decyzją.");
    ownOrStaff(); allowed(["draft", "expert_review", "review_required", "approved"]); data.approvals = { ...(data.approvals || {}) };
    await currentCardSources(ctx, data);
    if (owner) data.approvals.author = { userId, version: r.version, at: Date.now() };
    if (staff && !owner) data.approvals.operator = { userId, version: r.version, at: Date.now() };
    if (data.technicalChange && !data.expertVerified) throw new ConvexError("Zmianę merytoryczną musi zweryfikować przypisany ekspert.");
    status = data.approvals.author && data.approvals.operator ? "approved" : "expert_review";
  } else if (r.kind === "offer" && args.action === "withdraw") { ownOrStaff(); status = "withdrawn"; await invalidateOffer(ctx, r, userId, "Partner wycofał ofertę. Uzgodnij nowy zasób przed kontynuacją.");
  } else if (r.kind === "partnership" && ["accept", "reject"].includes(args.action)) {
    allowed(["invited", "conflict"]); const offer = await ctx.db.get(data.offerId) as any;
    if (!offer || offer.ownerId !== userId) throw new ConvexError("Zakres udziału potwierdza właściciel oferty.");
    if (args.action === "accept") {
      const all = await ctx.db.query("records").withIndex("by_kind_offer", q => q.eq("kind", "partnership").eq("data.offerId", offer._id)).collect();
      assertReservation(offer, all.filter(p => p.data.offerId === offer._id && p._id !== r._id), data.startsAt, data.endsAt, data.quantity, data.offerVersion, Date.now());
      data.acceptedAt = Date.now(); data.acceptedBy = userId; data.resourceKey = offer.data.resourceKey;
    }
    status = args.action === "accept" ? "accepted" : "rejected";
  } else if (r.kind === "partnership" && args.action === "approve_shared") { onlyStaff(); if (!data.sharedStage) throw new ConvexError("Nie wskazano wspólnego etapu."); data.sharedStageApproved = { userId, at: Date.now() }; 
  } else if (r.kind === "partnership" && ["cancel", "renew"].includes(args.action)) {
    ownOrStaff();
    if (args.action === "cancel") status = "cancelled";
    else { allowed(["conflict", "rejected"]); const offer = await ctx.db.get(data.offerId) as any; if (!offer || offer.status !== "active") throw new ConvexError("Oferta nie jest aktywna."); data.offerVersion = offer.version; status = "invited"; }
  } else if (r.kind === "pilot" && ["approve", "recruit", "start", "complete", "review", "resume"].includes(args.action)) {
    onlyStaff();
    if (args.action === "approve") { allowed(["proposed"]); status = "approved"; }
    if (args.action === "recruit") { allowed(["proposed", "approved"]); status = "recruiting"; }
    if (args.action === "start" || args.action === "resume") { allowed(["recruiting", "blocked"]); await verifyPilotReady(ctx, r, args.action === "resume"); status = "running"; data.startedAt = Date.now(); const card: any = await ctx.db.get(data.cardId); await ctx.db.patch(data.cardId, { status: "piloting", updatedAt: Date.now() }); if (card) { data.cardSnapshot = card.data; data.cardVersion = card.version; } }
    if (args.action === "complete") { allowed(["running"]); status = "completed"; data.completedAt = Date.now(); }
    if (args.action === "review") {
      allowed(["completed"]); if (!d.summary || !d.limitations) throw new ConvexError("Podaj oczyszczone wnioski i ograniczenia dowodów.");
      const feedback = (await ctx.db.query("records").withIndex("by_kind_pilot", q => q.eq("kind", "feedback").eq("data.pilotId", r._id)).collect()).filter(f => f.status === "submitted");
      const enrollments = await ctx.db.query("records").withIndex("by_kind_pilot", q => q.eq("kind", "enrollment").eq("data.pilotId", r._id)).collect();
      data.review = { summary: String(d.summary), limitations: String(d.limitations), reviewedBy: userId, reviewedAt: Date.now(), responses: feedback.length, accepted: enrollments.filter(e => e.status === "accepted").length, invited: enrollments.length, withdrawn: enrollments.filter(e => e.status === "withdrawn").length, causalEvidence: false };
      status = "reviewed"; await ctx.db.patch(data.cardId, { status: "evaluated", updatedAt: Date.now() });
    }
  } else if (r.kind === "pilot" && args.action === "publish_experience") {
    onlyStaff(); allowed(["reviewed"]); if (data.experienceId) return r;
    const sourceId = await ctx.db.insert("sources", { title: `Doświadczenie pilotażu: ${r.title}`, url: `/#/pilot/${r._id}`, publisher: "Splot HubMI, syntetyczny pilotaż", retrievedAt: Date.now(), geography: "Demonstracyjna gmina", rights: "Własny opis demonstracyjny", reviewAt: Date.now() + 180 * 86400000, hash: contentHash(data.review), version: 1, status: "approved", demo: true, body: `${data.review.summary}\nOgraniczenia: ${data.review.limitations}` });
    data.experienceId = await ctx.db.insert("knowledge", { stableId: `pilot-${r._id}`, version: 1, status: "review", kind: "case", title: `Doświadczenie: ${r.title}`, summary: data.review.summary, body: `${data.review.summary}\nOgraniczenia: ${data.review.limitations}\nLiczba odpowiedzi: ${data.review.responses}. Brak grupy porównawczej, bez wniosku o przyczynowości.`, tags: ["pilotaż", "doświadczenie"], problemTags: [], audienceTags: [], sourceIds: [sourceId], requirements: [], evidenceLevel: "documented_test", demo: true, searchText: `${r.title} ${data.review.summary}`, publishedScope: "private:review", ownerId: userId, createdAt: Date.now(), updatedAt: Date.now() });
  } else if (r.kind === "enrollment" && args.action === "accept") {
    const pilot = await ctx.db.get(data.pilotId) as any; if (!staff && pilot?.ownerId !== userId) throw new ConvexError("Uczestników przyjmuje koordynator."); allowed(["pending"]);
    if (!pilot || pilot.status !== "recruiting") throw new ConvexError("Rekrutacja jest zamknięta.");
    const enrollments = await ctx.db.query("records").withIndex("by_kind_pilot", q => q.eq("kind", "enrollment").eq("data.pilotId", data.pilotId)).collect();
    if (enrollments.filter(e => e.data.pilotId === data.pilotId && e.status === "accepted").length >= pilot.data.capacity) throw new ConvexError("Wszystkie miejsca zostały zajęte.");
    status = "accepted"; await ctx.db.patch(pilot._id, { memberIds: [...new Set([...pilot.memberIds, r.ownerId])], updatedAt: Date.now() }); await syncAccess(ctx, await ctx.db.get(pilot._id));
  } else if (r.kind === "enrollment" && args.action === "withdraw") { ownOrStaff(); status = "withdrawn"; const pilot = await ctx.db.get(data.pilotId) as any; if (pilot) { await ctx.db.patch(pilot._id, { memberIds: pilot.memberIds.filter((id: any) => id !== r.ownerId), updatedAt: Date.now() }); await syncAccess(ctx, await ctx.db.get(pilot._id)); }
  } else if (r.kind === "feedback" && args.action === "submit") { ownOrStaff(); allowed(["draft"]); status = "submitted";
  } else if (r.kind === "thread" && args.action === "read") {
    const messages = (await ctx.db.query("records").withIndex("by_kind_thread", q => q.eq("kind", "message").eq("data.threadId", r._id)).take(1000)).filter(m => m.ownerId !== userId);
    for (const message of messages) await ctx.db.patch(message._id, { data: { ...message.data, readAt: Date.now(), readBy: { ...(message.data.readBy || {}), [userId]: Date.now() } } });
    return r;
  } else if (r.kind === "thread" && args.action === "resolve") { ownOrStaff(); status = "resolved";
  } else if (r.kind === "call_watch" && ["unwatch", "watch", "quiet"].includes(args.action)) { ownOrStaff(); if (args.action === "quiet") data.quiet = d.quiet !== false; else status = args.action === "watch" ? "active" : "inactive";
  } else throw new ConvexError("Ta czynność nie jest dostępna dla tego dokumentu.");
  const result = await change(ctx, r, userId, { status, data, ...(args.action === "review_sources" ? { version: r.version + 1 } : {}) }, args.action);
  if (r.kind === "need" && args.action === "watch") await ctx.scheduler.runAfter(0, internal.matching.processWatch, { needId: r._id, needVersion: r.version, matchRevision: data.matchRevision, corpusVersion: data.targetCorpusVersion, attempt: 0 });
  if (!owner) await notify(ctx, r.ownerId, "Zmiana statusu sprawy", `${r.title}: ${status}`, r._id);
  return result;
} });
export const assign = mutation({ args: { id: v.id("records"), userId: v.id("users") }, handler: async (ctx, args) => {
  const { userId } = await requireRole(ctx, ["operator", "admin"]); const r = await ctx.db.get(args.id);
  const p = await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
  if (!r || !p || !["expert", "operator", "admin"].includes(p.role)) throw new ConvexError("Wybierz uprawnionego eksperta lub opiekuna.");
  await ctx.db.patch(r._id, { memberIds: [...new Set([...r.memberIds, args.userId])], data: { ...r.data, assigneeId: args.userId }, updatedAt: Date.now() });
  await syncAccess(ctx, await ctx.db.get(r._id));
  await audit(ctx, userId, "assign", r._id, { assigneeId: args.userId }); await notify(ctx, args.userId, "Przypisano konsultację", r.title, r._id);
} });
export const notifications = query({ args: {}, handler: async ctx => { const who = await currentUser(ctx); if (!who) return []; return ctx.db.query("notifications").withIndex("by_user", q => q.eq("userId", who.userId)).order("desc").take(100); } });
export const markRead = mutation({ args: { id: v.id("notifications") }, handler: async (ctx, { id }) => { const { userId } = await requireUser(ctx); const item = await ctx.db.get(id); if (!item || item.userId !== userId) throw new ConvexError("Brak dostępu."); await ctx.db.patch(id, { readAt: Date.now() }); } });
export const adminStats = query({ args: {}, handler: async ctx => {
  const { profile } = await requirePermission(ctx, "trends:read");
  const needs = await ctx.db.query("records").withIndex("by_kind_created", q => q.eq("kind", "need").gte("createdAt", Date.now() - 30 * 86400000)).order("desc").take(10001);
  const seen = new Set<string>(), groups: Record<string, number> = {};
  for (const n of needs.slice(0, 10000)) { const key = `${n.ownerId}:${contentHash(n.data.description)}`; if (seen.has(key)) continue; seen.add(key); const category = n.data.group || "Nie określono"; groups[category] = (groups[category] || 0) + 1; }
  const usage = await ctx.db.query("aiUsage").withIndex("by_created", q => q.gte("createdAt", Date.now() - 30 * 86400000)).take(10000);
  return { totalNeeds: seen.size, truncated: needs.length > 10000, sampleLimit: 10000, suppressedBelow: 5, trends: Object.entries(groups).map(([category, count]) => ({ category, count: count >= 5 ? count : null, suppressed: count < 5 })), disclaimer: `Zgłoszenia użytkowników po deduplikacji, nie reprezentatywny pomiar populacji. Komórki poniżej 5 zgłoszeń ukryte.${needs.length > 10000 ? " Zestawienie ograniczone do 10 000 najnowszych zgłoszeń z okresu; pełna agregacja wymaga eksportu operatora." : ""}`, periodDays: 30, aiCostUsd: usage.reduce((sum, row) => sum + row.costUsd, 0), aiOperations: usage.length, jobs: profile.role === "admin" ? await ctx.db.query("jobs").order("desc").take(50) : [], audit: profile.role === "admin" ? await ctx.db.query("audit").order("desc").take(50) : [] };
} });
export const pilotResults = query({ args: { id: v.id("records") }, handler: async (ctx, { id }) => {
  const { record, profile, userId } = await requireRecord(ctx, id);
  if (record.kind !== "pilot" || (!isOperator(profile) && record.ownerId !== userId && profile.role !== "expert")) throw new ConvexError("Wyniki widzi koordynator i przypisany ekspert.");
  const feedback = (await ctx.db.query("records").withIndex("by_kind_pilot", q => q.eq("kind", "feedback").eq("data.pilotId", id)).take(1000)).filter(r => r.status === "submitted");
  const enrollments = await ctx.db.query("records").withIndex("by_kind_pilot", q => q.eq("kind", "enrollment").eq("data.pilotId", id)).take(1000);
  return { cardVersion: record.data.cardVersion, invited: enrollments.length, participants: enrollments.filter(e => e.status === "accepted").length, responses: feedback.length, withdrawn: enrollments.filter(e => e.status === "withdrawn").length, averageUsability: feedback.length ? feedback.reduce((s, f) => s + f.data.rating, 0) / feedback.length : null, feedback, causalEvidence: false, note: "Ocena użyteczności i deklarowane zmiany nie dowodzą skuteczności społecznej ani związku przyczynowego." };
} });



