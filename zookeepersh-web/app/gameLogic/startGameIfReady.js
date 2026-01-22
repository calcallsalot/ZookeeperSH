const { shuffle } = require("./shuffle");
const { createInitialPolicyDeck } = require("./policyDeck");

function startGameIfReady({ io, lobbies, lobbyId, gameRoom, lobbyListPublic, emitGameSystem }) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  if (lobby.status === "in_game") return;

  const players = lobby.players ?? [];
  if (players.length !== 7) return;

  const seatOrder = shuffle([...players]);
  const seatByName = Object.fromEntries(seatOrder.map((name, idx) => [name, idx + 1]));

  // initialize gameState at game start
  const gameState = {
    phase: "election_nomination",
    players: seatOrder.map((name, idx) => ({
      seat: idx + 1,
      name,
      alive: true,
    })),
    election: {
      presidentSeat: 1,
      nominatedChancellorSeat: null,
      votes: Object.fromEntries(seatOrder.map((_, idx) => [idx + 1, null])),
      revealed: false,
      passed: null,
      requiredYes: 4,
    },

    // policy deck + enacted policies
    policyDeck: createInitialPolicyDeck(),
    enactedPolicies: { liberal: 0, fascist: 0 },
    legislative: null,
  };

  // store updated lobby
  const nextLobby = {
    ...lobby,
    status: "in_game",
    players: seatOrder,
    seatOrder,
    seatByName,
    startedAt: Date.now(),
    gameState, 
  };

  lobbies.set(lobbyId, nextLobby);

  io.emit("lobbies:update", lobbyListPublic());

  // existing event
  io.to(gameRoom(lobbyId)).emit("game:started", { lobbyId, seatByName, seatOrder });

  // emit initial game state so clients can render election phase immediately
  const publicGameState = {
    ...gameState,
    policyDeck: {
      drawCount: gameState.policyDeck?.drawPile?.length ?? 0,
      discardCount: gameState.policyDeck?.discardPile?.length ?? 0,
    },
  };
  io.to(gameRoom(lobbyId)).emit("game:state", { lobbyId, gameState: publicGameState });

  if (emitGameSystem) emitGameSystem(lobbyId, "The game begins").catch(() => {});
}

module.exports = { startGameIfReady };
