const { discardPolicies } = require("../../../../app/gameLogic/policyDeck");

const { setCardsClaimGovernment } = require("../../../game/claims");

const { ensureGameState, emitGameState } = require("../gameState");
const { getMySeat, isPlayerInLobby, getAliveSeats, isSeatAlive } = require("../guards");

const { checkPolicyWin, endGame, scheduleCloseLobby } = require("./winConditions");
const { nextPresidentSeatAfterRound } = require("./presidency");
const { maybeStartFascistBoardPower } = require("./defaultPowers");

const { applyNunSelfExileOnEnact } = require("../../../game/roles/liberals/loyalists/Nun");
const {
  ensureSurveyorState,
  shouldTriggerSurveyorOnEnact,
  getTotalEnactedPolicies,
  findSurveyorSeat,
  buildSurveyorPower,
} = require("../../../game/roles/liberals/loyalists/Surveyor");

const {
  getGovernorWinIfChancellorCannotBeNominated,
} = require("../../../game/roles/liberals/loyalists/Governor");

function registerLegislativeHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby }) {
  socket.on("game:legislative:presidentDiscard", ({ lobbyId, discardIndex } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

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
    if (!gs) return;

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
        emitGameSystem(lobbyId, `A fascist policy has been enacted. (${gs.enactedPolicies.fascist}/6)`).catch(() => {});
      } else if (enacted === "liberal") {
        emitGameSystem(lobbyId, `A liberal policy has been enacted. (${gs.enactedPolicies.liberal}/5)`).catch(() => {});
      }
    }

    // Nun: self-exile + private neighbor info when enacting a fascist policy.
    if (enacted === "fascist") {
      const nunRes = applyNunSelfExileOnEnact({ gs, actorSeat: mySeat, enactedPolicy: enacted, now: Date.now() });
      if (nunRes?.ok && nunRes?.triggered) {
        if (emitGameSystem) {
          emitGameSystem(lobbyId, `Seat ${mySeat} self-exiles.`).catch(() => {});
        }
      }
    }

    const win = checkPolicyWin(gs.enactedPolicies);
    if (win) {
      const didEnd = endGame(gs, win.winner, win.reason);
      if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Game over. ${win.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(() => {});
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    // Surveyor: every 3rd enacted policy queues/starts a mandatory public 2-seat pick.
    ensureSurveyorState(gs);
    const lastTrig = Number(gs.secret?.surveyor?.lastTriggeredPolicyCount ?? 0);
    const surveyorShould = shouldTriggerSurveyorOnEnact({
      enactedPolicies: gs.enactedPolicies,
      lastTriggeredPolicyCount: lastTrig,
    });

    const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
    const roleBySeat = gs.secret?.roleBySeat ?? null;
    const totalPolicies = surveyorShould ? getTotalEnactedPolicies(gs.enactedPolicies) : 0;
    if (surveyorShould) {
      // Mark the trigger as consumed even if the Surveyor is dead/missing.
      gs.secret.surveyor.lastTriggeredPolicyCount = totalPolicies;
    }

    const surveyorSeat = surveyorShould ? findSurveyorSeat({ roleBySeat, seatCount }) : null;
    const aliveSeatsNow = getAliveSeats(gs);
    const surveyorAlive = surveyorSeat != null && aliveSeatsNow.includes(surveyorSeat);
    const surveyorTrigger = Boolean(surveyorShould && surveyorAlive);

    // Claims: the most recently enacted government can claim cards (once each).
    setCardsClaimGovernment(gs, gs.election.presidentSeat, gs.election.nominatedChancellorSeat);

    // End the legislative session.
    gs.legislative = null;
    gs.election.nominatedChancellorSeat = null;

    const aliveSeats = getAliveSeats(gs);
    const eligiblePowerTargets = aliveSeats.filter((s) => s !== gs.election.presidentSeat);

    const votes2 = {};
    for (const s of aliveSeats) votes2[s] = null;
    gs.election.votes = votes2;
    gs.election.revealed = false;
    gs.election.passed = null;

    // Fascist board powers (requested subset)
    const powerRes = maybeStartFascistBoardPower({
      gs,
      enactedPolicy: enacted,
      eligiblePowerTargets,
      emitGameSystem,
      lobbyId,
    });
    if (powerRes.started) {
      if (surveyorTrigger) {
        // Defer Surveyor until after the phase-locked board power resolves.
        gs.secret.surveyor.pendingPolicyCount = totalPolicies;
      }
      if (emitGameSystem && powerRes.systemText) {
        emitGameSystem(lobbyId, powerRes.systemText).catch(() => {});
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    gs.power = null;

    // Advance presidency after policy enactment.
    const nextPres = nextPresidentSeatAfterRound(gs);

    gs.phase = "election_nomination";
    gs.election.presidentSeat = nextPres;
    gs.election.nominatedChancellorSeat = null;

    const govWin = getGovernorWinIfChancellorCannotBeNominated(gs);
    if (govWin) {
      const didEnd = endGame(gs, govWin.winner, govWin.reason);
      if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Game over. ${govWin.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(
          () => {}
        );
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    if (surveyorTrigger) {
      const p = buildSurveyorPower({
        actorSeat: surveyorSeat,
        eligibleSeats: getAliveSeats(gs),
        resumePhase: "election_nomination",
      });
      if (p) {
        gs.phase = "power_role_pick";
        gs.power = p;
        if (emitGameSystem) {
          emitGameSystem(lobbyId, `Seat ${surveyorSeat} must choose 2 players.`).catch(() => {});
        }
        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });
}

module.exports = {
  registerLegislativeHandlers,
};
