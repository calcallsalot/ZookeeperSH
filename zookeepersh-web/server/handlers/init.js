function registerInitHandlers({ socket, lobbyListPublic, onlineList, playerLobby, chatCol }) {
  // lobby chat not game for each lobby chat
  socket.on("init:get", async () => {
    socket.emit("init", {
      lobbies: lobbyListPublic(),
      onlinePlayers: onlineList(),
    });

    socket.emit("me:lobby", {
      lobbyId: playerLobby.get(socket.id)?.lobbyId ?? null,
    }); // identify playerLobby

    try {
      if (!chatCol) {
        socket.emit("chat:history", []);
        return;
      }
      const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // TTL is 24 hours so if you want 7 days change from 1 * to 7 *
      const msgs = await chatCol
        .find({ createdAt: { $gte: since } })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();

      socket.emit(
        "chat:history",
        msgs.map((m) => ({
          id: String(m._id),
          name: m.name,
          text: m.text,
          ts: m.ts ?? m.createdAt.getTime(),
        }))
      );
    } catch (e) {
      console.error("[chat] history error:", e);
      socket.emit("chat:history", []);
    }
  });
}

module.exports = { registerInitHandlers };
