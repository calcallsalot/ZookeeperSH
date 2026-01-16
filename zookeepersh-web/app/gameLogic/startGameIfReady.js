const { shuffle } = require("./shuffle");

function startGameIfReady({ io, lobbies, lobbyId, gameRoom, lobbyListPublic, emitGameSystem }) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  if (lobby.status === "in_game") return;

  const players = lobby.players ?? [];
  if (players.length !== 7) return;

  const seatOrder = shuffle([...players]);
  const seatByName = Object.fromEntries(seatOrder.map((name, idx) => [name, idx + 1]));

  lobbies.set(lobbyId, {
    ...lobby,
    status: "in_game",
    players: seatOrder,
    seatOrder,
    seatByName,
    startedAt: Date.now(),
  });

  io.emit("lobbies:update", lobbyListPublic());
  io.to(gameRoom(lobbyId)).emit("game:started", { lobbyId, seatByName, seatOrder });

  if (emitGameSystem) emitGameSystem(lobbyId, "The game begins").catch(() => {});
}

module.exports = { startGameIfReady };
