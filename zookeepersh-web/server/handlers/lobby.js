function registerLobbyHandlers({
  io,
  socket,
  online,
  lobbies,
  playerLobby,
  canPlayOrChat,
  getPresenceLobbyInfo,
  setPresenceRoleInLobby,
  startGameIfReady,
  gameRoom,
  lobbyListPublic,
  emitGameSystem,
}) {
  // Example createLobby handler (kept)
  socket.on("lobby:create", () => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", {
        message: "Sign in required to create or join games.",
      });
      return;
    }
    const host = online.get(socket.id);
    const presenceKey = host?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);

    const hostName = host?.name ?? "Guest";

    const lobby = {
      id: lobbyId,
      name: null,
      hostName,
      players: [hostName],
      status: "open",
      createdAt: Date.now(),
    };

    lobbies.set(lobbyId, lobby);
    startGameIfReady({
      io,
      lobbies,
      lobbyId: lobbyId,
      gameRoom,
      lobbyListPublic,
      emitGameSystem,
    });

    playerLobby.set(socket.id, { lobbyId, role: "player" });

    io.emit("lobbies:update", lobbyListPublic());

    console.log("[io] created lobby:", lobby);

    socket.emit("me:lobby", { lobbyId });
    socket.emit("lobby:created", { lobbyId });
  });

  // joining lobbies
  socket.on("lobby:join", ({ lobbyId } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", {
        message: "Sign in required to create or join games.",
      });
      return;
    }

    const targetLobbyId = typeof lobbyId === "string" ? lobbyId : null;
    const lobby = targetLobbyId ? lobbies.get(targetLobbyId) : null;
    if (!lobby) {
      socket.emit("error:lobby", { message: "Lobby not found." });
      return;
    }

    const player = online.get(socket.id);
    const playerName = player?.name ?? "Guest";
    const presenceKey = player?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence && existingPresence.lobbyId !== targetLobbyId) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }

    const existingPlayers = lobby.players ?? [];
    const isAlreadyPlayer = existingPlayers.includes(playerName);
    const nextRole = isAlreadyPlayer
      ? "player"
      : existingPresence?.role ?? "observer";
    playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: nextRole });

    if (isAlreadyPlayer && presenceKey) {
      setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
    }

    socket.emit("me:lobby", { lobbyId: targetLobbyId });
  });

  socket.on("lobby:sit", ({ lobbyId } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", {
        message: "Sign in required to create or join games.",
      });
      return;
    }

    const targetLobbyId = typeof lobbyId === "string" ? lobbyId : null;
    const lobby = targetLobbyId ? lobbies.get(targetLobbyId) : null;
    if (!lobby) {
      socket.emit("error:lobby", { message: "Lobby not found." });
      return;
    }

    const player = online.get(socket.id);
    const playerName = player?.name ?? "Guest";
    const presenceKey = player?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence && existingPresence.lobbyId !== targetLobbyId) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }

    const existingPlayers = lobby.players ?? [];
    if (existingPlayers.includes(playerName)) {
      playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: "player" });
      if (presenceKey) {
        setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
      }
      socket.emit("me:lobby", { lobbyId: targetLobbyId });
      return;
    }

    if (lobby.status === "in_game" || existingPlayers.length >= 7) {
      socket.emit("error:lobby", { message: "Lobby is full." });
      return;
    }

    const nextPlayers = [...existingPlayers, playerName];
    lobbies.set(targetLobbyId, { ...lobby, players: nextPlayers });

    playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: "player" });
    if (presenceKey) {
      setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
    }

    startGameIfReady({
      io,
      lobbies,
      lobbyId: targetLobbyId,
      gameRoom,
      lobbyListPublic,
      emitGameSystem,
    });

    io.emit("lobbies:update", lobbyListPublic());
    socket.emit("me:lobby", { lobbyId: targetLobbyId });
  });
}

module.exports = { registerLobbyHandlers };
