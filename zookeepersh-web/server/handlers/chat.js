function registerChatHandlers({ io, socket, online, chatCol, canPlayOrChat }) {
  // chat sending
  socket.on("chat:send", async ({ text } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to chat." });
      return;
    }

    const msg = String(text ?? "").trim();
    if (!msg) return;
    if (msg.length > 300) {
      socket.emit("error:chat", { message: "Message too long (max 300 chars)." });
      return;
    }

    const player = online.get(socket.id);
    const doc = {
      name: player?.name ?? "Unknown",
      text: msg,
      ts: Date.now(),
      createdAt: new Date(), // TTL uses this
    };

    try {
      if (!chatCol) {
        socket.emit("error:chat", { message: "Chat DB not ready." });
        return;
      }

      const r = await chatCol.insertOne(doc);

      const payload = {
        id: String(r.insertedId),
        name: doc.name,
        text: doc.text,
        ts: doc.ts,
      };

      io.emit("chat:message", payload);
    } catch (e) {
      console.error("[chat] insert error:", e);
      socket.emit("error:chat", { message: "Failed to send message." });
    }
  });
}

module.exports = { registerChatHandlers };
