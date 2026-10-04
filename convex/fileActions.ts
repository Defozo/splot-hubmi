"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
function checkContent(bytes: Uint8Array, type: string) {
  const text = new TextDecoder().decode(bytes);
  if (text.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE") || /<script\b|javascript:|<iframe\b/i.test(text)) return { clean: false, detail: "Zablokowano aktywną treść lub sygnaturę testową." };
  let valid = false;
  if (["text/plain", "text/csv", "application/json"].includes(type)) { valid = !bytes.includes(0); if (type === "application/json") try { JSON.parse(text); } catch { valid = false; } }
  if (type === "application/pdf") valid = text.startsWith("%PDF-") && !/\/(JavaScript|JS|Launch|OpenAction|EmbeddedFile|RichMedia)\b/i.test(text);
  if (type === "image/png") valid = bytes[0] === 137 && text.slice(1, 4) === "PNG";
  if (type === "audio/webm") valid = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (type === "audio/wav" || type === "audio/x-wav") valid = text.startsWith("RIFF") && text.slice(8, 12) === "WAVE";
  if (type === "audio/mpeg") valid = text.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (!type.startsWith("audio/") && bytes.length > 5 * 1024 * 1024) valid = false;
  return { clean: valid, detail: valid ? "content-policy-v1: format, rozmiar i aktywna treść sprawdzone. Nie zastępuje produkcyjnego skanera antywirusowego." : "Niedozwolony format, rozmiar, aktywny PDF lub niezgodna sygnatura pliku." };
}
export const scan = action({ args: { id: v.id("files") }, handler: async (ctx, args): Promise<any> => {
  const { userId, file } = await ctx.runQuery(internal.files.authorize, { fileId: args.id });
  if (!file || file.ownerId !== userId) throw new Error("Tylko autor może udostępnić przesłany plik.");
  const blob = await ctx.storage.get(file.storageId); if (!blob) throw new Error("Plik nie został poprawnie przesłany.");
  const result = checkContent(new Uint8Array(await blob.arrayBuffer()), file.mimeType);
  await ctx.runMutation(internal.files.scanResult, { id: args.id, actorId: userId, ...result }); return result;
} });
export const download = action({ args: { id: v.id("files") }, handler: async (ctx, args): Promise<any> => {
  const { file } = await ctx.runQuery(internal.files.authorize, { fileId: args.id });
  if (!file || file.status !== "clean") throw new Error("Plik oczekuje na sprawdzenie lub został odrzucony.");
  const blob = await ctx.storage.get(file.storageId); if (!blob) throw new Error("Plik jest niedostępny.");
  // No durable public storage URL is returned. Each download rechecks the object ACL.
  return { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: file.mimeType, name: file.name };
} });
