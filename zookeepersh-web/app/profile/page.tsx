"use client";


import Link from "next/link";
import { useSession } from "next-auth/react";


export default function ProfilePage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? session?.user?.email ?? "Guest";


  return (
    <div style={{ minHeight: "100vh", background: "#141414", padding: 18 }}>
      <div style={{ color: "white", fontFamily: "var(--font-comfortaa)" }}>
        <h1 style={{ marginTop: 0 }}>Settings</h1>
        <p style={{ opacity: 0.8 }}>
          Signed in as: {status === "loading" ? "Loading..." : userName}
        </p>


        <Link href="/games" style={{ color: "white", textDecoration: "underline" }}>
          ← Back to Game Lobby
        </Link>
      </div>
    </div>
  );
}



