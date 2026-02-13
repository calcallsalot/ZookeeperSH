const { ensureGameState, emitGameState } = require("../gameState");
const { getMySeat, isPlayerInLobby, getAliveSeats, isSeatAlive } = require("../guards");
const { isEligibleChancellorSeat } = require("./isTermLocked");

const { endGame, scheduleCloseLobby } = require("./winConditions");

const {
  getGovernorWinIfChancellorCannotBeNominated,
} = require("../../../game/roles/liberals/loyalists/Governor");

const {
  ensureSurveyorState,
  findSurveyorSeat,
  buildSurveyorPower,
} = require("../../../game/roles/liberals/loyalists/Surveyor");

function startRolePickPower({ gs, power, lobbyId, emitGameSystem }) {
  if (!gs || typeof gs !== "object") return false;
  if (!power || typeof power !== "object") return false;
  if (power.type !== "role_pick") return false;
  if (gs.phase === "game_over" || gs.gameOver) return false;

  gs.phase = "power_role_pick";
  gs.power = power;

  const actorSeat = Number(power.actorSeat);
  const pickCount = Number(power.pickCount);

  if (emitGameSystem && Number.isFinite(actorSeat) && Number.isFinite(pickCount) && pickCount > 0) {
    emitGameSystem(lobbyId, `Seat ${actorSeat} must choose ${pickCount} player${pickCount === 1 ? "" : "s"}.`).catch(
      () => {}
    );
  }

  return true;
}

function registerNominationHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby }) {
  socket.on("game:nominateChancellor", ({ lobbyId, chancellorSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

    if (gs.phase === "game_over" || gs.gameOver) return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;

    if (gs.phase !== "election_nomination") return;

    // Governor win: if no eligible chancellor exists, Governor's team wins immediately.
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

    // Pending Surveyor trigger (queued behind other phase-locked effects).
    ensureSurveyorState(gs);
    const pendingPolicyCount = Number(gs.secret?.surveyor?.pendingPolicyCount ?? 0);
    if (Number.isFinite(pendingPolicyCount) && pendingPolicyCount > 0) {
      const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
      const surveyorSeat = findSurveyorSeat({ roleBySeat: gs.secret?.roleBySeat ?? null, seatCount });
      const aliveSeats = getAliveSeats(gs);

      // Clear pending regardless; if the Surveyor is dead/missing, nothing happens.
      gs.secret.surveyor.pendingPolicyCount = 0;
      if (surveyorSeat != null && aliveSeats.includes(surveyorSeat)) {
        const p = buildSurveyorPower({ actorSeat: surveyorSeat, eligibleSeats: aliveSeats, resumePhase: "election_nomination" });
        if (p && startRolePickPower({ gs, power: p, lobbyId, emitGameSystem })) {
          emitGameState({ io, lobbyId, lobby, playerLobby, online });
          return;
        }
      }
    }

    if (mySeat !== gs.election.presidentSeat) return;

    const target = Number(chancellorSeat);
    if (!Number.isFinite(target)) return;
    if (!isEligibleChancellorSeat(gs, target)) return;

    const aliveSeats = getAliveSeats(gs);
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
}

module.exports = {
  registerNominationHandlers,
};
