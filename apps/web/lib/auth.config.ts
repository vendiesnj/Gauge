import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

// Edge-compatible config — no database adapter, used by middleware
export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
