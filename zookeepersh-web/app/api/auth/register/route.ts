import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(); // uses DB name from MONGODB_URI
    const users = db.collection("users");

    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Ema1il already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, userId: result.insertedId.toString() });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
