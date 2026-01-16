"use client";

import { useMemo } from "react";
import BoardView from "../../../frontend-scripts/Board/BoardView";
import PlayerListView from "../../../frontend-scripts/Board/playerListView";
import { useLobby } from "../../../frontend-scripts/components/lobby/LobbySocketContext";
import { useSession } from "next-auth/react";
import GameLobbyHeader from "../../../frontend-scripts/components/GameLobbyHeader";
import GameChatBar from "./GameChatBar";
import { isGameStarted } from "../../../../app/gameLogic/gameState";


export default function TableClient({ lobbyId }: { lobbyId: string }) {
  const { data: session, status } = useSession();
  const userName = session?.user?.name ?? null;
  const { lobbies, myLobbyId, sitInLobby, myName, canChat, connected } = useLobby();


  const lobby = useMemo(
    () => lobbies.find((l) => l.id === lobbyId),
    [lobbies, lobbyId]
  );

  const lobbyPlayerNames = lobby?.players ?? [];
  const playerCount = lobbyPlayerNames.length;
  const gameStarted = isGameStarted(lobby);
  const isInLobby = myLobbyId === lobbyId;
  const isSeated = lobbyPlayerNames.includes(myName);
  const showSitButton = Boolean(lobby && isInLobby && !isSeated && !gameStarted && playerCount < 7);
  const sitDisabled = !canChat || !connected;


  const mySeat = null; // TODO
  const myElo = null;  // TODO

  const playersForView = lobbyPlayerNames.map((name) => ({ name }));
  
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

      {/* CONTENT ROW (left main + right chat) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 0,
          padding: 0,
          alignItems: "stretch",
        }}
      >
        {/* LEFT: Board + players */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <div style={{ height: "100%", color: "white" }}>
            <BoardView playerCount={playerCount} />

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <PlayerListView
                playerCount={playerCount}
                players={playersForView}
                showSitButton={showSitButton}
                sitDisabled={sitDisabled}
                onSit={showSitButton ? () => sitInLobby(lobbyId) : undefined}
              />

            </div>

            {/* (optional debug)
            <div style={{ marginTop: 10, opacity: 0.8 }}>
              You are in: {myLobbyId ?? "none"}
            </div>
            */}
          </div>
        </div>

        {/* RIGHT: Chat */}
        <aside
          style={{
            width: 1200,
            flexShrink: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <GameChatBar lobbyId={lobbyId} gameStarted={gameStarted} mySeat={mySeat} myElo={myElo} />
          </div>
        </aside>
      </div>
    </div>
  );
}
