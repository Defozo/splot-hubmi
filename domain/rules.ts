export function moneyTotal(items: any[] = []) {
  let totalGrosz = 0, complete = true;
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) throw new Error("Nieprawidłowa ilość w kosztorysie.");
    if (item.unitPriceGrosz == null || item.unitPriceGrosz === "") { complete = false; continue; }
    if (!Number.isInteger(item.unitPriceGrosz) || item.unitPriceGrosz < 0) throw new Error("Stawki muszą być nieujemnymi kwotami w groszach.");
    totalGrosz += Math.round(item.quantity * item.unitPriceGrosz);
  }
  if (!Number.isSafeInteger(totalGrosz)) throw new Error("Kwota przekracza dopuszczalny zakres.");
  return { totalGrosz, complete };
}
export function assertCallOpen(call: any, now: number, schemaVersion: number, budgetGrosz: number) {
  if (call.status !== "open" || now < call.data.opensAt || now >= call.data.closesAt) throw new Error("Nabór jest zamknięty. Szkic został zachowany.");
  if (schemaVersion !== call.data.schemaVersion) throw new Error("Formularz naboru został zmieniony. Sprawdź nową wersję.");
  if (!Number.isSafeInteger(budgetGrosz) || budgetGrosz < 0 || budgetGrosz > call.data.budgetLimitGrosz) throw new Error("Budżet przekracza limit naboru lub nie jest kwotą w groszach.");
}
export function assertReservation(offer: any, reservations: any[], start: number, end: number, quantity: number, revision: number, now: number) {
  if (offer.status !== "active" || revision !== offer.version || offer.data.validUntil < end || offer.data.validUntil <= now) throw new Error("Oferta jest nieaktualna, wycofana lub nieważna w okresie rezerwacji.");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isInteger(quantity) || quantity < 1) throw new Error("Nieprawidłowy termin lub liczba zasobów.");
  const events: { at: number; delta: number }[] = [{ at: start, delta: quantity }, { at: end, delta: -quantity }];
  for (const r of reservations) {
    if (r.status === "accepted" && r.data.startsAt < end && r.data.endsAt > start) {
      events.push({ at: Math.max(start, r.data.startsAt), delta: r.data.quantity });
      events.push({ at: Math.min(end, r.data.endsAt), delta: -r.data.quantity });
    }
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let used = 0;
  for (const event of events) { used += event.delta; if (used > offer.data.capacity) throw new Error("Zasób jest już zarezerwowany w tym terminie. Wybierz inny termin lub zakres."); }
}
export function contentHash(value: any): string {
  const canonical = (v: any): string => v && typeof v === "object" ? Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
  return Array.from(sha256(new TextEncoder().encode(canonical(value)))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function validateCallFields(fields: any[], values: any) {
  for (const f of fields) {
    const value = values?.[f.key];
    if (f.required && (value == null || value === "" || (f.type === "checkbox" && value !== true))) throw new Error(`Uzupełnij pole: ${f.label}.`);
    if (value != null && value !== "" && f.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`Pole ${f.label} wymaga liczby.`);
    if (value != null && ["text", "textarea"].includes(f.type) && typeof value !== "string") throw new Error(`Pole ${f.label} wymaga tekstu.`);
    if (typeof value === "string" && value.length > 20000) throw new Error("Treść pola jest zbyt długa.");
  }
}
import { sha256 } from "@oslojs/crypto/sha2";
