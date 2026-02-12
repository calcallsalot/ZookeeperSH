const { ensureGameState, emitGameState } = require("./gameState");

const { registerNominationHandlers } = require("./election/nomination");
const { registerVotingHandlers } = require("./election/voting");
const { registerLegislativeHandlers } = require("./election/legislative");
const { registerDefaultPowerHandlers } = require("./election/defaultPowers");

function registerElectionHandlers({
  io,
  socket,
  lobbies,
  online,
  playerLobby,
  emitGameSystem,
  closeLobby,
}) {
  socket.on("game:state:request", ({ lobbyId } = {}) => {
    if (typeof lobbyId !== "string") return;
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;
    ensureGameState(lobby);
    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  registerNominationHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby });
  registerVotingHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby });
  registerLegislativeHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby });
  registerDefaultPowerHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby });
}

module.exports = { registerElectionHandlers };
