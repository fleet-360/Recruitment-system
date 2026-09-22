import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
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
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash || !user.isActive) return null;
        return (await bcrypt.compare(parsed.data.password, user.passwordHash)) ? user : null;
      },
    }),
  ],
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
