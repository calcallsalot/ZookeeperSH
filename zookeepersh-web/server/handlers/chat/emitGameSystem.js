function makeEmitGameSystem({ io, gameChatCol, gameRoom }) {
  return async function emitGameSystem(lobbyId, text) {
    if (!gameChatCol) return;
    if (!lobbyId || typeof lobbyId !== "string") return;

    const msg = {
      lobbyId,
      kind: "system",
      text: String(text),
      ts: Date.now(),
      createdAt: new Date(),
    };

    const res = await gameChatCol.insertOne(msg);

    io.to(gameRoom(lobbyId)).emit("game_chat:new", {
      id: res.insertedId.toString(),
      ...msg,
    });
  };
}

module.exports = { makeEmitGameSystem };
