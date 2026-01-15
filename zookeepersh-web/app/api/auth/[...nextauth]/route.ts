import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import clientPromise from "@/lib/mongodb";

const handler = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const client = await clientPromise;
        const db = client.db();
        const user = await db.collection("users").findOne({ email });

        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        const elo = typeof user.elo === "number" ? user.elo : 1600;
        return { id: user._id.toString(), email: user.email, name: user.name ?? undefined, elo};
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const userElo = typeof (user as { elo?: number })?.elo === "number"
          ? (user as { elo?: number }).elo
          : 1600;
        (token as { elo?: number }).elo = userElo;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const tokenElo = typeof (token as { elo?: number }).elo === "number"
          ? (token as { elo?: number }).elo
          : 1600;
        (session.user as typeof session.user & { elo?: number }).elo = tokenElo;
      }
      return session;
    },
  },

});

export { handler as GET, handler as POST };
