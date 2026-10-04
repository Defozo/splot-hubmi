import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ profile(params) { return { name: String(params.name || "Użytkownik"), email: String(params.email).trim().toLowerCase() }; } })],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const db: any = ctx.db;
      const existing = await db.query("profiles").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique();
      if (!existing) {
        const user = await ctx.db.get(userId);
        await db.insert("profiles", { userId, name: user?.name || "Użytkownik", role: "resident", permissions: [] });
      }
    },
  },
});
