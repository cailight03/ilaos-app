import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authorizeEmail } from "./authorization";
import { recordLogin } from "./users";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_CLIENT_ID,
      clientSecret: process.env.AUTH_CLIENT_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET ?? process.env.SESSION_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: MAX_AGE_SECONDS },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email_verified) return false;
      const account = await authorizeEmail(profile.email);
      if (!account) return false;
      await recordLogin(account.id, typeof profile.picture === "string" ? profile.picture : null);
      return true;
    },
  },
});
