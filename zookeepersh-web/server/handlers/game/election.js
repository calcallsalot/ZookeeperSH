const {
  createInitialPolicyDeck,
  drawPolicies,
  discardPolicies,
} = require("../../../app/gameLogic/policyDeck");

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

    policyDeck: createInitialPolicyDeck(),
    enactedPolicies: { liberal: 0, fascist: 0 },
    legislative: null,
  };
}

function getSeatForSocketId(lobby, socketId, online) {
  const p = online.get(socketId);
  const name = p?.name ?? null;
  if (!name) return null;

  const s = lobby.seatByName?.[name];
  if (typeof s === "number") return s;

  const idx = (lobby.players ?? []).indexOf(name);
  return idx >= 0 ? idx + 1 : null;
}

function publicizePolicyDeck(policyDeck) {
  const drawCount = policyDeck?.drawPile?.length ?? 0;
  const discardCount = policyDeck?.discardPile?.length ?? 0;
  return { drawCount, discardCount };
}

function sanitizeGameStateForRecipient(gameState, seat, role) {
  if (!gameState) return null;

  const safe = {
    ...gameState,
    policyDeck: publicizePolicyDeck(gameState.policyDeck),
  };

  // Safe to expose: only whether a vote was cast (not which vote).
  const rawVotes = gameState?.election?.votes ?? {};
  const voteCast = {};
  for (const [k, v] of Object.entries(rawVotes)) {
    voteCast[Number(k)] = v != null;
  }

  safe.election = {
    ...gameState.election,
    voteCast,
  };

  // Hide other players' votes until reveal.
  if (gameState.phase === "election_voting") {
    const maskedVotes = {};
    for (const [k, v] of Object.entries(rawVotes)) {
      const s = Number(k);
      maskedVotes[s] = role === "player" && seat != null && s === seat ? v : null;
    }
    safe.election = {
      ...safe.election,
      votes: maskedVotes,
    };
  }

  // Hide policy hands from non-involved players.
  if (gameState.phase === "legislative_president") {
    const isPresident = role === "player" && seat === gameState?.election?.presidentSeat;
    safe.legislative = isPresident
      ? {
          presidentPolicies: gameState?.legislative?.presidentPolicies ?? null,
        }
      : null;
  } else if (gameState.phase === "legislative_chancellor") {
    const presSeat = gameState?.election?.presidentSeat;
    const chanSeat = gameState?.election?.nominatedChancellorSeat;
    const canSee = role === "player" && seat != null && (seat === presSeat || seat === chanSeat);
    safe.legislative = canSee
      ? {
          chancellorPolicies: gameState?.legislative?.chancellorPolicies ?? null,
        }
      : null;
  } else {
    // For other phases, nothing private here yet.
    safe.legislative = null;
  }

  return safe;
}

function emitGameState({ io, lobbyId, lobby, playerLobby, online }) {
  if (!lobby?.gameState) return;

  for (const [socketId, info] of playerLobby.entries()) {
    if (info?.lobbyId !== lobbyId) continue;

    const role = info.role ?? "observer";
    const seat = role === "player" ? getSeatForSocketId(lobby, socketId, online) : null;

    io.to(socketId).emit("game:state", {
      lobbyId,
      gameState: sanitizeGameStateForRecipient(lobby.gameState, seat, role),
    });
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
    if (lobby.status !== "in_game") return;
    ensureGameState(lobby);
    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:nominateChancellor", ({ lobbyId, chancellorSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

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

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:castVote", ({ lobbyId, vote } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

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
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    const ja = aliveSeats.reduce((acc, s) => acc + (gs.election.votes[s] === "ja" ? 1 : 0), 0);
    const requiredYes = Number(gs.election.requiredYes ?? 4);
    const passed = ja >= requiredYes;

    gs.phase = "election_reveal";
    gs.election.revealed = true;
    gs.election.passed = passed;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });

    // auto-advance (optional)
    setTimeout(() => {
      const l = lobbies.get(lobbyId);
      if (!l?.gameState) return;
      if (l.gameState.phase !== "election_reveal") return;

      if (l.gameState.election.passed) {
        if (!l.gameState.policyDeck) l.gameState.policyDeck = createInitialPolicyDeck();

        const drawn = drawPolicies(l.gameState.policyDeck, 3);
        l.gameState.legislative = { presidentPolicies: drawn };
        l.gameState.phase = "legislative_president";

        emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
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

      emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
    }, 1200);
  });

  socket.on("game:legislative:presidentDiscard", ({ lobbyId, discardIndex } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (gs.phase !== "legislative_president") return;
    if (mySeat !== gs.election.presidentSeat) return;

    const idx = Number(discardIndex);
    if (!Number.isFinite(idx)) return;

    const policies = gs.legislative?.presidentPolicies;
    if (!Array.isArray(policies) || policies.length !== 3) return;
    if (idx < 0 || idx >= policies.length) return;

    const [discarded] = policies.splice(idx, 1);
    discardPolicies(gs.policyDeck, [discarded]);

    gs.phase = "legislative_chancellor";
    gs.legislative = { chancellorPolicies: policies };

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:legislative:chancellorEnact", ({ lobbyId, enactIndex } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (gs.phase !== "legislative_chancellor") return;
    if (mySeat !== gs.election.nominatedChancellorSeat) return;

    const idx = Number(enactIndex);
    if (!Number.isFinite(idx)) return;

    const policies = gs.legislative?.chancellorPolicies;
    if (!Array.isArray(policies) || policies.length !== 2) return;
    if (idx < 0 || idx >= policies.length) return;

    const enacted = policies[idx];
    const discarded = policies[idx === 0 ? 1 : 0];
    discardPolicies(gs.policyDeck, [discarded]);

    if (!gs.enactedPolicies) gs.enactedPolicies = { liberal: 0, fascist: 0 };
    if (enacted === "liberal") gs.enactedPolicies.liberal += 1;
    if (enacted === "fascist") gs.enactedPolicies.fascist += 1;
    gs.lastEnactedPolicy = enacted;

    // Advance presidency after policy enactment.
    const nextPres = nextAlivePresidentSeat(gs.players, gs.election.presidentSeat);
    const aliveSeats = gs.players.filter((p) => p.alive).map((p) => p.seat);

    gs.phase = "election_nomination";
    gs.election.presidentSeat = nextPres;
    gs.election.nominatedChancellorSeat = null;

    const votes2 = {};
    for (const s of aliveSeats) votes2[s] = null;
    gs.election.votes = votes2;

    gs.election.revealed = false;
    gs.election.passed = null;

    gs.legislative = null;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });
}

module.exports = { registerElectionHandlers };
