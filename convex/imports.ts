"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { createHash } from "node:crypto";
import { OCR_PROMPT_VERSION, requireOcrConsent, requiresPdfOcr } from "../domain/ocr";
import { transcribePdf } from "./lib/ocr";
import { extractImportBody } from "../domain/import-text";
(globalThis as any).pdfjsWorker = { WorkerMessageHandler };

function publicIp(address: string) {
  if (address.includes(":")) return !/^(::|fe[89ab]|f[cd]|::ffff:)/i.test(address);
  const [a,b] = address.split(".").map(Number); return a !== 10 && a !== 127 && a !== 0 && a < 224 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18,19].includes(b));
}
export const importUrl = action({ args: { url: v.string(), rights: v.optional(v.string()) }, handler: async (ctx, args): Promise<any> => {
  const actor: any = await ctx.runQuery(internal.importSupport.authorize, {});
  const allowed = (process.env.ALLOWED_SOURCE_HOSTS || "rops.krakow.pl,www.rops.krakow.pl").split(",").map(h => h.trim());
  let url = new URL(args.url); let response: Response | undefined;
  for (let redirects = 0; redirects < 4; redirects++) {
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname) || isIP(url.hostname)) throw new Error("Import jest dozwolony tylko z zatwierdzonych publicznych domen HTTPS.");
    const addresses = await lookup(url.hostname, { all: true }); if (!addresses.length || addresses.some(a => !publicIp(a.address))) throw new Error("Adres źródła wskazuje niedozwoloną sieć.");
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { Accept: "text/html,text/plain,application/json" } });
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location) throw new Error("Nieprawidłowe przekierowanie."); url = new URL(location, url); continue; } break;
  }
  if (!response?.ok) throw new Error(`Źródło jest niedostępne (${response?.status || "brak odpowiedzi"}).`);
  if (!/text\/html|text\/plain|application\/json/.test(response.headers.get("content-type") || "")) throw new Error("Ten adres wymaga importu pliku PDF/CSV/JSON.");
  const reader = response.body?.getReader(); if (!reader) throw new Error("Źródło nie zawiera treści.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 2000000) { await reader.cancel(); throw new Error("Źródło przekracza limit 2 MB."); } chunks.push(value); }
  const html = Buffer.concat(chunks).toString("utf8");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g, "").trim() || url.hostname;
  const body = extractImportBody(html);
  return ctx.runMutation(internal.knowledge.imported, { actorId: actor.userId, title, body, url: url.toString(), rights: args.rights || "do weryfikacji" });
} });
export const importPdf = action({ args: { base64: v.string(), name: v.string(), sourceUrl: v.string(), rights: v.string(), allowOcr:v.optional(v.boolean()),ocrConsent:v.optional(v.boolean()),demo:v.optional(v.boolean()) }, handler: async (ctx, args): Promise<any> => {
  const actor: any = await ctx.runQuery(internal.importSupport.authorize, {});
  if (args.base64.length > 7 * 1024 * 1024) throw new Error("PDF przekracza limit 5 MB.");
  const bytes = new Uint8Array(Buffer.from(args.base64, "base64"));
  if(bytes.length>5*1024*1024)throw new Error("PDF przekracza limit 5 MB.");
  if(!args.rights.trim()||!args.sourceUrl.trim())throw new Error("Podaj źródło i prawa do przetworzenia dokumentu.");
  const content = Buffer.from(bytes).toString("latin1");
  if (!content.startsWith("%PDF-") || /\/(JavaScript|JS|Launch|OpenAction|EmbeddedFile|RichMedia)\b/.test(content)) throw new Error("Plik ma nieprawidłowy format lub aktywną zawartość.");
  const inputHash=createHash('sha256').update(bytes).digest('hex');
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const doc = await loadingTask.promise;
  const limit = Math.min(100, Number(process.env.IMPORT_PAGE_LIMIT || 50));
  if (doc.numPages > limit) {await loadingTask.destroy();throw new Error(`Import obsługuje do ${limit} stron. Podziel materiał.`);}
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i); const text = await page.getTextContent(); pages.push(`[Strona ${i}]\n${text.items.map((item: any) => item.str || "").join(" ")}`); }
  await loadingTask.destroy(); let body = pages.join("\n\n");
  let extraction:any={method:'text',pages:pages.length,inputHash};
  if(requiresPdfOcr(pages)) {
    if(!args.allowOcr||!args.ocrConsent)return {requiresOcr:true,pages:pages.length,status:'needs_ocr',message:'Co najmniej jedna strona nie ma wystarczającej warstwy tekstowej. Zaznacz zgodę na przekazanie całego PDF do OpenAI i ponów import z OCR (do 10 stron).'};
    requireOcrConsent(args.allowOcr,args.ocrConsent,pages.length);
    const reservation:any=await ctx.runMutation(internal.search.reserveAI,{sessionId:`user:${actor.userId}`,operation:'pdf_ocr',reserveUsd:.1,requireAccount:true});
    if(!reservation.allowed)throw new Error(reservation.reason);
    try {
      const result=await transcribePdf(args.base64,pages.length); body=result.body;
      await ctx.runMutation(internal.search.recordUsage,{sessionId:`user:${actor.userId}`,operation:'pdf_ocr',model:result.model,inputTokens:result.inputTokens,outputTokens:result.outputTokens,costUsd:result.costUsd,reservation:reservation.reservation});
      extraction={method:'ocr',pages:pages.length,inputHash,model:result.model,promptVersion:OCR_PROMPT_VERSION,uncertainPages:result.uncertainPages,requiresHumanReview:true,consent:'explicit_operator',consentedAt:Date.now(),costUsd:result.costUsd};
    } catch(error) {
      await ctx.runMutation(internal.search.recordUsage,{sessionId:`user:${actor.userId}`,operation:'pdf_ocr:failed_estimated_reserve',model:process.env.OCR_MODEL||'gpt-6-luna',inputTokens:0,outputTokens:0,costUsd:.1,reservation:reservation.reservation});
      throw error;
    }
  }
  const id = await ctx.runMutation(internal.knowledge.imported, { actorId: actor.userId, title: args.name, body, url: args.sourceUrl, rights: args.rights,inputHash,metadata:{extraction},demo:args.demo??false });
  return { id, pages: pages.length, status: "draft", textCharacters: body.length,extraction,message:extraction.method==='ocr'?'OCR zakończony. Porównaj każdą stronę szkicu z oryginałem przed publikacją.':'Odczytano warstwę tekstową. Materiał oczekuje na przegląd.' };
} });
