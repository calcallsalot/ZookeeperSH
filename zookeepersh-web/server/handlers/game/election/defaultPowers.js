const { isSeatExiled } = require("../../../game/exile");

const { initInv2Claim, markInv2InvestigationComplete } = require("../../../game/claims");

const {
  getInvestigationTeamFromRole,
  ensureSecretState,
  ensureGameState,
  emitGameState,
} = require("../gameState");
const { getMySeat, isPlayerInLobby, getAliveSeats, isSeatAlive } = require("../guards");

const { endGame, scheduleCloseLobby } = require("./winConditions");
const { nextAlivePresidentSeat, nextPresidentSeatAfterRound } = require("./presidency");

function maybeStartFascistBoardPower({ gs, enactedPolicy, eligiblePowerTargets, emitGameSystem, lobbyId }) {
  if (!gs || typeof gs !== "object") return { started: false, systemText: null };
  if (enactedPolicy !== "fascist") return { started: false, systemText: null };

  const fas = Number(gs.enactedPolicies?.fascist ?? 0);

  if (fas === 2) {
    // Investigation claim eligibility is tied to the president who enacted the 2nd fascist policy.
    initInv2Claim(gs, gs.election.presidentSeat);
    gs.phase = "power_investigate";
    gs.power = {
      type: "investigate",
      presidentSeat: gs.election.presidentSeat,
      eligibleSeats: eligiblePowerTargets,
    };
    return { started: true, systemText: null };
  }

  if (fas === 3) {
    const eligibleSpecialElectionTargets = (eligiblePowerTargets ?? []).filter((s) => !isSeatExiled(gs, s));

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

    return {
      started: true,
      systemText: "Special election: The President chooses the next President.",
    };
  }

  if (fas === 4 || fas === 5) {
    gs.phase = "power_execute";
    gs.power = {
      type: "execute",
      presidentSeat: gs.election.presidentSeat,
      eligibleSeats: eligiblePowerTargets,
    };
    return { started: true, systemText: null };
  }

  return { started: false, systemText: null };
}

function registerDefaultPowerHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby }) {
  socket.on("game:power:specialElection", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

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

  socket.on("game:power:investigate", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

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

    // If this investigation was triggered by the 2nd fascist policy, enable the president's inv-claim.
    markInv2InvestigationComplete(gs, mySeat, target);

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
    if (!gs) return;

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

module.exports = {
  maybeStartFascistBoardPower,
  registerDefaultPowerHandlers,
};
