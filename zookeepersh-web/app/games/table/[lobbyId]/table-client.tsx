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

  // NOTE: this assumes your context exposes `socket`.
  // If yours is called differently, rename here.
  const { lobbies, myLobbyId, sitInLobby, myName, canChat, connected, socket } = useLobby(); // socket not defined in lobbysocketcontext.tsx

  const lobby = useMemo(() => lobbies.find((l) => l.id === lobbyId), [lobbies, lobbyId]);

  const lobbyPlayerNames = lobby?.players ?? [];
  const playerCount = lobbyPlayerNames.length;

  const gameStarted = isGameStarted(lobby);
  const isInLobby = myLobbyId === lobbyId;
  const isSeated = lobbyPlayerNames.includes(myName);

  const showSitButton = Boolean(lobby && isInLobby && !isSeated && !gameStarted && playerCount < 7);
  const sitDisabled = !canChat || !connected;

  const mySeat = useMemo(() => {
    const idx = lobbyPlayerNames.indexOf(myName);
    return idx >= 0 ? idx + 1 : null;
  }, [lobbyPlayerNames, myName]);

  const myElo = null; // TODO

  const playersForView = lobbyPlayerNames.map((name) => ({ name }));

  // gameState is assumed to be attached to lobby by your socket handler
  const gameState: any = (lobby as any)?.gameState ?? null;

  const election = gameState?.election
    ? {
        phase: gameState.phase,
        presidentSeat: gameState.election.presidentSeat,
        nominatedChancellorSeat: gameState.election.nominatedChancellorSeat,
        votes: gameState.election.votes,
      }
    : undefined;

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
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <div style={{ height: "100%", color: "white" }}>
            <BoardView
              playerCount={playerCount}
              election={election}
              mySeat={mySeat}
              onVote={(vote) => {
                // server authoritative vote
                socket?.emit?.("game:castVote", { lobbyId, vote });
              }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <PlayerListView
                playerCount={playerCount}
                players={playersForView}
                showSitButton={showSitButton}
                sitDisabled={sitDisabled}
                onSit={showSitButton ? () => sitInLobby(lobbyId) : undefined}
                presidentSeat={election?.presidentSeat}
                chancellorSeat={election?.nominatedChancellorSeat ?? undefined}
                electionPhase={gameState?.phase}
                electionVotes={gameState?.election?.votes}
              />
            </div>
          </div>
        </div>

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
