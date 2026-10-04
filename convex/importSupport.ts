import { internalQuery } from "./_generated/server";
import { requirePermission } from "./lib/acl";
export const authorize = internalQuery({ args: {}, handler: async ctx => { const { userId } = await requirePermission(ctx, "knowledge:edit"); return { userId }; } });
