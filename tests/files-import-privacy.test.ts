import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference as ref } from "convex/server";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.ts");
const fn = (name: string) => ref(name) as any;
async function completeIndex(t: any, id: any) {
  const doc = await t.run((ctx: any) => ctx.db.get(id));
  const staged = await t.mutation(fn("search:stageChunks"), { id, version: doc.version, model: "test-embedding" });
  await t.mutation(fn("search:storeEmbeddings"), { model: "test-embedding", rows: staged.pending.map((part: any) => ({ id: part.id, version: doc.version, vector: [1, ...Array(1535).fill(0)] })) });
  return t.mutation(fn("knowledge:commitPublication"), { id, version: doc.version });
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const owner = await ctx.db.insert("users", { name: "Autor" }), other = await ctx.db.insert("users", { name: "Inna osoba" }), admin = await ctx.db.insert("users", { name: "Redaktor" });
    for (const [userId, role] of [[owner, "institution"], [other, "resident"], [admin, "admin"]] as const) await ctx.db.insert("profiles", { userId, name: role, role });
    const record = await ctx.db.insert("records", { ownerId: owner, memberIds: [], kind: "need", title: "Własna potrzeba", data: { description: "Potrzebujemy sąsiedzkich spotkań", watch: false }, status: "draft", version: 1, createdAt: Date.now(), updatedAt: Date.now() });
    const otherRecord = await ctx.db.insert("records", { ownerId: other, memberIds: [], kind: "need", title: "Cudza potrzeba", data: { description: "Prywatny opis innej osoby" }, status: "draft", version: 1, createdAt: Date.now(), updatedAt: Date.now() });
    return { owner, other, admin, record, otherRecord };
  });
  const as = (id: any) => t.withIdentity({ subject: id });
  const file = async (content = "Test bez danych osobowych", type = "text/plain", recordId = ids.record) => {
    const storageId = await t.run(ctx => ctx.storage.store(new Blob([content], { type })));
    // convex-test storeBlob omits the Content-Type that the real signed HTTP upload stores.
    await t.run(ctx => (ctx.db as any).patch(storageId, { contentType: type }));
    const id = await as(ids.owner).mutation(fn("files:quarantine"), { storageId, recordId, name: "test.txt" });
    return { id, storageId };
  };
  return { t, ids, as, file };
}
describe("Załączniki, redakcja i usuwanie danych", () => {
  it("zachowuje datę publikacji źródła i tworzy nową wersję przy jej korekcie", async () => {
    const { t, ids, as } = await setup();
    const input = { title: "Materiał z datą publikacji", summary: "Jawna proweniencja materiału i jego daty", sourceUrl: "https://example.org/material", rights: "Własne", publishedAt: "2026-09-01", period: "2025" };
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: input });
    const original = await as(ids.admin).query(fn("knowledge:get"), { id });
    expect(original.sources[0].publishedAt).toBe(Date.parse("2026-09-01")); expect(original.sources[0].period).toBe("2025");
    const originalId = original.sources[0]._id;
    await as(ids.admin).mutation(fn("knowledge:save"), { id, data: { publishedAt: Date.parse("2026-09-02") } });
    const corrected = await as(ids.admin).query(fn("knowledge:get"), { id });
    expect(corrected.sources[0].publishedAt).toBe(Date.parse("2026-09-02")); expect(corrected.sources[0].version).toBe(2); expect(corrected.sources[0]._id).not.toBe(originalId);
    const unchanged: any = await t.run((ctx: any) => ctx.db.get(originalId)); expect(unchanged.publishedAt).toBe(Date.parse("2026-09-01"));
    await as(ids.admin).mutation(fn("knowledge:save"), { id, data: { publishedAt: Date.parse("2026-09-02") } });
    expect((await as(ids.admin).query(fn("knowledge:get"), { id })).sources[0]._id).toBe(corrected.sources[0]._id);
    await expect(as(ids.admin).mutation(fn("knowledge:save"), { data: { ...input, publishedAt: "nieznana data" } })).rejects.toThrow("datę publikacji");
  });
  it("oddziela uprawnienia redakcji od analizy trendów również w importerze", async () => {
    const { t, as } = await setup();
    const staff = await t.run(async ctx => {
      const editor = await ctx.db.insert("users", { name: "Redaktor" }), analyst = await ctx.db.insert("users", { name: "Analityk" });
      await ctx.db.insert("profiles", { userId: editor, name: "Redaktor", role: "operator", permissions: ["knowledge:edit"] });
      await ctx.db.insert("profiles", { userId: analyst, name: "Analityk", role: "operator", permissions: ["trends:read"] });
      return { editor, analyst };
    });
    expect(await as(staff.editor).query(fn("knowledge:list"), { admin: true })).toEqual([]);
    expect((await as(staff.editor).query(fn("importSupport:authorize"), {})).userId).toBe(staff.editor);
    await expect(as(staff.editor).query(fn("hub:adminStats"), {})).rejects.toThrow("uprawnień");
    const stats = await as(staff.analyst).query(fn("hub:adminStats"), {}); expect(stats.trends).toBeDefined(); expect(stats.audit).toEqual([]); expect(stats.jobs).toEqual([]);
    await expect(as(staff.analyst).query(fn("knowledge:list"), { admin: true })).rejects.toThrow("uprawnień");
    await expect(as(staff.analyst).query(fn("importSupport:authorize"), {})).rejects.toThrow("uprawnień");
    await expect(as(staff.analyst).mutation(fn("knowledge:save"), { data: { title: "Niedozwolony szkic", summary: "Analityk nie ma uprawnień do publikowania" } })).rejects.toThrow("uprawnień");
  });
  it("tworzy idempotentny film i kurs z napisami przez kolejkę publikacji", async () => {
    const { t } = await setup(); vi.stubEnv("APP_ENV", "demo"); vi.stubEnv("APP_PROJECT", "splot-hubmi");
    const seeded = await t.mutation(fn("seed:demoMedia"), {}); expect(seeded.created).toBe(2);
    const repeated = await t.mutation(fn("seed:demoMedia"), {}); expect(repeated.seeded).toBe(false); expect(new Set(repeated.ids)).toEqual(new Set(seeded.ids));
    expect(await t.query(fn("knowledge:list"), { type: "video" })).toEqual([]);
    for (const id of seeded.ids) await completeIndex(t, id);
    const videos = await t.query(fn("knowledge:list"), { type: "video" }), courses = await t.query(fn("knowledge:list"), { type: "course" });
    expect(videos).toHaveLength(1); expect(courses).toHaveLength(1);
    expect(videos[0].metadata).toMatchObject({ videoUrl: "/media/splot-intro.mp4", vttUrl: "/media/splot-intro.vtt", durationSeconds: 26, license: "CC BY 4.0" });
    expect(videos[0].metadata.transcript).toContain("0:14-0:26"); expect(courses[0].metadata.steps).toHaveLength(5);
    expect(videos[0].sourceIds).toEqual(courses[0].sourceIds); expect(videos[0].sources[0].url).toBe("/sources/demo-video.html");
    vi.stubEnv("APP_ENV", "production"); await expect(t.mutation(fn("seed:demoMedia"), {})).rejects.toThrow("demonstracyjnym");
  });
  it("mapa prezentuje wyłącznie opublikowane wskaźniki ze źródłem, rokiem i jednostką", async () => {
    const { t, ids, as } = await setup();
    const metadata = { indicators: [{ name: "Fikcyjny wskaźnik", territory: "Kraków", year: 2026, unit: "sztuki demo", value: 8, latitude: 50.06, longitude: 19.94 }] };
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: { title: "Mapa demonstracyjna", summary: "Fikcyjne wartości do testu technicznego mapy", body: "Wartości syntetyczne, nie badanie społeczne", rights: "CC BY 4.0", kind: "map", metadata } });
    expect((await t.query(fn("knowledge:indicators"), {})).rows).toHaveLength(0);
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "review" });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "publish" });
    expect((await t.query(fn("knowledge:indicators"), {})).rows).toHaveLength(0);
    await expect(t.mutation(fn("knowledge:commitPublication"), { id, version: 1 })).rejects.toThrow("pełny indeks");
    await completeIndex(t, id);
    const published = (await t.query(fn("knowledge:indicators"), {})).rows;
    expect(published).toHaveLength(1); expect(published[0]).toMatchObject({ territory: "Kraków", value: 8, year: 2026, unit: "sztuki demo", demo: true }); expect(published[0].sources[0].url).toBeTruthy();
    await as(ids.admin).mutation(fn("knowledge:withdrawSource"), { sourceId: published[0].sources[0].id });
    expect((await t.query(fn("knowledge:indicators"), {})).rows).toHaveLength(0);
    await expect(as(ids.admin).mutation(fn("knowledge:save"), { data: { title: "Błędna mapa", summary: "Brak jednostki nie jest poprawną metadaną", kind: "map", metadata: { indicators: [{ ...metadata.indicators[0], unit: "" }] } } })).rejects.toThrow("jednostk");
  });
  it("pozwala wyjaśnić prawa importu przez nową wersję źródła bez zmiany oryginału", async () => {
    const { t, ids, as } = await setup();
    const input = { title: "Źródło do oceny", summary: "Materiał oczekujący na wyjaśnienie praw do publikacji", body: "Treść pierwotnego źródła", kind: "report", sourceUrl: "https://example.org/report", rights: "do weryfikacji" };
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: input });
    const before = await as(ids.admin).query(fn("knowledge:get"), { id });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "review" });
    await expect(as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "publish" })).rejects.toThrow("prawa");
    await as(ids.admin).mutation(fn("knowledge:save"), { id, data: { rights: "Zgoda wydawcy z 2026-10-03" } });
    const revised = await as(ids.admin).query(fn("knowledge:get"), { id });
    expect(revised.sources[0]._id).not.toBe(before.sources[0]._id);
    expect(revised.sources[0].version).toBe(2);
    expect((await t.run(ctx => ctx.db.get(before.sources[0]._id))) as any).toMatchObject({ rights: "do weryfikacji", status: "draft", body: input.body });
    expect(revised.sources[0]).toMatchObject({ rights: "Zgoda wydawcy z 2026-10-03", body: input.body });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "review" });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "publish" }); await completeIndex(t, id);
    expect((await t.query(fn("knowledge:get"), { id })).status).toBe("published");
    await t.run(ctx => ctx.db.patch(revised.sources[0]._id, { reviewAt: Date.now() - 1 }));
    await expect(t.query(fn("knowledge:get"), { id })).rejects.toThrow("publicznie");
    expect(await t.query(fn("knowledge:list"), { type: "report" })).toEqual([]);
    expect((await t.query(fn("knowledge:page"), { type: "report", paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([]);
    expect((await as(ids.admin).query(fn("knowledge:get"), { id }))._id).toBe(id);
  });
  it("egzekwuje kwarantannę, skan formatu i ACL przy każdym pobraniu", async () => {
    const { t, ids, as, file } = await setup(); const attachment = await file();
    await expect(as(ids.owner).action(fn("fileActions:download"), { id: attachment.id })).rejects.toThrow("oczekuje");
    expect((await as(ids.owner).action(fn("fileActions:scan"), { id: attachment.id })).clean).toBe(true);
    const output = await as(ids.owner).action(fn("fileActions:download"), { id: attachment.id }); expect(output).not.toHaveProperty("url"); expect(atob(output.base64)).toContain("Test bez danych");
    await expect(as(ids.other).action(fn("fileActions:download"), { id: attachment.id })).rejects.toThrow("brak dostępu");
    await expect(as(ids.other).query(fn("files:list"), { recordId: ids.record })).rejects.toThrow("brak dostępu");
    await as(ids.owner).mutation(fn("files:remove"), { id: attachment.id }); expect(await t.run(ctx => ctx.storage.get(attachment.storageId))).toBeNull();
  });
  it("odrzuca aktywny PDF oraz sygnaturę testową", async () => {
    const { ids, as, file } = await setup();
    for (const [body, type] of [["EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "text/plain"], ["%PDF-1.7 /JavaScript payload", "application/pdf"]]) {
      const attachment = await file(body, type); expect((await as(ids.owner).action(fn("fileActions:scan"), { id: attachment.id })).clean).toBe(false);
      await expect(as(ids.owner).action(fn("fileActions:download"), { id: attachment.id })).rejects.toThrow("odrzucony");
    }
  });
  it("nie pozwala zmienić załączników przyjętego wniosku ani tworzyć aliasu cudzego pliku", async () => {
    const { t, ids, as, file } = await setup(); const attachment = await file();
    await expect(as(ids.other).mutation(fn("files:quarantine"), { recordId: ids.otherRecord, storageId: attachment.storageId, name: "alias.txt" })).rejects.toThrow("innego dokumentu");
    await t.run(ctx => ctx.db.patch(ids.record, { kind: "application", status: "submitted" }));
    await expect(as(ids.owner).mutation(fn("files:remove"), { id: attachment.id })).rejects.toThrow("niezmienne");
    await expect(as(ids.owner).mutation(fn("files:generateUploadUrl"), { recordId: ids.record })).rejects.toThrow("niezmienne");
    await expect(as(ids.owner).mutation(fn("files:quarantine"), { recordId: ids.record, storageId: attachment.storageId, name: "changed.txt" })).rejects.toThrow("niezmienne");
  });
  it("sprawdza cały import i deduplikuje poprawny wsad", async () => {
    const { t, ids, as } = await setup();
    const good = { title: "Nowa wiedza", summary: "Wystarczająco szczegółowy opis demonstracyjny", kind: "report", rights: "CC BY 4.0" };
    const invalid = await as(ids.admin).mutation(fn("knowledge:importData"), { text: JSON.stringify([good, { title: "brak opisu" }]), format: "json" });
    expect(invalid.count).toBe(0); expect(await t.run(ctx => ctx.db.query("knowledge").collect())).toHaveLength(0);
    const first = await as(ids.admin).mutation(fn("knowledge:importData"), { text: JSON.stringify([good]), format: "json" });
    const repeated = await as(ids.admin).mutation(fn("knowledge:importData"), { text: JSON.stringify([good]), format: "json" });
    expect(first.count).toBe(1); expect(repeated.duplicate).toBe(true); expect(repeated.ids).toEqual(first.ids);
    await expect(as(ids.owner).mutation(fn("knowledge:importData"), { text: JSON.stringify([good]), format: "json" })).rejects.toThrow("uprawnień");
    expect(await t.query(fn("knowledge:list"), {})).toHaveLength(0);
  });
  it("publikacja nowej wersji zachowuje wcześniejszą do zatwierdzenia i oznacza przypięte Karty", async () => {
    const { t, ids, as } = await setup();
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: { title: "Kręgi sąsiedzkie", summary: "Spotkania społeczne dla samotnych seniorów", rights: "CC BY 4.0", kind: "innovation" } });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "review" }); await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "publish" }); await completeIndex(t, id);
    const card = await t.run(ctx => ctx.db.insert("records", { kind: "card", title: "Karta przypięta", ownerId: ids.owner, memberIds: [], status: "approved", version: 1, data: { innovationId: id, innovationVersion: 1 }, createdAt: Date.now(), updatedAt: Date.now() }));
    const next = await as(ids.admin).mutation(fn("knowledge:save"), { id, data: { summary: "Zmieniony opis warunków spotkań dla seniorów" } }); expect(next).not.toBe(id);
    expect((await t.query(fn("knowledge:list"), {})).map((r: any) => r._id)).toContain(id);
    await as(ids.admin).mutation(fn("knowledge:transition"), { id: next, action: "review" }); await as(ids.admin).mutation(fn("knowledge:transition"), { id: next, action: "publish" }); expect((await t.query(fn("knowledge:list"), {})).map((r: any) => r._id)).toContain(id); await completeIndex(t, next);
    const pinned = await t.run(ctx => ctx.db.get(card)); expect(pinned!.data.innovationId).toBe(id); expect(pinned!.data.sourceReviewRequired).toBe(true);
    expect((await t.query(fn("knowledge:list"), {})).map((r: any) => r._id)).toEqual([next]);
    await as(ids.admin).mutation(fn("knowledge:transition"), { id: next, action: "withdraw" }); expect(await t.query(fn("knowledge:list"), {})).toHaveLength(0);
  });
  it("wycofane źródło znika natychmiast i nie daje się przywrócić samą publikacją materiału", async () => {
    const { t, ids, as } = await setup();
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: { title: "Opis źródłowy", summary: "Źródło warunków społecznego mikrotestu", rights: "CC BY 4.0", kind: "report" } });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "review" }); await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "publish" }); await completeIndex(t, id);
    const row: any = await t.run(ctx => ctx.db.get(id)); const sourceId = row.sourceIds[0];
    await expect(as(ids.owner).mutation(fn("knowledge:withdrawSource"), { sourceId })).rejects.toThrow("uprawnień");
    const event = await as(ids.admin).mutation(fn("knowledge:withdrawSource"), { sourceId });
    expect(await t.query(fn("knowledge:list"), {})).toHaveLength(0);
    await t.mutation(fn("knowledge:invalidateSourceBatch"), { sourceId, corpusVersion: event.corpusVersion });
    await expect(as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "restore" })).rejects.toThrow("osobnej");
    await as(ids.admin).mutation(fn("knowledge:restoreSource"), { sourceId, reason: "Zweryfikowano poprawność i zakres materiału." });
    await as(ids.admin).mutation(fn("knowledge:transition"), { id, action: "restore" }); await completeIndex(t, id); expect(await t.query(fn("knowledge:list"), {})).toHaveLength(1);
  });
  it("filtr rodzaju działa przed limitem, a strony nie pomijają kolejnych materiałów", async () => {
    const { t, ids, as } = await setup();
    const id = await as(ids.admin).mutation(fn("knowledge:save"), { data: { title: "Materiał biblioteki", summary: "Wystarczająco szczegółowy materiał testowy", rights: "CC BY 4.0", kind: "innovation" } });
    await t.run(async ctx => {
      const source: any = await ctx.db.get(id); const { _id, _creationTime, ...base } = source;
      await ctx.db.patch(base.sourceIds[0], { status: "published" });
      await ctx.db.patch(id, { status: "published", publishedScope: "public:published" });
      for (let i = 0; i < 80; i++) await ctx.db.insert("knowledge", { ...base, status: "published", publishedScope: "public:published", stableId: `bulk-${i}`, title: `Innowacja ${i}` });
      await ctx.db.insert("knowledge", { ...base, status: "published", publishedScope: "public:published", stableId: "course-last", kind: "course", title: "Kurs po osiemdziesięciu innowacjach" });
    });
    expect(await t.query(fn("knowledge:list"), { type: "course" })).toHaveLength(1);
    const course = await t.query(fn("knowledge:page"), { type: "course", paginationOpts: { cursor: null, numItems: 10 } }); expect(course.page).toHaveLength(1); expect(course.isDone).toBe(true);
    const first = await t.query(fn("knowledge:page"), { paginationOpts: { cursor: null, numItems: 10 } });
    const second = await t.query(fn("knowledge:page"), { paginationOpts: { cursor: first.continueCursor, numItems: 10 } });
    expect(first.hasMore).toBe(true); expect(second.page).toHaveLength(10); expect(second.page.map((r: any) => r._id).some((id: string) => first.page.some((r: any) => r._id === id))).toBe(false);
  });
  it("eksport pilotażu nie omija projekcji prywatnej Karty i historii", async () => {
    const { t, ids, as } = await setup();
    const pilot = await t.run(async ctx => {
      const id = await ctx.db.insert("records", { kind: "pilot", title: "Test", ownerId: ids.owner, memberIds: [ids.other], status: "running", version: 1, data: { tasks: "Zadanie publiczne", cardSnapshot: { secret: "PRIVATE CARD" } }, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.insert("revisions", { recordId: id, version: 1, title: "Test", status: "draft", data: { cardSnapshot: { secret: "OLD PRIVATE" } }, actorId: ids.owner, createdAt: Date.now() });
      return id;
    });
    const tester = await as(ids.other).query(fn("operations:exportRecord"), { id: pilot });
    expect(tester.record.data).not.toHaveProperty("cardSnapshot"); expect(tester.revisions).toEqual([]); expect(tester.sources).toEqual([]);
    expect((await as(ids.owner).query(fn("operations:exportRecord"), { id: pilot })).record.data.cardSnapshot.secret).toBe("PRIVATE CARD");
  });
  it("usuwa wyłącznie wskazany prywatny obszar i pochodne pliki, pozostawiając konto i cudzą sprawę", async () => {
    const { t, ids, as, file } = await setup(); const attachment = await file();
    const privateKnowledge = await t.run(async ctx => {
      const source = await ctx.db.insert("sources", { title: "Prywatny szkic", url: "/private-source", publisher: "Autor", retrievedAt: Date.now(), geography: "Prywatne", rights: "Do redakcji", reviewAt: Date.now() + 86400000, hash: "private", version: 1, status: "draft", demo: true, body: "Prywatny oryginał" });
      const knowledge = await ctx.db.insert("knowledge", { stableId: "private-owned", version: 1, status: "draft", kind: "report", title: "Prywatny szkic", summary: "Prywatny materiał do redakcji", body: "Prywatny oryginał", tags: [], problemTags: [], audienceTags: [], sourceIds: [source], requirements: [], evidenceLevel: "concept", demo: true, searchText: "Prywatny oryginał", publishedScope: "private:draft", ownerId: ids.owner, createdAt: Date.now() });
      const chunk = await ctx.db.insert("knowledgeChunks", { knowledgeId: knowledge, stableId: "private-owned", version: 1, ordinal: 0, locator: "fragment 1", text: "Prywatny fragment", hash: "private", sourceIds: [source], embedding: [1, ...Array(1535).fill(0)], embeddingModel: "test", searchText: "Prywatny fragment", retrievalScope: "private:draft", publishedScope: "private:draft" });
      return { source, knowledge, chunk };
    });
    await expect(as(ids.owner).mutation(fn("privacy:eraseMyData"), { confirmation: "nie" })).rejects.toThrow("USUŃ MOJE DANE");
    const result = await as(ids.owner).mutation(fn("privacy:eraseMyData"), { confirmation: "USUŃ MOJE DANE" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.get(ids.record))).toBeNull(); expect(await t.run(ctx => ctx.db.get(ids.otherRecord))).not.toBeNull();
    expect(await t.run(ctx => ctx.storage.get(attachment.storageId))).toBeNull(); expect(await t.run(ctx => ctx.db.get(ids.owner))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.get(privateKnowledge.knowledge))).toBeNull(); expect(await t.run(ctx => ctx.db.get(privateKnowledge.chunk))).toBeNull(); expect(await t.run(ctx => ctx.db.get(privateKnowledge.source))).toBeNull();
    expect((await t.run(ctx => ctx.db.get(result.jobId)) as any)?.status).toBe("completed");
  });
  it("odmawia resetu poza projektem demo i nie usuwa tabel tożsamości", async () => {
    const { t } = await setup(); vi.stubEnv("APP_ENV", "production"); vi.stubEnv("APP_PROJECT", "splot-hubmi");
    await expect(t.mutation(fn("demoReset:clearBatch"), { confirmation: "RESET SPLOT DEMO", table: "records" })).rejects.toThrow("Reset wymaga");
    vi.stubEnv("APP_ENV", "demo");
    await expect(t.mutation(fn("demoReset:clearBatch"), { confirmation: "wrong", table: "records" })).rejects.toThrow("Reset wymaga");
    await expect(t.mutation(fn("demoReset:clearBatch"), { confirmation: "RESET SPLOT DEMO", table: "users" })).rejects.toThrow("Tabela nie należy");
    expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(3);
  });
});
