import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
      return NextResponse.json(
        { error: "Email, password, and username required" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const emailNorm = email.trim().toLowerCase();
    const nameDisplay = name.trim();
    const nameNorm = nameDisplay.toLowerCase();
    const client = await clientPromise;
    const db = client.db(); // uses DB name from MONGODB_URI
    const users = db.collection("users");

    const existing_email = await users.findOne({ email: emailNorm });
    const existing_username = await users.findOne({ name: nameNorm });
    if (existing_username) {
      return NextResponse.json({ error: "Username already in use" }, { status: 409 });
    }

    if (existing_email) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash,
      elo: 1600,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, userId: result.insertedId.toString() });
  } catch(err: any) {
    if (err?.code === 11000) { // mongodb duplication error theres 110001 too
      return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
