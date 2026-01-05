"use client";

import { useSession } from "next-auth/react";

import GameLobbyHeader from "../frontend-scripts/components/GameLobbyHeader"; 
import { LobbySocketProvider } from "../frontend-scripts/components/lobby/LobbySocketContext";

import SectionMain from "../frontend-scripts/section-main/SectionMain";
import SectionRight from "../frontend-scripts/section-right/SectionRight";

export default function GameLobbyClient() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#141414" }}>
      <GameLobbyHeader userName={userName} status={status} /> 

      <LobbySocketProvider userName={userName}> 
        {/*<div style={{ color: "white", padding: 8, background: "crimson", borderRadius: 8 }}>
          NEW GameLobbyClient is rendering 
        </div>*/}
        <div
          style={{
            padding: 18,
            display: "grid",
            gap: 18,
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            alignItems: "start",
          }}
        >
          <SectionMain />
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
