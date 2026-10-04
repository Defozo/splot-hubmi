import { internalMutation } from "./_generated/server";
import { notify } from "./lib/acl";
export const deliverOutbox = internalMutation({ args: {}, handler: async ctx => {
  const pending = await ctx.db.query("outbox").withIndex("by_status", q => q.eq("status", "pending")).take(100); let delivered = 0;
  for (const event of pending) {
    if (event.kind !== "watch_change") continue;
    const p = event.payload; const need: any = await ctx.db.get(p.needId);
    const corpus = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "corpusVersion")).unique();
    if (!need || !need.data.watch || need.data.quiet || need.ownerId !== p.recipientId || need.version !== p.needVersion || need.data.matchRevision !== p.matchRevision || need.data.targetCorpusVersion !== p.corpusVersion || corpus?.value !== p.corpusVersion) { await ctx.db.patch(event._id, { status: "cancelled_stale_or_consent" }); continue; }
    const duplicate = await ctx.db.query("notifications").withIndex("by_key", q => q.eq("key", event.key)).first();
    if (!duplicate) { await ctx.db.insert("notifications", { userId: p.recipientId, title: p.title, body: p.message, recordId: p.needId, key: event.key, createdAt: Date.now() }); delivered++; }
    await ctx.db.patch(event._id, { status: "delivered_in_app" });
  }
  return { delivered };
} });
export const maintenance = internalMutation({ args: {}, handler: async ctx => {
  const now = Date.now(), offers = await ctx.db.query("records").withIndex("by_kind_validity", q => q.eq("kind", "offer").lte("data.validUntil", Date.now())).collect();
  for (const offer of offers.filter(o => o.status === "active" && o.data.validUntil < now)) {
    await ctx.db.patch(offer._id, { status: "expired", updatedAt: now });
    const partnerships = (await ctx.db.query("records").withIndex("by_kind_offer", q => q.eq("kind", "partnership").eq("data.offerId", offer._id)).collect()).filter(p => p.status === "accepted");
    for (const p of partnerships) { await ctx.db.patch(p._id, { status: "conflict", updatedAt: now }); const card: any = await ctx.db.get(p.data.cardId); if (card) { await ctx.db.patch(card._id, { status: "review_required", data: { ...card.data, conflict: "Wygasła oferta zasobu" }, updatedAt: now }); await notify(ctx, card.ownerId, "Wygasła oferta partnera", "Potwierdź zasób i warunki przed kontynuowaniem pilotażu.", card._id, `expired:${offer._id}:${card._id}`); }
      const pilots = (await ctx.db.query("records").withIndex("by_kind_card", q => q.eq("kind", "pilot").eq("data.cardId", p.data.cardId)).collect()).filter(x => ["running", "recruiting"].includes(x.status));
      for (const pilot of pilots) { await ctx.db.patch(pilot._id, { status: "blocked", data: { ...pilot.data, blockReason: "Wygasła oferta zasobu" }, updatedAt: now }); for (const recipient of new Set([pilot.ownerId, ...pilot.memberIds])) await notify(ctx, recipient, "Pilotaż wymaga ponownego uzgodnienia", "Wygasła oferta partnera. Opiekun oceni dalsze działania.", pilot._id, `expired:${offer._id}:${pilot._id}:${recipient}`); }
    }
  }
  const calls = await ctx.db.query("records").withIndex("by_kind", q => q.eq("kind", "call")).collect();
  const watches = await ctx.db.query("records").withIndex("by_kind", q => q.eq("kind", "call_watch")).collect();
  for (const call of calls) {
    let title = "";
    if (call.status === "scheduled" && call.data.opensAt <= now && now < call.data.closesAt) { await ctx.db.patch(call._id, { status: "open", updatedAt: now }); title = "Otwarto obserwowany nabór"; }
    if (call.status === "open" && call.data.closesAt <= now) { await ctx.db.patch(call._id, { status: "closed", updatedAt: now }); title = "Zamknięto obserwowany nabór"; }
    if (call.status === "open" && call.data.closesAt - now > 0 && call.data.closesAt - now <= 3 * 86400000) title = "Nabór zamyka się w ciągu 3 dni";
    if (title) for (const w of watches.filter(w => w.data.callId === call._id && w.status === "active" && !w.data.quiet)) await notify(ctx, w.ownerId, title, call.title, call._id, `call:${call._id}:${title}:${w.ownerId}:${call.data.schemaVersion}`);
  }
  const meta = await ctx.db.query("meta").take(1000); for (const row of meta) if (row.value?.expiresAt && row.value.expiresAt < now) await ctx.db.delete(row._id);
} });

