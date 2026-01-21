function ensureGameState(lobby) {
  if (lobby.gameState) return;

  const names = lobby.players ?? [];
  const players = names.map((name, idx) => ({
    seat: idx + 1,
    name,
    alive: true,
  }));

  const votes = {};
  for (const p of players) votes[p.seat] = null;

  lobby.gameState = {
    phase: "election_nomination",
    players,
    election: {
      presidentSeat: 1,
      nominatedChancellorSeat: null,
      votes,
      revealed: false,
      passed: null,
      requiredYes: 4,
    },
  };
}

function emitGameState({ io, lobbyId, lobby, gameRoom, playerLobby }) {
  if (!lobby?.gameState) return;
  const payload = { lobbyId, gameState: lobby.gameState };

  // send to game room (if clients joined it via game chat)
  io.to(gameRoom(lobbyId)).emit("game:state", payload);

  // also send directly to anyone currently in this lobby (safe fallback)
  for (const [socketId, info] of playerLobby.entries()) {
    if (info?.lobbyId === lobbyId) io.to(socketId).emit("game:state", payload);
  }
}

function getMyName(socket, online) {
  const p = online.get(socket.id);
  return p?.name ?? null;
}

function getMySeat(lobby, socket, online) {
  const name = getMyName(socket, online);
  if (!name) return null;

  // if you set seatByName when game starts, prefer it
  const s = lobby.seatByName?.[name];
  if (typeof s === "number") return s;

  // fallback: lobby.players order
  const idx = (lobby.players ?? []).indexOf(name);
  return idx >= 0 ? idx + 1 : null;
}

function isPlayerInLobby(socketId, lobbyId, playerLobby) {
  const info = playerLobby.get(socketId);
  if (!info) return false;
  if (info.lobbyId !== lobbyId) return false;
  return info.role === "player"; // enforce only players vote
}

function nextAlivePresidentSeat(players, currentSeat) {
  const alive = (players ?? [])
    .filter((p) => p.alive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  if (alive.length === 0) return currentSeat;
  for (const s of alive) if (s > currentSeat) return s;
  return alive[0];
}

function registerElectionHandlers({ io, socket, lobbies, online, playerLobby, gameRoom }) {
  socket.on("game:state:request", ({ lobbyId } = {}) => {
    if (typeof lobbyId !== "string") return;
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    ensureGameState(lobby);
    emitGameState({ io, lobbyId, lobby, gameRoom, playerLobby });
  });

  socket.on("game:nominateChancellor", ({ lobbyId, chancellorSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (gs.phase !== "election_nomination") return;
    if (mySeat !== gs.election.presidentSeat) return;

    const target = Number(chancellorSeat);
    if (!Number.isFinite(target)) return;
    if (target === gs.election.presidentSeat) return;

    const aliveSeats = gs.players.filter((p) => p.alive).map((p) => p.seat);
    if (!aliveSeats.includes(target)) return;

    gs.phase = "election_voting";
    gs.election.nominatedChancellorSeat = target;

    // reset votes
    const votes = {};
    for (const s of aliveSeats) votes[s] = null;
    gs.election.votes = votes;
    gs.election.revealed = false;
    gs.election.passed = null;

    emitGameState({ io, lobbyId, lobby, gameRoom, playerLobby });
  });

  socket.on("game:castVote", ({ lobbyId, vote } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (gs.phase !== "election_voting") return;
    if (gs.election.votes?.[mySeat] != null) return;

    const v = vote === "ja" ? "ja" : vote === "nein" ? "nein" : null;
    if (!v) return;

    gs.election.votes[mySeat] = v;

    const aliveSeats = gs.players.filter((p) => p.alive).map((p) => p.seat);
    const allIn = aliveSeats.every((s) => gs.election.votes[s] != null);

    if (!allIn) {
      emitGameState({ io, lobbyId, lobby, gameRoom, playerLobby });
      return;
    }

    const ja = aliveSeats.reduce((acc, s) => acc + (gs.election.votes[s] === "ja" ? 1 : 0), 0);
    const requiredYes = Number(gs.election.requiredYes ?? 4);
    const passed = ja >= requiredYes;

    gs.phase = "election_reveal";
    gs.election.revealed = true;
    gs.election.passed = passed;

    emitGameState({ io, lobbyId, lobby, gameRoom, playerLobby });

    // auto-advance (optional)
    setTimeout(() => {
      const l = lobbies.get(lobbyId);
      if (!l?.gameState) return;
      if (l.gameState.phase !== "election_reveal") return;

      if (l.gameState.election.passed) {
        l.gameState.phase = "legislative_president";
        emitGameState({ io, lobbyId, lobby: l, gameRoom, playerLobby });
        return;
      }

      const nextPres = nextAlivePresidentSeat(l.gameState.players, l.gameState.election.presidentSeat);
      const aliveSeats2 = l.gameState.players.filter((p) => p.alive).map((p) => p.seat);

      l.gameState.phase = "election_nomination";
      l.gameState.election.presidentSeat = nextPres;
      l.gameState.election.nominatedChancellorSeat = null;

      const votes2 = {};
      for (const s of aliveSeats2) votes2[s] = null;
      l.gameState.election.votes = votes2;

      l.gameState.election.revealed = false;
      l.gameState.election.passed = null;

      emitGameState({ io, lobbyId, lobby: l, gameRoom, playerLobby });
    }, 1200);
  });
}

module.exports = { registerElectionHandlers };
