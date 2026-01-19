function registerPresenceHandlers({ io, socket, online, addPresenceSocket, removePresenceSocket, onlineList }) {
  // Client tells servger who they are
  socket.on("presence:set", ({ name, elo, authed, guestId } = {}) => {
    const prev = online.get(socket.id) || { id: socket.id };
    //const isGuest = name === "Guest";
    // not needed and before with !null || it was always true
    const displayName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : prev.name ?? "Guest";
    const isAuthed = !!authed;
    let nextElo = typeof elo === "number" ? elo : prev.elo;

    if (isAuthed && typeof nextElo !== "number") {
      nextElo = 1600;
    }
    const guestKey =
      typeof guestId === "string" && guestId.trim().length > 0
        ? guestId.trim()
        : socket.id;
    const presenceKey = (
      isAuthed ? `user:${displayName}` : `guest:${guestKey}`
    ).toLowerCase();
    if (prev.presenceKey && prev.presenceKey !== presenceKey) {
      removePresenceSocket(prev.presenceKey, socket.id);
    }
    addPresenceSocket(presenceKey, socket.id);

    online.set(socket.id, {
      ...prev,
      id: socket.id,
      name: displayName,
      elo: typeof nextElo === "number" ? nextElo : null,
      authed: isAuthed,
      presenceKey,
      updatedAt: Date.now(),
    });

    io.emit("onlinePlayers:update", onlineList());
  });
}

module.exports = { registerPresenceHandlers };
