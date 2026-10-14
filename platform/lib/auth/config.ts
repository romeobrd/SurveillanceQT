// Configuration Auth.js (v5) : identifiants + mot de passe, session JWT dans un cookie httpOnly.
// Le jeton ne contient que l'identifiant de l'utilisateur ; rôle et entreprise sont relus en base.
import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { checkCredentials } from "./credentials";

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const CredentialsSchema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

// Application de bureau : servie en http sur 127.0.0.1 (jamais exposée au réseau), cookie non « Secure »
const secure =
  process.env.NODE_ENV === "production" &&
  process.env.SPACORA_EDITION !== "desktop";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  useSecureCookies: secure,
  cookies: {
    sessionToken: {
      options: { httpOnly: true, sameSite: "lax", path: "/", secure },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const result = await checkCredentials(
          parsed.data.email,
          parsed.data.password,
        );
        return result.ok ? { id: result.userId } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
