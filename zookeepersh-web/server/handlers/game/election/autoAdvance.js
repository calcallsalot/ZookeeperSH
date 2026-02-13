const { createInitialPolicyDeck, drawPoliciesWithReshuffle } = require("../../../../app/gameLogic/policyDeck");

const { ensureSecretState, maybeEmitDeckShuffle, ensureGameState, emitGameState } = require("../gameState");
const { getAliveSeats } = require("../guards");

const { checkPolicyWin, endGame, scheduleCloseLobby } = require("./winConditions");
const { nextPresidentSeatAfterRound } = require("./presidency");

const {
  clearInsurrectionaryRumorsOnReshuffle,
} = require("../../../game/roles/fascist/agents/Insurrectionary");
const {
  clearNobleSelectionsOnReshuffle,
} = require("../../../game/roles/fascist/agents/Noble");

const { isPacifistRole, buildPacifistReprisalExecutePower } = require("../../../game/roles/liberals/loyalists/Pacifist");
const { isGrandmaRole, buildGrandmaReprisalExecutePower } = require("../../../game/roles/fascist/agents/Grandma");
const { buildHarrierDeathPower } = require("../../../game/roles/liberals/loyalists/Harrier");
const { onSeatDiedMaybeKlutz, getKlutzWinIfFascistChancellorElected } = require("../../../game/roles/liberals/dissidents/Klutz");

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

function playerBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function setSeatAlive(gs, seat, alive) {
  const p = playerBySeat(gs, seat);
  if (!p) return false;
  p.alive = alive !== false;
  return true;
}

