import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { demoCorpus, corpusSources } from "../domain/corpus";
import { contentHash } from "../domain/rules";
import { syncAccess } from "./lib/acl";
import { demoIndicators } from "../domain/indicators";
import { demoLearningSteps, demoMediaMetadata, demoMediaTranscript } from "../domain/demoMedia";

function assertDemo() { if (process.env.APP_ENV !== "demo" || process.env.APP_PROJECT !== "splot-hubmi") throw new Error("Seed jest dostępny wyłącznie w dedykowanym środowisku demonstracyjnym Splot."); }
export const accounts = [
  { email: "mieszkaniec@splot.demo", name: "Anna, mieszkanka", role: "resident", organization: "Osoba testowa" },
  { email: "instytucja@splot.demo", name: "Marta, koordynatorka CUS", role: "institution", organization: "CUS w Zielonej Gminie (fikcyjny)" },
  { email: "ekspert@splot.demo", name: "Tomasz, ekspert", role: "expert", organization: "Pracownia Wspólnych Rozwiązań (fikcyjna)" },
  { email: "rops@splot.demo", name: "Ewa, opiekunka ROPS", role: "admin", organization: "ROPS, konto demonstracyjne" },
];
export const findAccount = internalQuery({ args: { email: v.string() }, handler: async (ctx, { email }) => { assertDemo(); return ctx.db.query("users").withIndex("email", q => q.eq("email", email)).unique(); } });
export const setProfile = internalMutation({ args: { userId: v.id("users"), name: v.string(), role: v.string(), organization: v.string() }, handler: async (ctx, args) => {
  assertDemo(); const profile = await ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", args.userId)).unique();
  const data = { ...args, permissions: args.role === "admin" ? ["knowledge:edit", "knowledge:publish", "trends:read", "roles:assign"] : [] };
  if (profile) await ctx.db.patch(profile._id, data); else await ctx.db.insert("profiles", data);
} });
export const seed = internalAction({ args: {}, handler: async (ctx): Promise<any> => {
  assertDemo(); const password = process.env.DEMO_PASSWORD; if (!password || password.length < 12) throw new Error("Skonfiguruj hasło kont demonstracyjnych.");
  const ids: Record<string, any> = {};
  for (const account of accounts) {
    let user = await ctx.runQuery(internal.seed.findAccount, { email: account.email });
    if (!user) { const result = await createAccount(ctx, { provider: "password", account: { id: account.email, secret: password }, profile: { email: account.email, name: account.name } }); user = result.user; }
    await ctx.runMutation(internal.seed.setProfile, { userId: user._id, name: account.name, role: account.role, organization: account.organization }); ids[account.role] = user._id;
  }
  const result = await ctx.runMutation(internal.seed.seedData, { ids });
  await ctx.runMutation(internal.seed.rebuildAccess, {});
  await ctx.runMutation(internal.seed.regionalIndicators, {});
  await ctx.runMutation(internal.seed.demoMedia, {});
  await ctx.scheduler.runAfter(0, internal.search.indexPublished, {});
  return { ...result, accounts: accounts.map(a => ({ email: a.email, role: a.role })), project: "splot-hubmi", demo: true };
} });
export const regionalIndicators = internalMutation({ args: {}, handler: async ctx => {
  assertDemo(); const existing = await ctx.db.query("knowledge").withIndex("by_stable", q => q.eq("stableId", "demo-regional-indicators")).first(); if (existing) return { seeded: false, id: existing._id };
  const admin = await ctx.db.query("profiles").withIndex("by_role", q => q.eq("role", "admin")).first(); if (!admin) throw new Error("Najpierw utwórz konta demonstracyjne.");
  const now = Date.now();
  const sourceId = await ctx.db.insert("sources", { title: "Syntetyczne wskaźniki do demonstracji mapy", url: "/sources/demo-map.html", publisher: "DEFOZO SOFTWARE HOUSE, autorski scenariusz techniczny", retrievedAt: now, publishedAt: now, geography: "Małopolska, punkty orientacyjne; wartości całkowicie fikcyjne", period: "2026, scenariusz demonstracyjny", rights: "Własne dane demonstracyjne, CC BY 4.0", reviewAt: now + 365 * 86400000, hash: contentHash(demoIndicators), version: 1, status: "draft", demo: true, locator: "Tabela trzech wartości demonstracyjnych", body: JSON.stringify(demoIndicators) });
  const id = await ctx.db.insert("knowledge", { stableId: "demo-regional-indicators", version: 1, status: "indexing", kind: "map", title: "Mapa scenariusza demonstracyjnego", summary: "Trzy fikcyjne liczby ilustrują import i prezentację wskaźników. Nie są diagnozą społeczną ani danymi ROPS.", body: demoIndicators.map(row => `${row.territory}: ${row.value} ${row.unit}, ${row.year}. ${row.note}`).join("\n"), tags: ["mapa", "demonstracja"], problemTags: [], audienceTags: [], sourceIds: [sourceId], requirements: [], evidenceLevel: "concept", demo: true, searchText: "Mapa wskaźniki syntetyczne Kraków Tarnów Nowy Sącz", publishedScope: "private:indexing", retrievalScope: "private:indexing", metadata: { indicators: demoIndicators }, ownerId: admin.userId, reviewedBy: admin.userId, createdAt: now, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.search.indexPublished, { id, version: 1 });
  return { seeded: true, id };
} });
export const demoMedia = internalMutation({ args: {}, handler: async ctx => {
  assertDemo();
  const admin = await ctx.db.query("profiles").withIndex("by_role", q => q.eq("role", "admin")).first(); if (!admin) throw new Error("Najpierw utwórz konta demonstracyjne.");
  const entries = [
    { stableId: "demo-video-first-result", kind: "video", title: "Splot: opis potrzeby i pierwszy wynik", summary: "26 sekund nagrania działającej aplikacji: opis potrzeby, interpretacja, pytanie i warunki. Materiał z danymi syntetycznymi, napisami i opisem czynności.", body: demoMediaTranscript, metadata: demoMediaMetadata },
    { stableId: "demo-course-first-steps", kind: "course", title: "Jak opisać potrzebę i sprawdzić podstawę odpowiedzi", summary: "Pięć prostych kroków: od opisu sytuacji przez sprawdzenie źródeł i warunków do świadomego wyboru dalszego działania. Autorski kurs demonstracyjny.", body: demoLearningSteps.map((step, i) => `${i + 1}. ${step.title}\n${step.body}`).join("\n\n"), metadata: { ...demoMediaMetadata, steps: demoLearningSteps, templateVersion: "demo-learning-1" } },
  ];
  const missing = [];
  const ids: string[] = [];
  for (const entry of entries) { const found = await ctx.db.query("knowledge").withIndex("by_stable", q => q.eq("stableId", entry.stableId)).first(); if (found) ids.push(found._id); else missing.push(entry); }
  if (!missing.length) return { seeded: false, ids };
  const now = Date.now();
  const body = `${demoMediaTranscript}\n\n${demoLearningSteps.map(step => `${step.title}: ${step.body}`).join("\n")}`;
  const hash = contentHash({ transcript: demoMediaTranscript, steps: demoLearningSteps, durationSeconds: 26 });
  const sources = await ctx.db.query("sources").withIndex("by_url", q => q.eq("url", "/sources/demo-video.html")).collect();
  const sourceId = sources.find(source => source.hash === hash)?._id || await ctx.db.insert("sources", { title: "Autorski film i kurs: pierwszy krok w Splot", url: "/sources/demo-video.html", publisher: "Michał Kiełtyka, DEFOZO SOFTWARE HOUSE", retrievedAt: now, publishedAt: now, geography: "Demonstracja interfejsu, bez pomiaru populacji", period: "3 października 2026", rights: "Własny film i tekst edukacyjny, CC BY 4.0", reviewAt: now + 365 * 86400000, hash, version: sources.length + 1, status: "draft", demo: true, locator: "Film 00:00-00:26, transkrypcja i pięć kroków kursu", body });
  for (const entry of missing) {
    const id = await ctx.db.insert("knowledge", { ...entry, version: 1, status: "indexing", tags: ["edukacja", "instrukcja", "demonstracja"], problemTags: [], audienceTags: ["mieszkańcy", "instytucje"], sourceIds: [sourceId], requirements: [], evidenceLevel: "concept", demo: true, searchText: `${entry.title} ${entry.summary} ${entry.body}`, publishedScope: "private:indexing", retrievalScope: "private:indexing", ownerId: admin.userId, reviewedBy: admin.userId, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.search.indexPublished, { id, version: 1 }); ids.push(id);
  }
  return { seeded: true, ids, created: missing.length };
} });
export const rebuildAccess = internalMutation({ args: { cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  assertDemo(); const page = await ctx.db.query("records").paginate({ cursor: args.cursor || null, numItems: 100 });
  for (const record of page.page) await syncAccess(ctx, record);
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.seed.rebuildAccess, { cursor: page.continueCursor });
  return { count: page.page.length, complete: page.isDone };
} });
export const seedData = internalMutation({ args: { ids: v.any() }, handler: async (ctx, { ids }) => {
  assertDemo(); const marker = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "seedVersion")).unique();
  if (marker) return { seeded: false, version: marker.value };
  const now = Date.now(), day = 86400000;
  const source = corpusSources[0];
  const sourceId = await ctx.db.insert("sources", { title: source.title, url: source.url, publisher: source.publisher, retrievedAt: now, geography: "Scenariusze syntetyczne, bez danych o populacji", rights: "Autorski korpus demonstracyjny CC BY 4.0", reviewAt: now + 365 * day, hash: contentHash(demoCorpus), version: 1, status: "published", demo: true, body: source.description, locator: "Autorskie scenariusze" });
  const knowledgeIds: Record<string, any> = {};
  for (const entry of demoCorpus) {
    knowledgeIds[entry.stableId] = await ctx.db.insert("knowledge", { ...entry, sourceIds: [sourceId], requirements: entry.requirements.map(r => ({ ...r, sourceId })), searchText: `${entry.title} ${entry.summary} ${entry.body} ${entry.tags.join(" ")} ${entry.problemTags.join(" ")}`, createdAt: now, updatedAt: now, ownerId: ids.admin });
  }
  const add = async (kind: string, title: string, data: any, status: string, ownerId: any, memberIds: any[] = []) => ctx.db.insert("records", { kind, title, data: { ...data, demo: true }, status, ownerId, memberIds, version: 1, createdAt: now, updatedAt: now });
  const needId = await add("need", "Seniorzy chcą znów spotykać się z sąsiadami", { description: "W Zielonej Gminie starsze osoby czują się samotne. Chcemy uruchomić regularne spotkania i odbudować relacje sąsiedzkie.", group: "seniorzy", municipality: "Zielona Gmina (demo)", resources: { coordinator: true, accessibleRoom: true }, watch: true, quiet: false, matchRevision: 0, targetCorpusVersion: 1, nextStep: "Uzgodnij lokalny mikrotest z opiekunem." }, "open", ids.institution, [ids.admin, ids.expert]);
  const ideaId = await add("idea", "Sąsiedzka kawa i rozmowa", { problem: "Samotność osób starszych", audience: "Seniorzy mieszkający samotnie", stage: "pomysł", context: "Zielona Gmina, przykład fikcyjny", resources: "Sala CUS i koordynatorka", trials: "Jeszcze nie testowano", publicConsent: false, canvas: { beneficiaries: "Seniorzy 65+", value: "Stały kontakt i poczucie przynależności", activities: "Cotygodniowe spotkania w małych grupach", partners: "CUS i wolontariusze", resources: "Dostępna sala, koordynator", costs: "Koszt wymaga wyceny", impact: "Liczba regularnych kontaktów deklarowana przed i po" }, canvasTemplateVersion: "demo-1" }, "draft", ids.institution, [ids.admin]);
  const callA = await add("call", "Mikroinnowacje blisko ludzi", { description: "Demonstracyjny nabór na pierwszy mikrotest lokalnego pomysłu. Złożenie wniosku nie oznacza przyznania finansowania.", opensAt: now - day, closesAt: now + 60 * day, budgetLimitGrosz: 1000000, schemaVersion: 1, criteria: "Jasny problem, udział odbiorców, mierzalny mikrotest.", fields: [{ key: "problem", label: "Jaki problem rozwiązuje pomysł?", type: "textarea", required: true }, { key: "audience", label: "Dla kogo jest rozwiązanie?", type: "text", required: true }, { key: "testPlan", label: "Jak przeprowadzisz pierwszy test?", type: "textarea", required: true }, { key: "participants", label: "Liczba uczestników", type: "number", required: true }, { key: "consent", label: "Potwierdzam poprawność danych demonstracyjnych", type: "checkbox", required: true }], schema: { type: "object", required: ["problem", "audience", "testPlan", "participants", "consent"], properties: { problem: { type: "string", minLength: 10, title: "Problem" }, audience: { type: "string", minLength: 3, title: "Odbiorcy" }, testPlan: { type: "string", minLength: 10, title: "Plan testu" }, participants: { type: "integer", minimum: 1, maximum: 100, title: "Uczestnicy" }, consent: { const: true, type: "boolean", title: "Potwierdzenie" } }, additionalProperties: false }, uiSchema: { problem: { "ui:widget": "textarea" }, testPlan: { "ui:widget": "textarea" } } }, "open", ids.admin);
  await add("call", "Partnerstwo dla dostępności", { description: "Drugi demonstracyjny nabór z osobnym formularzem. Dotyczy współpracy i usuwania barier.", opensAt: now - day, closesAt: now + 90 * day, budgetLimitGrosz: 3000000, schemaVersion: 1, criteria: "Dostępność, potwierdzony partner i ewaluacja.", fields: [{ key: "barrier", label: "Którą barierę usuwasz?", type: "textarea", required: true }, { key: "partner", label: "Partner i jego zakres udziału", type: "text", required: true }, { key: "accessibility", label: "Jak zapewnisz dostępność?", type: "textarea", required: true }, { key: "outcome", label: "Wskaźnik rezultatu", type: "text", required: true }], schema: { type: "object", required: ["barrier", "partner", "accessibility", "outcome"], properties: { barrier: { type: "string", minLength: 10 }, partner: { type: "string", minLength: 3 }, accessibility: { type: "string", minLength: 10 }, outcome: { type: "string", minLength: 3 } }, additionalProperties: false } }, "open", ids.admin);
  const innovation = demoCorpus.find(k => k.stableId === "sasiedzi")!;
  const cardData = { needId, needVersion: 1, innovationId: knowledgeIds.sasiedzi, innovationVersion: 1, sourceIds: [sourceId], goal: "Ułatwić regularny kontakt seniorów z sąsiadami", audience: "12 seniorów w Zielonej Gminie (dane fikcyjne)", mechanism: "Małe grupy spotykają się co tydzień", adaptations: "Dostępne godziny i możliwość rozmowy telefonicznej", resources: { coordinator: { value: true, basis: "declaration", confirmedAt: now, validUntil: now + 120 * day }, accessibleRoom: { value: true, basis: "declaration", confirmedAt: now, validUntil: now + 120 * day } }, requirements: innovation.requirements.map(r => ({ ...r, sourceId })), budgetItems: [{ label: "Materiały na spotkania", quantity: 4, unitPriceGrosz: 5000 }], budget: { totalGrosz: 20000, complete: true }, risks: "Niska frekwencja. Sprawdzić dogodny termin z uczestnikami.", accessibility: "Sala bez progów, duży druk i proste instrukcje", metrics: "Liczba kontaktów deklarowana przed testem i po 4 tygodniach", timeline: "4 cotygodniowe spotkania", approvals: { author: { userId: ids.institution, version: 1, at: now }, operator: { userId: ids.admin, version: 1, at: now } }, provenance: { goal: "local_declaration", mechanism: "synthetic_source", costs: "local_assumption" }, technicalChange: false, expertVerified: false, sourceSnapshot: innovation };
  const cardId = await add("card", "Sąsiedzka kawa, lokalny mikrotest", cardData, "approved", ids.institution, [ids.admin, ids.expert]);
  const pilotId = await add("pilot", "Sąsiedzka kawa: przetestuj spotkanie", { cardId, cardVersion: 1, cardSnapshot: cardData, capacity: 12, startsAt: now + day, endsAt: now + 30 * day, criteria: "Pełnoletni uczestnik konta demonstracyjnego", tasks: "Weź udział w spotkaniu. Oceń łatwość dojazdu, rozmowy i komfort uczestnictwa.", metrics: "Użyteczność 1-5, deklarowana liczba kontaktów przed i po", description: "Syntetyczny test działania platformy. Żadne spotkanie nie jest faktycznie organizowane." }, "recruiting", ids.institution, [ids.admin, ids.expert]);
  await add("offer", "Koordynator spotkań sąsiedzkich", { resourceKey: "coordinator", capacity: 1, validUntil: now + 180 * day, territory: "Zielona Gmina (fikcyjna)", conditions: "Do czterech spotkań w miesiącu, po uzgodnieniu terminu", description: "Demonstracyjna oferta eksperta, bez rzeczywistego zobowiązania", confirmedAt: now }, "active", ids.expert);
  await add("offer", "Dostępna sala na 15 osób", { resourceKey: "accessibleRoom", capacity: 1, validUntil: now + 180 * day, territory: "Zielona Gmina (fikcyjna)", conditions: "Dni robocze, rezerwacja konkretnego terminu", confirmedAt: now }, "active", ids.expert);
  const threadId = await add("thread", "Konsultacja Sąsiedzkiej kawy", { recordId: needId, description: "Uzgodnienia dotyczące lokalnego mikrotestu" }, "answered", ids.institution, [ids.admin, ids.expert]);
  await add("message", "Wiadomość od opiekunki", { threadId, body: "Witaj! Zacznijmy od rozmowy z odbiorcami i jednego małego spotkania. Karta zawiera warunki oraz przykładowy budżet. Po teście oddzielimy ocenę użyteczności od efektu społecznego." }, "sent", ids.admin, [ids.institution, ids.expert]);
  await ctx.db.insert("meta", { key: "corpusVersion", value: 1 }); await ctx.db.insert("meta", { key: "seedVersion", value: "splot-demo-1" });
  return { seeded: true, knowledge: demoCorpus.length, needId, ideaId, cardId, pilotId, callId: callA };
} });
