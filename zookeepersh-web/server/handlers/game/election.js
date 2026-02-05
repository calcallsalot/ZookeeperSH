const {
  createInitialPolicyDeck,
  drawPoliciesWithReshuffle,
  discardPolicies,
} = require("../../../app/gameLogic/policyDeck");
const { buildCoverRoleBySeat, buildPrivateRoleState } = require("../../../app/gameLogic/roles");
const { getRoleDescription } = require("../../game/roleDescriptions");
const {
  ensureExileState,
  isSeatExiled,
  exileSeat,
  clearAllExiles,
  clearAllClaimExileUses,
} = require("../../game/exile");

function getInvestigationTeamFromRole(role) {
  if (!role || typeof role !== "object") return null;

  // Special register rules
  if (role.id === "Grandma") return "liberal";

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return "liberal";
  if (g === "agent" || g === "dictator") return "fascist";

  const a = role.alignment;
  if (a === "liberal" || a === "fascist") return a;

  return null;
}

function teamColor(team) {
  if (team === "liberal") return "#4da3ff";
  if (team === "fascist") return "#ff4d4d";
  return null;
}

function isExileRoleId(id) {
  const x = String(id ?? "");
  return x === "Nun" || x === "Deputy" || x === "Journalist" || x === "Monk";
}

function publicizeInvestigation(lastInvestigation) {
  if (!lastInvestigation || typeof lastInvestigation !== "object") return null;

  const ts = typeof lastInvestigation.ts === "number" ? lastInvestigation.ts : undefined;
  const targetSeat =
    typeof lastInvestigation.targetSeat === "number" ? lastInvestigation.targetSeat : undefined;

  // Preferred format (extensible for future investigative powers)
  if (Object.prototype.hasOwnProperty.call(lastInvestigation, "result")) {
    const r = lastInvestigation.result;
    if (r == null) {
      return { ts, targetSeat, result: null };
    }

    if (typeof r === "object") {
      return {
        ts,
        targetSeat,
        result: r,
      };
    }

    return {
      ts,
      targetSeat,
      result: { kind: "text", text: String(r) },
    };
  }

  // Back-compat: older games stored the full investigated role.
  const team = getInvestigationTeamFromRole(lastInvestigation.role);
  return team
    ? {
        ts,
        targetSeat,
        result: { kind: "team", team },
      }
    : {
        ts,
        targetSeat,
        result: null,
      };
}

function ensureSecretState(gs) {
  if (!gs || typeof gs !== "object") return;

  const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
  if (!gs.secret || !gs.secret.roleBySeat || !gs.secret.cluesBySeat) {
    gs.secret = buildPrivateRoleState(seatCount);
  }

  // Back-fill cover roles without re-rolling real roles.
  if (!gs.secret.coverRoleBySeat && gs.secret.roleBySeat) {
    gs.secret.coverRoleBySeat = buildCoverRoleBySeat({ roleBySeat: gs.secret.roleBySeat, seatCount });
  }

  if (!gs.secret.lastInvestigationBySeat) gs.secret.lastInvestigationBySeat = {};

  // Per-investigator remembered info (used for UI coloring, etc.)
  if (!gs.secret.knownTeamsBySeat) gs.secret.knownTeamsBySeat = {};
}

function ensurePolicyDeckMeta(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.policyDeckMeta || typeof gs.policyDeckMeta !== "object") {
    gs.policyDeckMeta = {
      deckNumber: 1,
      reshuffleCount: 0,
      lastShuffleAt: Date.now(),
    };
    return;
  }

  if (!Number.isFinite(Number(gs.policyDeckMeta.deckNumber))) gs.policyDeckMeta.deckNumber = 1;
  if (!Number.isFinite(Number(gs.policyDeckMeta.reshuffleCount))) gs.policyDeckMeta.reshuffleCount = 0;
  if (!Number.isFinite(Number(gs.policyDeckMeta.lastShuffleAt))) gs.policyDeckMeta.lastShuffleAt = Date.now();
}

