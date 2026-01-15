"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { LobbySocketProvider } from "./frontend-scripts/components/lobby/LobbySocketContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log("[Providers] mounted");
  }, []);
  return (
    <SessionProvider>
      <LobbySocketProvider>{children}</LobbySocketProvider>
    </SessionProvider>
  );
}
