"use client";

import { useSession } from "next-auth/react";

import GameLobbyHeader from "../frontend-scripts/components/GameLobbyHeader";
import { LobbySocketProvider } from "../frontend-scripts/components/lobby/LobbySocketContext";

import SectionMain from "../frontend-scripts/section-main/SectionMain";
import SectionRight from "../frontend-scripts/section-right/SectionRight";
import SectionChatBar from "../frontend-scripts/section-chatbar/SectionChatBar";

export default function GameLobbyClient() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#141414",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <GameLobbyHeader userName={userName} status={status} />

      <LobbySocketProvider>
        <div
          className="zk-games-grid"
          style={{
            flex: 1,
            padding: 18,
            display: "grid",
            gap: 18,
            // Main | Chat | Right
            gridTemplateColumns: "minmax(0, 1fr) 360px 320px",
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          <SectionMain />
          <SectionChatBar />
          <SectionRight />
        </div>

        <style jsx global>{`
          @media (max-width: 980px) {
            .zk-games-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </LobbySocketProvider>
    </div>
  );
}
