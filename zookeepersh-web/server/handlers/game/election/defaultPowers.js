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

const { buildHarrierDeathPower } = require("../../../game/roles/liberals/loyalists/Harrier");
const { isPacifistRole, buildPacifistReprisalExecutePower } = require("../../../game/roles/liberals/loyalists/Pacifist");
const { isGrandmaRole, buildGrandmaReprisalExecutePower } = require("../../../game/roles/fascist/agents/Grandma");
const { onSeatDiedMaybeKlutz } = require("../../../game/roles/liberals/dissidents/Klutz");

const {
  ensureSurveyorState,
  findSurveyorSeat,
  buildSurveyorPower,
} = require("../../../game/roles/liberals/loyalists/Surveyor");

const {
  getGovernorWinIfChancellorCannotBeNominated,
} = require("../../../game/roles/liberals/loyalists/Governor");

function maybeEndGameForGovernor({ gs, lobbyId, emitGameSystem, closeLobby }) {
  const win = getGovernorWinIfChancellorCannotBeNominated(gs);
  if (!win) return false;

  const didEnd = endGame(gs, win.winner, win.reason);
  if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
  if (emitGameSystem) {
    emitGameSystem(lobbyId, `Game over. ${win.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(() => {});
  }
  return true;
}

function maybeStartPendingSurveyorPower({ gs, lobbyId, emitGameSystem }) {
  if (!gs || typeof gs !== "object") return false;
  if (gs.phase === "game_over" || gs.gameOver) return false;

  ensureSecretState(gs);
  ensureSurveyorState(gs);

  const pendingPolicyCount = Number(gs.secret?.surveyor?.pendingPolicyCount ?? 0);
  if (!Number.isFinite(pendingPolicyCount) || pendingPolicyCount <= 0) return false;

  const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
  const surveyorSeat = findSurveyorSeat({ roleBySeat: gs.secret?.roleBySeat ?? null, seatCount });
  const aliveSeats = getAliveSeats(gs);

  // Clear pending regardless; if Surveyor is dead/missing, nothing happens.
  gs.secret.surveyor.pendingPolicyCount = 0;

  if (surveyorSeat == null || !aliveSeats.includes(surveyorSeat)) return false;

  const p = buildSurveyorPower({ actorSeat: surveyorSeat, eligibleSeats: aliveSeats, resumePhase: "election_nomination" });
  if (!p) return false;

  gs.phase = "power_role_pick";
  gs.power = p;

  if (emitGameSystem) {
    emitGameSystem(lobbyId, `Seat ${surveyorSeat} must choose 2 players.`).catch(() => {});
  }

  return true;
}

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

    if (maybeEndGameForGovernor({ gs, lobbyId, emitGameSystem, closeLobby })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    if (maybeStartPendingSurveyorPower({ gs, lobbyId, emitGameSystem })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
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

    if (maybeEndGameForGovernor({ gs, lobbyId, emitGameSystem, closeLobby })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    if (maybeStartPendingSurveyorPower({ gs, lobbyId, emitGameSystem })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

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

    ensureSecretState(gs);
    const targetRole = gs.secret?.roleBySeat?.[target] ?? null;
    const aliveSeatsBefore = getAliveSeats(gs);

    // Pacifist/Grandma: intercept death -> remain alive + reprisal execute.
    if (isPacifistRole(targetRole)) {
      const pwr = buildPacifistReprisalExecutePower(target, aliveSeatsBefore);
      if (!pwr) return;

      gs.phase = "power_execute";
      gs.power = pwr;

      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Seat ${target} survives and must choose a player to die.`).catch(() => {});
      }

      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    if (isGrandmaRole(targetRole)) {
      const pwr = buildGrandmaReprisalExecutePower(target, aliveSeatsBefore);
      if (!pwr) return;

      gs.phase = "power_execute";
      gs.power = pwr;

      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Seat ${target} survives and must choose a player to die.`).catch(() => {});
      }

      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    const p = (gs.players ?? []).find((x) => x.seat === target);
    if (!p) return;
    p.alive = false;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${target} has been executed.`).catch(() => {});
    }

    const killedRole = targetRole;
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

    onSeatDiedMaybeKlutz({ gs, deadSeat: target, now: Date.now() });

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

    if (maybeEndGameForGovernor({ gs, lobbyId, emitGameSystem, closeLobby })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    // Harrier: upon dying, publicly chooses a player and learns their role.
    if (killedRole?.id === "Harrier") {
      const harrierPower = buildHarrierDeathPower({
        actorSeat: target,
        eligibleSeats: aliveSeats,
        resumePhase: "election_nomination",
      });

      if (harrierPower) {
        gs.phase = "power_role_pick";
        gs.power = harrierPower;
        if (emitGameSystem) {
          emitGameSystem(lobbyId, `Seat ${target} must choose 1 player.`).catch(() => {});
        }
        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }
    }

    if (maybeStartPendingSurveyorPower({ gs, lobbyId, emitGameSystem })) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });
}

module.exports = {
  maybeStartFascistBoardPower,
  registerDefaultPowerHandlers,
};