function maybeEmitDeckShuffle({ gs, lobbyId, emitGameSystem, shuffleCounts, isReshuffle }) {
  if (!shuffleCounts || typeof shuffleCounts !== "object") return;
  if (typeof shuffleCounts.liberal !== "number" || typeof shuffleCounts.fascist !== "number") return;

  ensurePolicyDeckMeta(gs);
  ensureExileState(gs);

  if (isReshuffle) {
    gs.policyDeckMeta.deckNumber = Number(gs.policyDeckMeta.deckNumber ?? 1) + 1;
    gs.policyDeckMeta.reshuffleCount = Number(gs.policyDeckMeta.reshuffleCount ?? 0) + 1;

    // Exile tokens are discarded after a reshuffle.
    clearAllExiles(gs);
    clearAllClaimExileUses(gs);
  }

  gs.policyDeckMeta.lastShuffleAt = Date.now();
  gs.policyDeckMeta.lastShuffleCounts = {
    liberal: shuffleCounts.liberal,
    fascist: shuffleCounts.fascist,
  };

  if (emitGameSystem) {
    emitGameSystem(
      lobbyId,
      `Deck Shuffled: ${shuffleCounts.liberal} Liberal and ${shuffleCounts.fascist} fascist policies.`
    ).catch(() => {});
  }
}

