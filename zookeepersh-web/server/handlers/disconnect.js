function registerDisconnectHandlers({
  io,
  socket,
  online,
  playerLobby,
  removePresenceSocket,
  onlineList,
  hasPresenceInLobby,
  lobbies,
  closeLobby,
  lobbyListPublic,
}) {
  socket.on("disconnect", (reason) => {
    console.log("[io] disconnected:", socket.id, reason);

    const player = online.get(socket.id);
    const presenceKey = player?.presenceKey;
    const playerName = player?.name;
    const lobbyInfo = playerLobby.get(socket.id);
    playerLobby.delete(socket.id);
    if (presenceKey) {
      removePresenceSocket(presenceKey, socket.id);
    }

    // Remove from presence and broadcast update
    online.delete(socket.id);
    io.emit("onlinePlayers:update", onlineList());
    // sloppiest fucking code ever we're gonna have to fix this
    if (lobbyInfo?.lobbyId && lobbyInfo.role === "player" && presenceKey) {
      const stillInLobby = hasPresenceInLobby(
        presenceKey,
        lobbyInfo.lobbyId,
        "player"
      );
      if (!stillInLobby) {
        const lobby = lobbies.get(lobbyInfo.lobbyId);
        if (lobby) {
          const isGameStarted = (lobby.status ?? "open") === "in_game";
          if (isGameStarted) return;

          const currentPlayers = lobby.players ?? [];
          const nextPlayers = playerName
            ? currentPlayers.filter((name) => name !== playerName)
            : currentPlayers;
          if (nextPlayers.length !== currentPlayers.length) {
            if (nextPlayers.length === 0) {
              closeLobby(lobbyInfo.lobbyId, "no-seated-players");
            } else {
              lobbies.set(lobbyInfo.lobbyId, { ...lobby, players: nextPlayers });
              io.emit("lobbies:update", lobbyListPublic());
            }
          }
        }
      }
    }
  });
}

module.exports = { registerDisconnectHandlers };
