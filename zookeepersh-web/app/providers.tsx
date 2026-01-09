"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("[Providers] mounted");
  }, []);
  return <SessionProvider>{children}</SessionProvider>;
}
