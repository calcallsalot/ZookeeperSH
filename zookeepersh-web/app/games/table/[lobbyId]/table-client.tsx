"use client";

import { useMemo } from "react";
import BoardView from "../../../frontend-scripts/Board/BoardView";
import { useLobby } from "../../../frontend-scripts/components/lobby/LobbySocketContext";
import { useSession } from "next-auth/react";
import GameLobbyHeader from "../../../frontend-scripts/components/GameLobbyHeader";

export default function TableClient({ lobbyId }: { lobbyId: string }) {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? null;
  const { lobbies, myLobbyId } = useLobby();

  const lobby = useMemo(() => lobbies.find((l) => l.id === lobbyId), [lobbies, lobbyId]);
  const playerCount = lobby?.players?.length ?? 7;

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

      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ minHeight: "100vh", background: "#141414", color: "white", padding: 18 }}>
          <div style={{ fontFamily: "var(--font-comfortaa)", fontWeight: 900, fontSize: 18 }}>
            Lobby: {lobbyId}
          </div>
      
          <div style={{ marginTop: 10, opacity: 0.8, fontFamily: "var(--font-comfortaa)" }}>
            You are in: {myLobbyId ?? "none"}
          </div>

          <div style={{ marginTop: 18 }}>
            <BoardView playerCount={playerCount} />
          </div>

          <div style={{ marginTop: 18, fontFamily: "var(--font-comfortaa)" }}>
            <div style={{ fontWeight: 900 }}>Players</div>
            <div style={{ marginTop: 8 }}>
              {(lobby?.players ?? []).length ? (
                (lobby?.players ?? []).map((p) => <div key={p}>• {p}</div>)
              ) : (
                <div style={{ opacity: 0.7 }}>Lobby not loaded yet or no players list.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