function ensureGameState(lobby) {
  if (lobby.gameState) {
    ensureExileState(lobby.gameState);
    ensureSecretState(lobby.gameState);
    ensurePolicyDeckMeta(lobby.gameState);
    return;
  }

  const names = lobby.players ?? [];
  const players = names.map((name, idx) => ({
    seat: idx + 1,
    name,
    alive: true,
    exiled: false,
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

      // Special election (after 3rd fascist policy)
      specialElectionReturnSeat: null,

      // Election tracker (chaos after 3 failed elections)
      failedElections: 0,

      // Term limits (Secret Hitler rule)
      termLockedPresidentSeat: null,
      termLockedChancellorSeat: null,
    },

    policyDeck: createInitialPolicyDeck(),
    enactedPolicies: { liberal: 0, fascist: 0 },
    legislative: null,

    policyDeckMeta: {
      deckNumber: 1,
      reshuffleCount: 0,
      lastShuffleAt: Date.now(),
    },

    // power phases (investigate/execute)
    power: null,

    // game over
    gameOver: null,
  };

  ensureExileState(lobby.gameState);
  ensureSecretState(lobby.gameState);
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

  ensureSecretState(gameState);
  ensureExileState(gameState);

  const phase = gameState.phase;
  const players = Array.isArray(gameState.players) ? gameState.players : [];

  // Safe to expose: only whether a vote was cast (not which vote).
  const rawVotes = gameState?.election?.votes ?? {};
  const voteCast = {};
  for (const [k, v] of Object.entries(rawVotes)) {
    voteCast[Number(k)] = v != null;
  }

  const election = {
    presidentSeat: Number(gameState?.election?.presidentSeat ?? 1),
    nominatedChancellorSeat: gameState?.election?.nominatedChancellorSeat ?? null,
    votes: rawVotes,
    voteCast,
    revealed: Boolean(gameState?.election?.revealed),
    passed: gameState?.election?.passed ?? null,
    requiredYes: Number(gameState?.election?.requiredYes ?? 4),

    failedElections: Number(gameState?.election?.failedElections ?? 0),

    termLockedPresidentSeat: gameState?.election?.termLockedPresidentSeat ?? null,
    termLockedChancellorSeat: gameState?.election?.termLockedChancellorSeat ?? null,
    eligibleChancellorSeats: [],
  };

  // Hide other players' votes until reveal.
  if (phase === "election_voting") {
    const maskedVotes = {};
    for (const [k, v] of Object.entries(rawVotes)) {
      const s = Number(k);
      maskedVotes[s] = role === "player" && seat != null && s === seat ? v : null;
    }
    election.votes = maskedVotes;
  }

  // Public eligibility list for nomination (UI highlight + click gating).
  if (phase === "election_nomination") {
    const aliveSeats = players.filter((p) => p.alive).map((p) => p.seat);
    const tlp = election.termLockedPresidentSeat;
    const tlc = election.termLockedChancellorSeat;
    election.eligibleChancellorSeats = aliveSeats.filter((s) => {
      if (s === election.presidentSeat) return false;
      if (tlp != null && s === tlp) return false;
      if (tlc != null && s === tlc) return false;
      if (isSeatExiled(gameState, s)) return false;
      return true;
    });
  }

  // Hide policy hands from non-involved players.
  let legislative = null;
  if (phase === "legislative_president") {
    const isPresident = role === "player" && seat === election.presidentSeat;
    legislative = isPresident
      ? {
          presidentPolicies: gameState?.legislative?.presidentPolicies ?? null,
        }
      : null;
  } else if (phase === "legislative_chancellor") {
    const chanSeat = election.nominatedChancellorSeat;
    const canSee = role === "player" && seat != null && (seat === election.presidentSeat || seat === chanSeat);
    legislative = canSee
      ? {
          chancellorPolicies: gameState?.legislative?.chancellorPolicies ?? null,
        }
      : null;
  }

  // Only show the recipient their own role color (roadmap later: fascists see fascists+Hitler).
  const visibleRoleColorsBySeat = {};

  const exiledSeats = [];
  for (const [k, v] of Object.entries(gameState?.exile?.exiledBySeat ?? {})) {
    if (v !== true) continue;
    const s = Number(k);
    if (!Number.isFinite(s)) continue;
    exiledSeats.push(s);
  }
  exiledSeats.sort((a, b) => a - b);

  const isGameOver = phase === "game_over" || Boolean(gameState?.gameOver);
  const revealedRolesBySeat = isGameOver ? {} : null;

  if (isGameOver) {
    for (const p of players) {
      const r = gameState?.secret?.roleBySeat?.[p.seat] ?? null;
      if (r?.color) visibleRoleColorsBySeat[p.seat] = r.color;
      revealedRolesBySeat[p.seat] =
        r != null
          ? {
              id: r.id,
              group: r.group,
              alignment: r.alignment,
              color: r.color,
              description: getRoleDescription(r.id),
            }
          : null;
    }
  }

  let my = null;
  if (role === "player" && seat != null) {
    const r = gameState?.secret?.roleBySeat?.[seat] ?? null;
    if (!isGameOver && r?.color) visibleRoleColorsBySeat[seat] = r.color;

    if (!isGameOver) {
      // Agents can see co-fascists and the Dictator in the player list.
      // Dictator/Hitler does NOT see the fascist team without investigating.
      if (r?.group === "agent") {
        for (const p of players) {
          const s = Number(p?.seat);
          if (!Number.isFinite(s)) continue;
          if (s === seat) continue;

          const pr = gameState?.secret?.roleBySeat?.[s] ?? null;
          if (!pr) continue;

          if (pr.group === "dictator") {
            visibleRoleColorsBySeat[s] = pr.color ?? "#991B1B";
          } else if (pr.group === "agent" || pr.alignment === "fascist") {
            visibleRoleColorsBySeat[s] = "#ff4d4d";
          }
        }
      }

      // Apply any investigation-learned teams for this player.
      const knownTeams = gameState?.secret?.knownTeamsBySeat?.[seat] ?? null;
      if (knownTeams && typeof knownTeams === "object") {
        for (const [k, v] of Object.entries(knownTeams)) {
          const s = Number(k);
          if (!Number.isFinite(s)) continue;
          const c = teamColor(v);
          if (!c) continue;
          if (visibleRoleColorsBySeat[s] != null) continue;
          visibleRoleColorsBySeat[s] = c;
        }
      }
    }

    const clues = gameState?.secret?.cluesBySeat?.[seat] ?? null;
    const lastInvestigation = publicizeInvestigation(gameState?.secret?.lastInvestigationBySeat?.[seat] ?? null);

    const cover =
      r?.alignment === "fascist" ? gameState?.secret?.coverRoleBySeat?.[seat] ?? null : null;

    const me = players.find((p) => p.seat === seat) ?? null;
    const iAmAlive = me?.alive !== false;
    const deckNumber = Number(gameState?.policyDeckMeta?.deckNumber ?? 1);
    const usedDeckNumber = Number(gameState?.exile?.claimExileUsedDeckBySeat?.[seat] ?? 0);

    const inOffice = seat === election.presidentSeat || seat === election.nominatedChancellorSeat;
    const hasExilePower =
      isExileRoleId(r?.id) || (r?.alignment === "fascist" && isExileRoleId(cover?.id));

    const canExile =
      iAmAlive &&
      phase === "election_nomination" &&
      !inOffice &&
      !isSeatExiled(gameState, seat) &&
      hasExilePower &&
      Number.isFinite(deckNumber) &&
      usedDeckNumber !== deckNumber;

    my = {
      seat,
      role: r
        ? {
            id: r.id,
            group: r.group,
            alignment: r.alignment,
            color: r.color,
            description: getRoleDescription(r.id),
          }
        : null,
      coverRole: cover
        ? {
            id: cover.id,
            group: cover.group,
            alignment: cover.alignment,
            color: cover.color,
            description: getRoleDescription(cover.id),
          }
        : null,
      canExile: Boolean(canExile),
      canClaimExile: Boolean(canExile),
      clues,
      lastInvestigation,
    };
  }

  return {
    phase,
    players,
    election,
    policyDeck: publicizePolicyDeck(gameState.policyDeck),
    enactedPolicies: gameState.enactedPolicies ?? { liberal: 0, fascist: 0 },
    lastEnactedPolicy: gameState.lastEnactedPolicy,
    legislative,
    visibleRoleColorsBySeat,
    exile: { exiledSeats },
    power: gameState.power ?? null,
    gameOver: gameState.gameOver ?? null,
    revealedRolesBySeat,
    my,
  };
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

function getAliveSeats(gameState) {
  return (gameState?.players ?? []).filter((p) => p.alive).map((p) => p.seat);
}

function isSeatAlive(gameState, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return false;
  const p = (gameState?.players ?? []).find((x) => x.seat === s);
  return Boolean(p?.alive);
}

function checkPolicyWin(enactedPolicies) {
  const lib = Number(enactedPolicies?.liberal ?? 0);
  const fas = Number(enactedPolicies?.fascist ?? 0);
  if (lib >= 5) return { winner: "liberal", reason: `Liberals enacted ${lib}/5 policies.` };
  if (fas >= 6) return { winner: "fascist", reason: `Fascists enacted ${fas}/6 policies.` };
  return null;
}

function endGame(gameState, winner, reason) {
  if (!gameState || typeof gameState !== "object") return false;
  if (gameState.phase === "game_over" || gameState.gameOver) return false;
  gameState.phase = "game_over";
  gameState.power = null;
  gameState.legislative = null;
  gameState.gameOver = {
    winner,
    reason: String(reason ?? ""),
    endedAt: Date.now(),
  };
  return true;
}

function scheduleCloseLobby(gameState, closeLobby, lobbyId) {
  if (!gameState || typeof gameState !== "object") return;
  if (typeof closeLobby !== "function") return;
  if (!gameState.gameOver || typeof gameState.gameOver !== "object") return;

  // Close the lobby shortly after game end.
  if (gameState.gameOver.closeLobbyScheduled) return;
  const delayMs = 60 * 1000; // measured in ms so yeah at least one minute
  gameState.gameOver.closeLobbyScheduled = true;
  gameState.gameOver.closeLobbyAt = Date.now() + delayMs;
  setTimeout(() => closeLobby(lobbyId, "game-over"), delayMs);
}

function nextAlivePresidentSeat(players, currentSeat, exiledBySeat) {
  const alive = (players ?? [])
    .filter((p) => p.alive && exiledBySeat?.[p.seat] !== true)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  if (alive.length === 0) return currentSeat;
  for (const s of alive) if (s > currentSeat) return s;
  return alive[0];
}

function nextPresidentSeatAfterRound(gameState) {
  const gs = gameState;
  const ret = gs?.election?.specialElectionReturnSeat;
  if (ret != null && Number.isFinite(Number(ret))) {
    gs.election.specialElectionReturnSeat = null;
    return nextAlivePresidentSeat(gs.players, Number(ret) - 1, gs?.exile?.exiledBySeat);
  }

  return nextAlivePresidentSeat(gs.players, gs.election.presidentSeat, gs?.exile?.exiledBySeat);
}

function registerElectionHandlers({ io, socket, lobbies, online, playerLobby, gameRoom, emitGameSystem, closeLobby }) {
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

    if (gs.phase === "game_over") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (!isSeatAlive(gs, mySeat)) return;

    if (gs.phase !== "election_nomination") return;
    if (mySeat !== gs.election.presidentSeat) return;

    const target = Number(chancellorSeat);
    if (!Number.isFinite(target)) return;
    if (target === gs.election.presidentSeat) return;

    // Term limits: last president and last chancellor cannot be nominated chancellor.
    const tlp = gs?.election?.termLockedPresidentSeat ?? null;
    const tlc = gs?.election?.termLockedChancellorSeat ?? null;
    if (tlp != null && target === tlp) return;
    if (tlc != null && target === tlc) return;

    if (isSeatExiled(gs, target)) return;

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

    if (gs.phase === "game_over") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (!isSeatAlive(gs, mySeat)) return;

    if (gs.phase !== "election_voting") return;
    if (!Object.prototype.hasOwnProperty.call(gs.election.votes ?? {}, mySeat)) return;
    if (gs.election.votes?.[mySeat] != null) return;

    const v = vote === "ja" ? "ja" : vote === "nein" ? "nein" : null;
    if (!v) return;

    gs.election.votes[mySeat] = v;

    const aliveSeats = getAliveSeats(gs);
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

        l.gameState.election.failedElections = 0;

        // Update term limits for the newly elected government.
        l.gameState.election.termLockedPresidentSeat = l.gameState.election.presidentSeat;
        l.gameState.election.termLockedChancellorSeat = l.gameState.election.nominatedChancellorSeat;

        // Hitler Zone: fascists win if Hitler is elected Chancellor after 3 fascist policies.
        ensureSecretState(l.gameState);
        const fasCount = Number(l.gameState.enactedPolicies?.fascist ?? 0);
        if (fasCount >= 3) {
          const chanSeat = Number(l.gameState.election.nominatedChancellorSeat);
          const chanRole = Number.isFinite(chanSeat) ? l.gameState.secret?.roleBySeat?.[chanSeat] ?? null : null;
          if (chanRole?.id === "Hitler") {
            const didEnd = endGame(l.gameState, "fascist", "Hitler was elected Chancellor after 3 fascist policies.");
            if (didEnd) scheduleCloseLobby(l.gameState, closeLobby, lobbyId);
            if (emitGameSystem) {
              emitGameSystem(lobbyId, "Game over. Fascists win! Hitler was elected Chancellor in the Hitler Zone.").catch(
                () => {}
              );
            }
            emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
            return;
          }
        }

        const { drawn, reshuffled, shuffleCounts, deck } = drawPoliciesWithReshuffle(l.gameState.policyDeck, 3);
        l.gameState.policyDeck = deck;
        if (reshuffled) {
          maybeEmitDeckShuffle({
            gs: l.gameState,
            lobbyId,
            emitGameSystem,
            shuffleCounts,
            isReshuffle: true,
          });
        }
        l.gameState.legislative = { presidentPolicies: drawn };
        l.gameState.phase = "legislative_president";

        emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
        return;
      }

      const nextPres = nextPresidentSeatAfterRound(l.gameState);
      const aliveSeats2 = getAliveSeats(l.gameState);

      const prevFails = Number(l.gameState.election.failedElections ?? 0);
      const nextFails = prevFails + 1;
      l.gameState.election.failedElections = nextFails;

      if (emitGameSystem) {
        emitGameSystem(lobbyId, `The election fails and the election tracker moves forward. (${nextFails}/3)`).catch(
          () => {}
        );
      }

      // Chaos: topdeck after 3 failed elections.
      if (nextFails >= 3) {
        l.gameState.election.failedElections = 0;

        if (!l.gameState.policyDeck) l.gameState.policyDeck = createInitialPolicyDeck();
        const topDraw = drawPoliciesWithReshuffle(l.gameState.policyDeck, 1);
        l.gameState.policyDeck = topDraw.deck;
        if (topDraw.reshuffled) {
          maybeEmitDeckShuffle({
            gs: l.gameState,
            lobbyId,
            emitGameSystem,
            shuffleCounts: topDraw.shuffleCounts,
            isReshuffle: true,
          });
        }
        const [top] = topDraw.drawn;
        if (top === "liberal" || top === "fascist") {
          if (!l.gameState.enactedPolicies) l.gameState.enactedPolicies = { liberal: 0, fascist: 0 };
          if (top === "liberal") l.gameState.enactedPolicies.liberal += 1;
          if (top === "fascist") l.gameState.enactedPolicies.fascist += 1;
          l.gameState.lastEnactedPolicy = top;

          if (emitGameSystem) {
            if (top === "fascist") {
              emitGameSystem(
                lobbyId,
                `A fascist policy has been enacted. (${l.gameState.enactedPolicies.fascist}/6)`
              ).catch(() => {});
            } else {
              emitGameSystem(
                lobbyId,
                `A liberal policy has been enacted. (${l.gameState.enactedPolicies.liberal}/5)`
              ).catch(() => {});
            }
          }

          const win = checkPolicyWin(l.gameState.enactedPolicies);
          const isGameOver = Boolean(win);
          if (isGameOver) {
            const didEnd = endGame(l.gameState, win.winner, win.reason);
            if (didEnd) scheduleCloseLobby(l.gameState, closeLobby, lobbyId);
            if (emitGameSystem) {
              emitGameSystem(lobbyId, `Game over. ${win.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(
                () => {}
              );
            }
            emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
            return;
          }
        }
      }

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

    if (gs.phase === "game_over") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (!isSeatAlive(gs, mySeat)) return;

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

    if (gs.phase === "game_over") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    if (!isSeatAlive(gs, mySeat)) return;

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

    if (emitGameSystem) {
      if (enacted === "fascist") {
        emitGameSystem(lobbyId, `A fascist policy has been enacted. (${gs.enactedPolicies.fascist}/6)`).catch(
          () => {}
        );
      } else if (enacted === "liberal") {
        emitGameSystem(lobbyId, `A liberal policy has been enacted. (${gs.enactedPolicies.liberal}/5)`).catch(
          () => {}
        );
      }
    }

    const win = checkPolicyWin(gs.enactedPolicies);
    const isGameOver = Boolean(win);
    if (isGameOver) {
      const didEnd = endGame(gs, win.winner, win.reason);
      if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Game over. ${win.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(
          () => {}
        );
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    // End the legislative session.
    gs.legislative = null;
    gs.election.nominatedChancellorSeat = null;

    const aliveSeats = getAliveSeats(gs);
    const eligiblePowerTargets = aliveSeats.filter((s) => s !== gs.election.presidentSeat);
    const eligibleSpecialElectionTargets = eligiblePowerTargets.filter((s) => !isSeatExiled(gs, s));

    const votes2 = {};
    for (const s of aliveSeats) votes2[s] = null;
    gs.election.votes = votes2;
    gs.election.revealed = false;
    gs.election.passed = null;

    // Fascist board powers (requested subset)
    if (enacted === "fascist") {
      const fas = Number(gs.enactedPolicies.fascist ?? 0);
      if (fas === 2) {
        gs.phase = "power_investigate";
        gs.power = {
          type: "investigate",
          presidentSeat: gs.election.presidentSeat,
          eligibleSeats: eligiblePowerTargets,
        };
        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }
      if (fas === 3) {
        gs.phase = "power_special_election";
        gs.power = {
          type: "special_election",
          presidentSeat: gs.election.presidentSeat,
          eligibleSeats: eligibleSpecialElectionTargets,
        };

        if (gs.election.specialElectionReturnSeat == null) {
          gs.election.specialElectionReturnSeat = nextAlivePresidentSeat(
            gs.players,
            gs.election.presidentSeat,
            gs?.exile?.exiledBySeat
          );
        }

        if (emitGameSystem) {
          emitGameSystem(lobbyId, "Special election: The President chooses the next President.").catch(() => {});
        }

        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }
      if (fas === 4 || fas === 5) {
        gs.phase = "power_execute";
        gs.power = {
          type: "execute",
          presidentSeat: gs.election.presidentSeat,
          eligibleSeats: eligiblePowerTargets,
        };
        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }
    }

    gs.power = null;

    // Advance presidency after policy enactment.
    const nextPres = nextPresidentSeatAfterRound(gs);

    gs.phase = "election_nomination";
    gs.election.presidentSeat = nextPres;
    gs.election.nominatedChancellorSeat = null;

    
    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:specialElection", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    if (gs.phase === "game_over") return;
    if (gs.phase !== "power_special_election") return;
    if (gs.power?.type !== "special_election") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;
    if (mySeat !== gs.power.presidentSeat) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;
    if (!Array.isArray(gs.power.eligibleSeats) || !gs.power.eligibleSeats.includes(target)) return;
    if (!isSeatAlive(gs, target)) return;

    gs.power = null;

    gs.phase = "election_nomination";
    gs.election.presidentSeat = target;
    gs.election.nominatedChancellorSeat = null;

    const aliveSeats = getAliveSeats(gs);
    const votes = {};
    for (const s of aliveSeats) votes[s] = null;
    gs.election.votes = votes;
    gs.election.revealed = false;
    gs.election.passed = null;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Special election: Seat ${target} is the next President.`).catch(() => {});
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:role:exile", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    if (gs.phase === "game_over") return;
    if (gs.phase !== "election_nomination") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;

    ensureSecretState(gs);
    ensureExileState(gs);
    ensurePolicyDeckMeta(gs);

    const myRole = gs.secret?.roleBySeat?.[mySeat] ?? null;
    const cover =
      myRole?.alignment === "fascist" ? gs.secret?.coverRoleBySeat?.[mySeat] ?? null : null;
    const hasExilePower =
      isExileRoleId(myRole?.id) || (myRole?.alignment === "fascist" && isExileRoleId(cover?.id));
    if (!hasExilePower) return;

    const deckNumber = Number(gs.policyDeckMeta?.deckNumber ?? 1);
    if (!Number.isFinite(deckNumber)) return;

    const lastUsedDeck = Number(gs.exile?.claimExileUsedDeckBySeat?.[mySeat] ?? 0);
    if (Number.isFinite(lastUsedDeck) && lastUsedDeck === deckNumber) return;

    const target = mySeat;
    if (isSeatExiled(gs, target)) return;

    const res = exileSeat(gs, target);
    if (!res?.ok) return;

    gs.exile.claimExileUsedDeckBySeat[mySeat] = deckNumber;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${mySeat} has self-exiled.`).catch(() => {});
    }

     // Nun learns living fascist neighbors of the exiled seat.
     if (myRole?.id === "Nun") {
       const n = Array.isArray(gs.players) ? gs.players.length : 0;
       const prev = n > 0 ? (target === 1 ? n : target - 1) : null;
       const next = n > 0 ? (target === n ? 1 : target + 1) : null;

       let count = 0;
       for (const s of [prev, next]) {
         if (s == null) continue;
         if (!isSeatAlive(gs, s)) continue;
         const rr = gs.secret?.roleBySeat?.[s] ?? null;
         const team = getInvestigationTeamFromRole(rr);
         if (team === "fascist") count += 1;
       }

       gs.secret.lastInvestigationBySeat[mySeat] = {
         ts: Date.now(),
         targetSeat: target,
         result: {
           kind: "text",
           text: `Nun info: Seat ${target} has ${count} living fascist neighbor${count === 1 ? "" : "s"}.`,
         },
       };
     }

     // Deputy/Journalist/Monk follow-up picks happen immediately after exiling.
     if (myRole?.id === "Deputy" || myRole?.id === "Journalist" || myRole?.id === "Monk") {
       const aliveSeats = getAliveSeats(gs);
       const kind = myRole.id === "Deputy" ? "deputy" : myRole.id === "Journalist" ? "journalist" : "monk";
       const pickCount = kind === "monk" ? 2 : 3;
       const eligibleSeats =
         kind === "monk" ? aliveSeats.filter((s) => s !== mySeat) : aliveSeats;

       gs.phase = "power_role_pick";
       gs.power = {
         type: "role_pick",
         kind,
         actorSeat: mySeat,
         pickCount,
         pickedSeats: [],
         eligibleSeats: eligibleSeats.sort((a, b) => a - b),
         resumePhase: "election_nomination",
       };

       if (emitGameSystem) {
         emitGameSystem(lobbyId, `Seat ${mySeat} must choose ${pickCount} player${pickCount === 1 ? "" : "s"}.`).catch(
           () => {}
         );
       }

       emitGameState({ io, lobbyId, lobby, playerLobby, online });
       return;
     }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:rolePick", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    if (gs.phase === "game_over") return;
    if (gs.phase !== "power_role_pick") return;
    if (gs.power?.type !== "role_pick") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;
    if (mySeat !== gs.power.actorSeat) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;
    if (!Array.isArray(gs.power.eligibleSeats) || !gs.power.eligibleSeats.includes(target)) return;
    if (!isSeatAlive(gs, target)) return;

    ensureSecretState(gs);

    if (!Array.isArray(gs.power.pickedSeats)) gs.power.pickedSeats = [];
    if (gs.power.pickedSeats.includes(target)) return;
    gs.power.pickedSeats.push(target);
    gs.power.eligibleSeats = (gs.power.eligibleSeats ?? []).filter((s) => s !== target);

    const pickCount = Number(gs.power.pickCount ?? 0);
    if (!Number.isFinite(pickCount) || pickCount <= 0) return;

    if (gs.power.pickedSeats.length < pickCount) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    const picks = gs.power.pickedSeats.slice(0, pickCount).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    const kind = String(gs.power.kind ?? "");

    let text = null;

    if (kind === "deputy") {
      const c = picks.reduce((acc, s) => {
        const rr = gs.secret?.roleBySeat?.[s] ?? null;
        return acc + (rr?.group === "dissident" ? 1 : 0);
      }, 0);
      text = `Deputy info: ${c} dissident${c === 1 ? "" : "s"} among seats ${picks.join(", ")}.`;
    } else if (kind === "journalist") {
      const c = picks.reduce((acc, s) => {
        const rr = gs.secret?.roleBySeat?.[s] ?? null;
        const team = getInvestigationTeamFromRole(rr);
        return acc + (team === "liberal" ? 1 : 0);
      }, 0);
      text = `Journalist info: ${c} liberal${c === 1 ? "" : "s"} among seats ${picks.join(", ")}.`;
    } else if (kind === "monk") {
      const [a, b] = picks;
      const ra = gs.secret?.roleBySeat?.[a] ?? null;
      const rb = gs.secret?.roleBySeat?.[b] ?? null;
      const ta = getInvestigationTeamFromRole(ra);
      const tb = getInvestigationTeamFromRole(rb);
      const same = ta != null && tb != null ? ta === tb : null;
      text =
        same == null
          ? `Monk info: inconclusive.`
          : `Monk info: Seats ${a} and ${b} ${same ? "share" : "do not share"} the same alignment.`;
    }

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${mySeat} chooses seats ${picks.join(", ")}.`).catch(() => {});
    }

    if (text) {
      gs.secret.lastInvestigationBySeat[mySeat] = {
        ts: Date.now(),
        result: { kind: "text", text },
      };
    }

    const resume = String(gs.power.resumePhase ?? "election_nomination");
    gs.power = null;
    gs.phase = resume;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:investigate", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    if (gs.phase === "game_over") return;
    if (gs.phase !== "power_investigate") return;
    if (gs.power?.type !== "investigate") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;
    if (mySeat !== gs.power.presidentSeat) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;
    if (!Array.isArray(gs.power.eligibleSeats) || !gs.power.eligibleSeats.includes(target)) return;
    if (!isSeatAlive(gs, target)) return;

    ensureSecretState(gs);
    const r = gs.secret?.roleBySeat?.[target] ?? null;
    const team = getInvestigationTeamFromRole(r);

    if (!gs.secret.knownTeamsBySeat) gs.secret.knownTeamsBySeat = {};
    if (!gs.secret.knownTeamsBySeat[mySeat]) gs.secret.knownTeamsBySeat[mySeat] = {};
    if (team) gs.secret.knownTeamsBySeat[mySeat][target] = team;

    gs.secret.lastInvestigationBySeat[mySeat] = {
      ts: Date.now(),
      targetSeat: target,
      result: team ? { kind: "team", team } : null,
    };

    gs.power = null;

    const nextPres = nextPresidentSeatAfterRound(gs);
    const aliveSeats = getAliveSeats(gs);

    gs.phase = "election_nomination";
    gs.election.presidentSeat = nextPres;
    gs.election.nominatedChancellorSeat = null;

    const votes = {};
    for (const s of aliveSeats) votes[s] = null;
    gs.election.votes = votes;

    gs.election.revealed = false;
    gs.election.passed = null;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:execute", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;

    if (gs.phase === "game_over") return;
    if (gs.phase !== "power_execute") return;
    if (gs.power?.type !== "execute") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;
    if (mySeat !== gs.power.presidentSeat) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;
    if (!Array.isArray(gs.power.eligibleSeats) || !gs.power.eligibleSeats.includes(target)) return;
    if (!isSeatAlive(gs, target)) return;

    const p = (gs.players ?? []).find((x) => x.seat === target);
    if (!p) return;
    p.alive = false;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${target} has been executed.`).catch(() => {});
    }

    ensureSecretState(gs);
    const killedRole = gs.secret?.roleBySeat?.[target] ?? null;
    if (killedRole?.id === "Hitler") {
      gs.power = null;
      const didEnd = endGame(gs, "liberal", "Hitler was executed.");
      if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, "Game over. Liberals win! Hitler has been executed.").catch(() => {});
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    gs.power = null;

    const nextPres = nextPresidentSeatAfterRound(gs);
    const aliveSeats = getAliveSeats(gs);

    gs.phase = "election_nomination";
    gs.election.presidentSeat = nextPres;
    gs.election.nominatedChancellorSeat = null;

    const votes = {};
    for (const s of aliveSeats) votes[s] = null;
    gs.election.votes = votes;

    gs.election.revealed = false;
    gs.election.passed = null;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });
}

module.exports = { registerElectionHandlers };
