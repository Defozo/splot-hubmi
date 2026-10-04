import { describe, expect, it } from "vitest";
import { assertReservation, contentHash, moneyTotal } from "./rules";
describe("Integralność wersji i obliczeń", () => {
  it("wiąże pełną treść z deterministycznym SHA-256", () => {
    expect(contentHash({ b: 2, a: 1 })).toBe(contentHash({ a: 1, b: 2 }));
    expect(contentHash("abc")).toMatch(/^[a-f0-9]{64}$/);
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
  it("oddziela brak ceny od zerowej ceny i liczy grosze", () => {
    expect(moneyTotal([{ quantity: 3, unitPriceGrosz: 125 }, { quantity: 2, unitPriceGrosz: 0 }])).toEqual({ totalGrosz: 375, complete: true });
    expect(moneyTotal([{ quantity: 1, unitPriceGrosz: null }])).toEqual({ totalGrosz: 0, complete: false });
    expect(() => moneyTotal([{ quantity: 2, unitPriceGrosz: 12.25 }])).toThrow("groszach");
  });
  it("liczy pojemność w odcinkach czasu i dopuszcza stykające się rezerwacje", () => {
    const offer = { version: 3, status: "active", data: { capacity: 2, validUntil: 1000 } };
    const reservations = [{ status: "accepted", data: { startsAt: 100, endsAt: 200, quantity: 1 } }, { status: "accepted", data: { startsAt: 200, endsAt: 300, quantity: 1 } }];
    expect(() => assertReservation(offer, reservations, 100, 300, 1, 3, 0)).not.toThrow();
    expect(() => assertReservation(offer, reservations, 150, 250, 2, 3, 0)).toThrow("zarezerwowany");
    expect(() => assertReservation(offer, [], 100, 300, 1, 2, 0)).toThrow("nieaktualna");
  });
});
