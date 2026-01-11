"use client";

import { LobbySocketProvider } from "../frontend-scripts/components/lobby/LobbySocketContext";

export default function GamesProviders({ children }: { children: React.ReactNode }) {
  return <LobbySocketProvider>{children}</LobbySocketProvider>;
}
