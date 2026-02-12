const { ensureGameState, emitGameState } = require("../gameState");
const { getMySeat, isPlayerInLobby, getAliveSeats, isSeatAlive } = require("../guards");
const { scheduleElectionRevealAutoAdvance } = require("./autoAdvance");

function registerVotingHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby }) {
  socket.on("game:castVote", ({ lobbyId, vote } = {}) => {
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

    scheduleElectionRevealAutoAdvance({
      lobbies,
      lobbyId,
      io,
      playerLobby,
      online,
      emitGameSystem,
      closeLobby,
    });
  });
}

module.exports = {
  registerVotingHandlers,
};
