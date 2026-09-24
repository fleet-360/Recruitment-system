import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearFails, isLocked, recordFail } from "@/lib/login-limit";
import { logAccess } from "@/lib/access-log";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; companyId: string | null } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" }, // required by the credentials provider
  pages: { signIn: "/login" },
  providers: [
    // Office users. Offline access keeps a refresh token for Google Calendar invites.
    Google({
      allowDangerousEmailAccountLinking: true, // safe: invite-only (see signIn), Google verifies the email
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
    // Business users.
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = isLocked(email) ? null : await db.user.findUnique({ where: { email } }); // locked: same message as a wrong password
        const ok = !!user?.passwordHash && user.isActive && (await bcrypt.compare(parsed.data.password, user.passwordHash));
        await logAccess(ok ? "login_ok" : "login_fail", { email, userId: user?.id }, request.headers);
        if (!ok) {
          recordFail(email);
          return null;
        }
        clearFails(email);
        return user;
      },
    }),
  ],
  events: {
    // Credentials sign-ins are logged in authorize (with IP); Google ones here.
    async signIn({ user, account }) {
      if (account?.provider === "google") await logAccess("login_ok", { email: user.email ?? undefined, userId: user.id });
    },
  },
  callbacks: {
    // Invite-only: Google sign-in works only for users an admin already created.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;
      const existing = await db.user.findUnique({ where: { email: user.email.toLowerCase() } });
      return !!existing?.isActive;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const u = await db.user.findUniqueOrThrow({ where: { email: user.email.toLowerCase() } });
        token.uid = u.id;
        token.role = u.role;
        token.companyId = u.companyId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.user.companyId = (token.companyId as string | null) ?? null;
      return session;
    },
  },
});
