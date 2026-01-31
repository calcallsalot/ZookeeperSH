"use client";

import { useEffect, useMemo } from "react";
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
  const { lobbies, myLobbyId, joinLobby, sitInLobby, myName, canChat, connected, socket } = useLobby();

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

  // Ensure this socket is actually registered in this lobby server-side.
  // Without this, a refresh / direct navigation can leave you “visually seated”
  // (name appears in lobby.players) but server treats the socket as not in-lobby.
  useEffect(() => {
    if (!connected) return;
    if (myLobbyId === lobbyId) return;
    joinLobby(lobbyId);
  }, [connected, joinLobby, lobbyId, myLobbyId]);

  useEffect(() => {
    if (!socket || !connected || !gameStarted) return;
    socket.emit("game:state:request", { lobbyId });
  }, [socket, connected, lobbyId, gameStarted]);

  // gameState is assumed to be attached to lobby by your socket handler
  const gameState: any = gameStarted ? (lobby as any)?.gameState ?? null : null;

  const election = gameState?.election
    ? {
        phase: gameState.phase,
        presidentSeat: gameState.election.presidentSeat,
        nominatedChancellorSeat: gameState.election.nominatedChancellorSeat,
        votes: gameState.election.votes,
      }
    : undefined;

  const legislative = gameState
    ? {
        phase: gameState.phase,
        presidentSeat: gameState.election?.presidentSeat ?? 1,
        chancellorSeat: gameState.election?.nominatedChancellorSeat ?? null,
        presidentPolicies: gameState.legislative?.presidentPolicies ?? null,
        chancellorPolicies: gameState.legislative?.chancellorPolicies ?? null,
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
        <div style={{ flex: "1 1 0", minWidth: 0, minHeight: 0 }}>
          <div style={{ height: "100%", color: "white" }}>
            <BoardView
              playerCount={playerCount}
              election={gameStarted ? election : undefined}
              legislative={gameStarted ? legislative : undefined}
              enactedPolicies={gameStarted ? gameState?.enactedPolicies ?? null : null}
              mySeat={mySeat}
              onVote={(vote) => {
                // server authoritative vote
                socket?.emit?.("game:castVote", { lobbyId, vote });
              }}
              onPresidentDiscard={(discardIndex) => {
                socket?.emit?.("game:legislative:presidentDiscard", { lobbyId, discardIndex });
              }}
              onChancellorEnact={(enactIndex) => {
                socket?.emit?.("game:legislative:chancellorEnact", { lobbyId, enactIndex });
              }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <PlayerListView
                playerCount={playerCount}
                players={playersForView}
                showSitButton={showSitButton}
                sitDisabled={sitDisabled}
                onSit={showSitButton ? () => sitInLobby(lobbyId) : undefined}
                presidentSeat={gameStarted ? election?.presidentSeat : undefined}
                chancellorSeat={gameStarted ? election?.nominatedChancellorSeat ?? undefined : undefined}
                presidentSeatTL={gameStarted ? gameState?.election?.termLockedPresidentSeat ?? undefined : undefined}
                chancellorSeatTL={gameStarted ? gameState?.election?.termLockedChancellorSeat ?? undefined : undefined}
                electionPhase={gameStarted ? gameState?.phase : undefined}
                electionVotes={gameStarted ? gameState?.election?.votes : undefined}
                electionVoteCast={gameStarted ? gameState?.election?.voteCast : undefined}
                eligibleChancellorSeats={gameStarted ? gameState?.election?.eligibleChancellorSeats : undefined}
                visibleRoleColorsBySeat={gameStarted ? gameState?.visibleRoleColorsBySeat : undefined}
                nominateEnabled={
                  Boolean(
                    gameStarted &&
                      gameState?.phase === "election_nomination" &&
                      mySeat != null &&
                      election?.presidentSeat === mySeat
                  )
                }
                onNominateChancellor={(seat) => {
                  socket?.emit?.("game:nominateChancellor", { lobbyId, chancellorSeat: seat });
                }}
              />
            </div>
          </div>
        </div>

        <aside
          style={{
            flex: "1 1 0",
            minWidth: 0,
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
