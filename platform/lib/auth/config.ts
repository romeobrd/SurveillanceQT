// Configuration Auth.js (v5) : identifiants + mot de passe, session JWT dans un cookie httpOnly.
// Le jeton ne contient que l'identifiant de l'utilisateur ; rôle et entreprise sont relus en base.
import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import {
  clearAttempts,
  findUserForLogin,
  getAttemptState,
  registerFailure,
} from "@/lib/db/auth-store";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { attemptKey, isLocked } from "./rate-limit";

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const CredentialsSchema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

const secure = process.env.NODE_ENV === "production";

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
        const { email, password } = parsed.data;
        const key = attemptKey(email);

        if (isLocked(await getAttemptState(key), new Date())) return null;

        const user = await findUserForLogin(email);
        const valid = user
          ? await verifyPassword(user.passwordHash, password)
          : false;
        if (!user) await verifyAgainstDummy(password);
        if (!user || !valid) {
          await registerFailure(key);
          return null;
        }
        await clearAttempts(key);
        return { id: user.id };
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
