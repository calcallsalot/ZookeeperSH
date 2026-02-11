function getMyName(socket, online) {
  const p = online?.get?.(socket?.id);
  return p?.name ?? null;
}

function getMySeat(lobby, socket, online) {
  const name = getMyName(socket, online);
  if (!name) return null;

  // Prefer seatByName when present.
  const s = lobby?.seatByName?.[name];
  if (typeof s === "number") return s;

  // Fallback: lobby.players array order.
  const idx = (lobby?.players ?? []).indexOf(name);
  return idx >= 0 ? idx + 1 : null;
}

function isPlayerInLobby(socketId, lobbyId, playerLobby) {
  const info = playerLobby?.get?.(socketId);
  if (!info) return false;
  if (info.lobbyId !== lobbyId) return false;
  return info.role === "player";
}

function getAliveSeats(gameState) {
  return (gameState?.players ?? []).filter((p) => p?.alive).map((p) => p.seat);
}

function isSeatAlive(gameState, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return false;
  const p = (gameState?.players ?? []).find((x) => x?.seat === s);
  return Boolean(p?.alive);
}

module.exports = {
  getMyName,
  getMySeat,
  isPlayerInLobby,
  getAliveSeats,
  isSeatAlive,
};
