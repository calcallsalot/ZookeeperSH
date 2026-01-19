function registerGameChatHandlers({
  io,
  socket,
  lobbies,
  playerLobby,
  online,
  gameChatCol,
  gameRoom,
}) {
  // lobby chat by {lobbyId}
  socket.on("game_chat:join", async ({ lobbyId }) => {
    if (!lobbyId || typeof lobbyId !== "string") return;

    socket.join(gameRoom(lobbyId));

    const history = await gameChatCol
      .find({ lobbyId })
      .sort({ ts: 1 })
      .limit(250)
      .toArray();

    socket.emit("game_chat:history", {
      lobbyId,
      messages: history.map((m) => ({
        id: m._id?.toString?.() ?? undefined,
        lobbyId: m.lobbyId,
        kind: m.kind,
        text: m.text,
        userName: m.userName ?? null,
        seat: m.seat ?? null,
        elo: m.elo ?? null,
        ts: m.ts,
      })),
    });
  });
  // Send user message
  socket.on("game_chat:send", async ({ lobbyId, text }) => {
    if (!lobbyId || typeof lobbyId !== "string") return;
    if (typeof text !== "string") return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const player = online.get(socket.id);
    const finalName = player?.name ?? "Unknown";
    const finalElo = player?.elo ?? null;

    const lobby = lobbies.get(lobbyId);
    const started = lobby?.status === "in_game";
    const lobbyInfo = playerLobby.get(socket.id);
    const observer =
      lobbyInfo?.lobbyId === lobbyId && lobbyInfo.role === "observer";
    const seat =
      started && !observer ? lobby?.seatByName?.[finalName] ?? null : null;

    const msg = {
      lobbyId,
      kind: "user",
      text: trimmed,
      userName: finalName,
      elo: finalElo,
      seat, // becomes a number only after startGameIfReady sets seatByName and also !observer
      observer,
      ts: Date.now(),
      createdAt: new Date(),
    };

    const res = await gameChatCol.insertOne(msg);

    io.to(gameRoom(lobbyId)).emit("game_chat:new", {
      id: res.insertedId.toString(),
      ...msg,
    });
  });
}

module.exports = { registerGameChatHandlers };
