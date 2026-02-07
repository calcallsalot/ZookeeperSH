const { createInitialPolicyDeck } = require("../../../app/gameLogic/policyDeck");
const { buildPrivateRoleState } = require("../../../app/gameLogic/roles");
const { getRoleDescription } = require("../../game/roleDescriptions");
const {
  ensureExileState,
  isSeatExiled,
  clearAllExiles,
  clearAllClaimExileUses,
} = require("../../game/exile");
const { isExileRoleId } = require("../../game/roles");

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

  if (!gs.secret.lastInvestigationBySeat) gs.secret.lastInvestigationBySeat = {};

  // Per-investigator remembered info (used for UI coloring, etc.)
  if (!gs.secret.knownTeamsBySeat) gs.secret.knownTeamsBySeat = {};

  // Some roles and effects mark players as learning rumors.
  if (!gs.secret.learningRumorsBySeat) gs.secret.learningRumorsBySeat = {};
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
  if (!lobby || typeof lobby !== "object") return;

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

    // power phases (investigate/execute/etc)
    power: null,

    // game over
    gameOver: null,
  };

  ensureExileState(lobby.gameState);
  ensureSecretState(lobby.gameState);
  ensurePolicyDeckMeta(lobby.gameState);
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
  ensurePolicyDeckMeta(gameState);

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

    const me = players.find((p) => p.seat === seat) ?? null;
    const iAmAlive = me?.alive !== false;

    const deckNumber = Number(gameState?.policyDeckMeta?.deckNumber ?? 1);
    const usedDeckNumber = Number(gameState?.exile?.claimExileUsedDeckBySeat?.[seat] ?? 0);

    const inOffice = seat === election.presidentSeat || seat === election.nominatedChancellorSeat;
    const hasExilePower = isExileRoleId(r?.id);

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

module.exports = {
  getInvestigationTeamFromRole,
  ensureSecretState,
  ensurePolicyDeckMeta,
  maybeEmitDeckShuffle,
  ensureGameState,
  sanitizeGameStateForRecipient,
  emitGameState,
};
