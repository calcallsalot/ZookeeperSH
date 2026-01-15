import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

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
      return token;
    },

    async session({ session, token }) {
      // token.sub should be the user's id string
      const userId = token.sub;
      if (!userId || !session.user) return session;
      if (!ObjectId.isValid(userId)) return session;

      const client = await clientPromise;
      const db = client.db();

      const u = await db.collection("users").findOne(
        { _id: new ObjectId(userId) },
        { projection: { elo: 1 } }
      );

      (session.user as typeof session.user & { elo?: number }).elo =
        typeof u?.elo === "number" ? u.elo : 1600;

      return session;
    },
  },

});

export { handler as GET, handler as POST };
