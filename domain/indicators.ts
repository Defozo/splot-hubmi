export type RegionalIndicator = { name: string; territory: string; year: number; unit: string; value: number; latitude?: number; longitude?: number; note?: string };
export function validateIndicators(input: unknown): RegionalIndicator[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error("Mapa wymaga od 1 do 100 wskaźników w metadata.indicators.");
  return input.map(row => {
    if (!row || ![row.name, row.territory, row.unit].every(v => typeof v === "string" && v.trim().length > 0 && v.length <= 200) || !Number.isInteger(row.year) || row.year < 1900 || row.year > 2100 || typeof row.value !== "number" || !Number.isFinite(row.value)) throw new Error("Każdy wskaźnik wymaga nazwy, terytorium, roku, jednostki i liczbowej wartości.");
    if ((row.latitude === undefined) !== (row.longitude === undefined) || (row.latitude !== undefined && (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) || row.latitude < -90 || row.latitude > 90 || row.longitude < -180 || row.longitude > 180))) throw new Error("Współrzędne wskaźnika muszą zawierać poprawną szerokość i długość geograficzną.");
    return { name: row.name.trim(), territory: row.territory.trim(), year: row.year, unit: row.unit.trim(), value: row.value, ...(row.latitude !== undefined ? { latitude: row.latitude, longitude: row.longitude } : {}), ...(row.note ? { note: String(row.note).slice(0, 2000) } : {}) };
  });
}
export const demoIndicators: RegionalIndicator[] = [
  { name: "Pomysły w syntetycznym scenariuszu", territory: "Kraków", year: 2026, unit: "fikcyjne pomysły", value: 8, latitude: 50.06, longitude: 19.94, note: "Wartość wymyślona do sprawdzenia interfejsu. Nie pochodzi od mieszkańców ani ROPS." },
  { name: "Pomysły w syntetycznym scenariuszu", territory: "Tarnów", year: 2026, unit: "fikcyjne pomysły", value: 5, latitude: 50.01, longitude: 20.99, note: "Wartość wymyślona do sprawdzenia interfejsu. Nie pochodzi od mieszkańców ani ROPS." },
  { name: "Pomysły w syntetycznym scenariuszu", territory: "Nowy Sącz", year: 2026, unit: "fikcyjne pomysły", value: 12, latitude: 49.62, longitude: 20.70, note: "Wartość wymyślona do sprawdzenia interfejsu. Nie pochodzi od mieszkańców ani ROPS." },
];
