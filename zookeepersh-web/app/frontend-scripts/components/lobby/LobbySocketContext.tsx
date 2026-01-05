"use client";

import React, { createContext, useContext } from "react";
import { useLobbySocket } from "./useLobbySocket";

type LobbySocketValue = ReturnType<typeof useLobbySocket>;

const LobbySocketCtx = createContext<LobbySocketValue | null>(null);

export function LobbySocketProvider({
  userName,
  children,
}: {
  userName?: string | null;
  children: React.ReactNode;
}) {
  const value = useLobbySocket(userName ?? undefined);
  return <LobbySocketCtx.Provider value={value}>{children}</LobbySocketCtx.Provider>;
}

export function useLobby() {
  const v = useContext(LobbySocketCtx);
  if (!v) throw new Error("useLobby must be used within <LobbySocketProvider>");
  return v;
}
