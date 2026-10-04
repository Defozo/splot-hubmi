import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function guard(confirmation: string) { if (process.env.APP_ENV !== "demo" || process.env.APP_PROJECT !== "splot-hubmi" || confirmation !== "RESET SPLOT DEMO") throw new Error("Reset wymaga dedykowanego środowiska demo i potwierdzenia RESET SPLOT DEMO."); }
const tables = ["records", "recordAccess", "revisions", "sources", "knowledge", "knowledgeChunks", "matches", "notifications", "outbox", "jobs", "audit", "files", "aiUsage", "meta"] as const;
export const reset = internalAction({ args: { confirmation: v.string() }, handler: async (ctx, args): Promise<any> => {
  guard(args.confirmation);
  for (const table of tables) { let cursor: string | undefined; do { const result: any = await ctx.runMutation(internal.demoReset.clearBatch, { confirmation: args.confirmation, table, ...(cursor ? { cursor } : {}) }); cursor = result.complete ? undefined : result.cursor; if (result.complete) break; } while (cursor); }
  return ctx.runAction(internal.seed.seed, {});
} });
export const clearBatch = internalMutation({ args: { confirmation: v.string(), table: v.string(), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  guard(args.confirmation); if (!(tables as readonly string[]).includes(args.table)) throw new Error("Tabela nie należy do danych demonstracyjnych.");
  const page = await (ctx.db.query(args.table as any) as any).paginate({ cursor: args.cursor || null, numItems: 100 });
  for (const row of page.page) {
    if (args.table === "meta" && ["staticSite", "deploymentIdentity"].includes(row.key)) continue;
    if (args.table === "files") await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  }
  return { complete: page.isDone, cursor: page.continueCursor };
} });
