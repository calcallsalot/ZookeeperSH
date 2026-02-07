const {
  createInitialPolicyDeck,
  drawPoliciesWithReshuffle,
  discardPolicies,
} = require("../../../app/gameLogic/policyDeck");
const {
  ensureGameState,
  ensureSecretState,
  emitGameState,
  getInvestigationTeamFromRole,
  maybeEmitDeckShuffle,
} = require("./gameState");
const { isSeatExiled } = require("../../game/exile");

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
        const eligibleSpecialElectionTargets = eligiblePowerTargets.filter((s) => !isSeatExiled(gs, s));

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
