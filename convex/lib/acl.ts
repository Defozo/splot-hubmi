import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

export async function currentUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const profile = await ctx.db.query("profiles").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique();
  if (!profile) return null;
  return { userId, profile };
}
export async function requireUser(ctx: any) {
  const who = await currentUser(ctx);
  if (!who) throw new ConvexError("Zaloguj się, aby wykonać tę czynność.");
  return who;
}
export async function requireRole(ctx: any, roles: string[]) {
  const who = await requireUser(ctx);
  if (!roles.includes(who.profile.role)) throw new ConvexError("Nie masz uprawnień do tej czynności.");
  return who;
}
export function hasPermission(profile: any, permission: "knowledge:edit" | "trends:read") {
  return profile?.role === "admin" || (profile?.role === "operator" && profile.permissions?.includes(permission));
}
export async function requirePermission(ctx: any, permission: "knowledge:edit" | "trends:read") {
  const who = await requireUser(ctx);
  if (!hasPermission(who.profile, permission)) throw new ConvexError("Nie masz uprawnień do tej czynności.");
  return who;
}
export function isOperator(profile: any) { return ["operator", "admin"].includes(profile.role); }
export function canAccess(profile: any, userId: any, record: any) {
  return record.ownerId === userId || record.memberIds?.includes(userId) || isOperator(profile);
}
export async function requireRecord(ctx: any, id: any) {
  const who = await requireUser(ctx);
  const record = await ctx.db.get(id);
  if (!record || !canAccess(who.profile, who.userId, record)) throw new ConvexError("Nie znaleziono obiektu lub brak dostępu.");
  return { ...who, record };
}
export async function audit(ctx: any, actorId: any, action: string, entityId: string, details: any = {}) {
  await ctx.db.insert("audit", { actorId, action, entityId, details, createdAt: Date.now() });
}
export async function notify(ctx: any, userId: any, title: string, body: string, recordId?: any, key?: string) {
  const uniqueKey = key || `${recordId || "general"}:${title}:${userId}:${Date.now()}`;
  if (await ctx.db.query("notifications").withIndex("by_key", (q: any) => q.eq("key", uniqueKey)).first()) return;
  await ctx.db.insert("notifications", { userId, title, body, ...(recordId ? { recordId } : {}), key: uniqueKey, createdAt: Date.now() });
  await ctx.db.insert("outbox", { key: uniqueKey, kind: "in_app_notification", payload: { userId, title, ...(recordId ? { recordId } : {}) }, status: "delivered_in_app", createdAt: Date.now() });
}
export async function operators(ctx: any) {
  const rows = await Promise.all(["operator", "admin"].map(role => ctx.db.query("profiles").withIndex("by_role", (q: any) => q.eq("role", role)).collect()));
  return rows.flat();
}
export async function syncAccess(ctx: any, record: any) {
  const existing = await ctx.db.query("recordAccess").withIndex("by_record", (q: any) => q.eq("recordId", record._id)).collect();
  const users = new Set([record.ownerId, ...record.memberIds]);
  for (const row of existing) if (!users.has(row.userId)) await ctx.db.delete(row._id);
  const stored = new Set(existing.map((row: any) => row.userId));
  for (const userId of users) if (!stored.has(userId)) await ctx.db.insert("recordAccess", { userId, recordId: record._id, kind: record.kind });
}