function advanceFromElectionReveal({
  lobbies,
  lobbyId,
  io,
  playerLobby,
  online,
  emitGameSystem,
  closeLobby,
}) {
  const l = lobbies.get(lobbyId);
  if (!l?.gameState) return;
  if (l.gameState.phase !== "election_reveal") return;

  // Ensure invariants (secret/policy meta/etc) before any role logic.
  ensureGameState(l);

  if (l.gameState.election.passed) {
    if (!l.gameState.policyDeck) l.gameState.policyDeck = createInitialPolicyDeck();

    l.gameState.election.failedElections = 0;

    // Update term limits for the newly elected government.
    l.gameState.election.termLockedPresidentSeat = l.gameState.election.presidentSeat;
    l.gameState.election.termLockedChancellorSeat = l.gameState.election.nominatedChancellorSeat;

    // Klutz: after the Klutz dies, fascists win if a Fascist is elected Chancellor.
    ensureSecretState(l.gameState);
    const klutzWin = getKlutzWinIfFascistChancellorElected({
      gs: l.gameState,
      chancellorSeat: l.gameState.election.nominatedChancellorSeat,
      electionPassed: true,
    });
    if (klutzWin) {
      const didEnd = endGame(l.gameState, klutzWin.winner, klutzWin.reason);
      if (didEnd) scheduleCloseLobby(l.gameState, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, `Game over. ${klutzWin.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(
          () => {}
        );
      }
      emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
      return;
    }

    // Hitler Zone: fascists win if Hitler is elected Chancellor after 3 fascist policies.
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

      clearInsurrectionaryRumorsOnReshuffle({ gs: l.gameState });
      clearNobleSelectionsOnReshuffle({ gs: l.gameState });
    }

    l.gameState.legislative = { presidentPolicies: drawn };
    l.gameState.phase = "legislative_president";

    emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
    return;
  }

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

      clearInsurrectionaryRumorsOnReshuffle({ gs: l.gameState });
      clearNobleSelectionsOnReshuffle({ gs: l.gameState });
    }

    const [top] = topDraw.drawn;
    if (top === "liberal" || top === "fascist") {
      if (!l.gameState.enactedPolicies) l.gameState.enactedPolicies = { liberal: 0, fascist: 0 };
      if (top === "liberal") l.gameState.enactedPolicies.liberal += 1;
      if (top === "fascist") l.gameState.enactedPolicies.fascist += 1;
      l.gameState.lastEnactedPolicy = top;

      if (emitGameSystem) {
        if (top === "fascist") {
          emitGameSystem(lobbyId, `A fascist policy has been enacted. (${l.gameState.enactedPolicies.fascist}/6)`).catch(
            () => {}
          );
        } else {
          emitGameSystem(lobbyId, `A liberal policy has been enacted. (${l.gameState.enactedPolicies.liberal}/5)`).catch(
            () => {}
          );
        }
      }

      const win = checkPolicyWin(l.gameState.enactedPolicies);
      if (win) {
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

      // Surveyor trigger on chaos enactment.
      ensureSecretState(l.gameState);
      ensureSurveyorState(l.gameState);
      const lastTrig = Number(l.gameState.secret?.surveyor?.lastTriggeredPolicyCount ?? 0);
      const surveyorShould = shouldTriggerSurveyorOnEnact({
        enactedPolicies: l.gameState.enactedPolicies,
        lastTriggeredPolicyCount: lastTrig,
      });

      const seatCount = Array.isArray(l.gameState.players) ? l.gameState.players.length : 0;
      const totalPolicies = surveyorShould ? getTotalEnactedPolicies(l.gameState.enactedPolicies) : 0;
      if (surveyorShould) l.gameState.secret.surveyor.lastTriggeredPolicyCount = totalPolicies;

      const surveyorSeat = surveyorShould
        ? findSurveyorSeat({ roleBySeat: l.gameState.secret?.roleBySeat ?? null, seatCount })
        : null;
      const aliveSeatsNow = getAliveSeats(l.gameState);
      const surveyorAlive = surveyorSeat != null && aliveSeatsNow.includes(surveyorSeat);

      if (surveyorShould && surveyorAlive) {
        const p = buildSurveyorPower({
          actorSeat: surveyorSeat,
          eligibleSeats: aliveSeatsNow,
          resumePhase: "election_nomination",
        });
        if (p) {
          // Set nomination state first; Surveyor resolves before nomination continues.
          const nextPres = nextPresidentSeatAfterRound(l.gameState);
          l.gameState.phase = "election_nomination";
          l.gameState.election.presidentSeat = nextPres;
          l.gameState.election.nominatedChancellorSeat = null;

          const votes = {};
          for (const s of aliveSeatsNow) votes[s] = null;
          l.gameState.election.votes = votes;
          l.gameState.election.revealed = false;
          l.gameState.election.passed = null;

          const govWin = getGovernorWinIfChancellorCannotBeNominated(l.gameState);
          if (govWin) {
            const didEnd = endGame(l.gameState, govWin.winner, govWin.reason);
            if (didEnd) scheduleCloseLobby(l.gameState, closeLobby, lobbyId);
            if (emitGameSystem) {
              emitGameSystem(
                lobbyId,
                `Game over. ${govWin.winner === "liberal" ? "Liberals" : "Fascists"} win!`
              ).catch(() => {});
            }
            emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
            return;
          }

          l.gameState.phase = "power_role_pick";
          l.gameState.power = p;
          if (emitGameSystem) {
            emitGameSystem(lobbyId, `Seat ${surveyorSeat} must choose 2 players.`).catch(() => {});
          }

          emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
          return;
        }
      }
    }
  }

  const nextPres = nextPresidentSeatAfterRound(l.gameState);
  const aliveSeats2 = getAliveSeats(l.gameState);

  l.gameState.phase = "election_nomination";
  l.gameState.election.presidentSeat = nextPres;
  l.gameState.election.nominatedChancellorSeat = null;

  const votes2 = {};
  for (const s of aliveSeats2) votes2[s] = null;
  l.gameState.election.votes = votes2;

  l.gameState.election.revealed = false;
  l.gameState.election.passed = null;

  const govWin = getGovernorWinIfChancellorCannotBeNominated(l.gameState);
  if (govWin) {
    const didEnd = endGame(l.gameState, govWin.winner, govWin.reason);
    if (didEnd) scheduleCloseLobby(l.gameState, closeLobby, lobbyId);
    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Game over. ${govWin.winner === "liberal" ? "Liberals" : "Fascists"} win!`).catch(
        () => {}
      );
    }
    emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
    return;
  }

  // Ensure state invariants before emitting (covers older lobbies).
  ensureGameState(l);
  emitGameState({ io, lobbyId, lobby: l, playerLobby, online });
}

function scheduleElectionRevealAutoAdvance(ctx) {
  setTimeout(() => advanceFromElectionReveal(ctx), 1200);
}

module.exports = {
  advanceFromElectionReveal,
  scheduleElectionRevealAutoAdvance,
};
