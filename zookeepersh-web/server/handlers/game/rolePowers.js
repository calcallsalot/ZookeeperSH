const { ensurePolicyDeckMeta, ensureGameState, ensureSecretState, emitGameState } = require("./gameState");
const { ensureExileState, isSeatExiled, exileSeat } = require("../../game/exile");
const { isExileRoleId } = require("../../game/roles");
const { ensureClaimsState } = require("../../game/claims");

const {
  getNunLivingFascistNeighborCount,
  buildNunInvestigation,
} = require("../../game/roles/liberals/loyalists/Nun");
const { getDeputyInfo } = require("../../game/roles/liberals/loyalists/Deputy");
const { getJournalistLiberalCount } = require("../../game/roles/liberals/loyalists/Journalist");
const { getMonkInfo } = require("../../game/roles/liberals/loyalists/Monk");

const { useUsherPick } = require("../../game/roles/liberals/dissidents/Usher");
const { useInsurrectionaryPick } = require("../../game/roles/fascist/agents/Insurrectionary");
const { useNoblePick } = require("../../game/roles/fascist/agents/Noble");

const { useFishermanReveal } = require("../../game/roles/liberals/loyalists/Fisherman");
const { useOrganizerCheck } = require("../../game/roles/liberals/loyalists/Organizer");
const { resolveSurveyorPick } = require("../../game/roles/liberals/loyalists/Surveyor");
const { resolveHarrierPick, buildHarrierDeathPower } = require("../../game/roles/liberals/loyalists/Harrier");
const { isPacifistRole, buildPacifistReprisalExecutePower } = require("../../game/roles/liberals/loyalists/Pacifist");
const { onSeatDiedMaybeKlutz } = require("../../game/roles/liberals/dissidents/Klutz");
const {
  isGrandmaRole,
  normalizeRegisterAsRoleId,
  setGrandmaRegisterAs,
  buildGrandmaReprisalExecutePower,
} = require("../../game/roles/fascist/agents/Grandma");

const { endGame, scheduleCloseLobby } = require("./election/winConditions");
const { nextAlivePresidentSeat } = require("./election/presidency");
const { getGovernorWinIfChancellorCannotBeNominated } = require("../../game/roles/liberals/loyalists/Governor");

const { getMySeat, isPlayerInLobby, getAliveSeats, isSeatAlive } = require("./guards");

function emitPrivateGameSystem(socket, lobbyId, text) {
  const ts = Date.now();
  socket.emit("game_chat:new", {
    id: `local:system:${lobbyId}:${ts}:${Math.random().toString(36).slice(2)}`,
    lobbyId,
    kind: "system",
    text: String(text ?? ""),
    ts,
  });
}

function getExilePowerRoleId({ role, coverRole }) {
  const id = role?.id;
  if (isExileRoleId(id)) return String(id);

  // Mirror other bluffable powers: fascists may gain a liberal power via their cover role.
  if (role?.alignment === "fascist" && isExileRoleId(coverRole?.id)) {
    return String(coverRole.id);
  }

  return null;
}

function getEffectiveRoleIdForSeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;

  const real = gs?.secret?.roleBySeat?.[s] ?? null;
  if (real?.id !== "Rumorist") return real?.id ?? null;

  const believed =
    gs?.secret?.rumoristBelievedRoleIdBySeat?.[s] ?? gs?.secret?.rumorist?.believedRoleIdBySeat?.[s] ?? null;
  return typeof believed === "string" && believed.trim() ? believed.trim() : real?.id ?? null;
}

function withEffectiveRoleIdForSeat(gs, seat, fn) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return fn();

  const role = gs?.secret?.roleBySeat?.[s] ?? null;
  if (!role || typeof role !== "object") return fn();

  const effectiveId = getEffectiveRoleIdForSeat(gs, s);
  const realId = typeof role?.id === "string" ? role.id : null;
  if (!effectiveId || effectiveId === realId) return fn();

  const prev = role.id;
  role.id = effectiveId;
  try {
    return fn();
  } finally {
    role.id = prev;
  }
}

function buildExileFollowupRolePickPower({ kind, actorSeat, eligibleSeats, resumePhase }) {
  const s = Number(actorSeat);
  if (!Number.isFinite(s)) return null;

  const k = String(kind ?? "");
  const pickCount = k === "monk" ? 2 : 3;

  const seats = Array.isArray(eligibleSeats)
    ? eligibleSeats.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  seats.sort((a, b) => a - b);

  return {
    type: "role_pick",
    kind: k,
    actorSeat: s,
    pickCount,
    pickedSeats: [],
    eligibleSeats: seats,
    resumePhase: typeof resumePhase === "string" && resumePhase ? resumePhase : "election_nomination",
  };
}

function registerRolePowerHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem, closeLobby }) {
  socket.on("game:role:exile", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

    if (gs.phase === "game_over" || gs.gameOver) return;
    if (gs.phase !== "election_nomination") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;
    if (!isSeatAlive(gs, mySeat)) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    // Exile is always self-exile.
    if (target !== mySeat) {
      emitPrivateGameSystem(socket, lobbyId, "You can only exile yourself.");
      return;
    }

    // Exiled players may not run for office; disallow exiling while in office.
    const inOffice = mySeat === gs?.election?.presidentSeat || mySeat === gs?.election?.nominatedChancellorSeat;
    if (inOffice) return;

    ensureSecretState(gs);
    ensureExileState(gs);
    ensurePolicyDeckMeta(gs);
    ensureClaimsState(gs);

    if (isSeatExiled(gs, mySeat)) return;
    if (isSeatExiled(gs, target)) return;

    const myRole = gs.secret?.roleBySeat?.[mySeat] ?? null;
    const myCover = myRole?.alignment === "fascist" ? gs.secret?.coverRoleBySeat?.[mySeat] ?? null : null;

    const effectiveRoleId = getEffectiveRoleIdForSeat(gs, mySeat);
    const effectiveRole = effectiveRoleId ? { ...(myRole ?? {}), id: effectiveRoleId } : myRole;

    const exileRoleId = getExilePowerRoleId({ role: effectiveRole, coverRole: myCover });
    if (!exileRoleId) return;

    const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
    if (!Number.isFinite(deckNumber)) return;

    const lastUsedDeck = Number(gs?.exile?.claimExileUsedDeckBySeat?.[mySeat] ?? 0);
    if (Number.isFinite(lastUsedDeck) && lastUsedDeck === deckNumber) return;

    if (exileRoleId === "Deputy" || exileRoleId === "Journalist") {
      const claimedRole = gs?.claims?.role?.lastBySeat?.[mySeat] ?? null;
      const claimedDeck = Number(gs?.claims?.role?.lastDeckBySeat?.[mySeat] ?? NaN);

      const roleOk = typeof claimedRole === "string" && claimedRole.trim() === exileRoleId;
      const deckOk = Number.isFinite(claimedDeck) && claimedDeck === deckNumber;

      if (!roleOk || !deckOk) {
        emitPrivateGameSystem(socket, lobbyId, `To use ${exileRoleId}, first type: /claim role ${exileRoleId}`);
        return;
      }
    }

    const res = exileSeat(gs, target);
    if (!res?.ok) return;

    gs.exile.claimExileUsedDeckBySeat[mySeat] = deckNumber;

    if (emitGameSystem) {
      if (target === mySeat) {
        emitGameSystem(lobbyId, `Seat ${mySeat} exiles themselves.`).catch(() => {});
      } else {
        emitGameSystem(lobbyId, `Seat ${mySeat} exiles seat ${target}.`).catch(() => {});
      }
    }

    const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
    const learningRumors = gs.secret?.learningRumorsBySeat?.[mySeat] === true;

    // Nun learns living fascist neighbors of the exiled seat.
    if (exileRoleId === "Nun") {
      const fascistNeighborCount = getNunLivingFascistNeighborCount({
        roleBySeat: gs.secret?.roleBySeat ?? null,
        players: gs.players,
        seatCount,
        targetSeat: target,
        learningRumors,
      });

      gs.secret.lastInvestigationBySeat[mySeat] = buildNunInvestigation({
        targetSeat: target,
        fascistNeighborCount,
        ts: Date.now(),
      });
    }

    // Deputy/Journalist/Monk follow-up picks happen immediately after exiling.
    if (exileRoleId === "Deputy" || exileRoleId === "Journalist" || exileRoleId === "Monk") {
      const aliveSeats = getAliveSeats(gs);
      const kind = exileRoleId === "Deputy" ? "deputy" : exileRoleId === "Journalist" ? "journalist" : "monk";
      const eligibleSeats = kind === "monk" ? aliveSeats.filter((s) => s !== mySeat) : aliveSeats;

      const power = buildExileFollowupRolePickPower({
        kind,
        actorSeat: mySeat,
        eligibleSeats,
        resumePhase: "election_nomination",
      });
      if (!power) {
        emitGameState({ io, lobbyId, lobby, playerLobby, online });
        return;
      }

      gs.phase = "power_role_pick";
      gs.power = power;

      const pickCount = Number(gs.power?.pickCount ?? 0);
      if (emitGameSystem && pickCount > 0) {
        emitGameSystem(lobbyId, `Seat ${mySeat} must choose ${pickCount} players.`).catch(() => {});
      }

      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:fisherman", ({ lobbyId, targetSeat } = {}) => {
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

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    ensureSecretState(gs);

    const res = withEffectiveRoleIdForSeat(gs, mySeat, () =>
      useFishermanReveal({ gs, actorSeat: mySeat, targetSeat: target })
    );
    if (!res?.ok) return;

    if (emitGameSystem && res.publicText) {
      emitGameSystem(lobbyId, res.publicText).catch(() => {});
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:organizer", ({ lobbyId, targetSeat } = {}) => {
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

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    ensureSecretState(gs);

    const res = withEffectiveRoleIdForSeat(gs, mySeat, () =>
      useOrganizerCheck({ gs, actorSeat: mySeat, targetSeat: target })
    );
    if (!res?.ok) return;

    if (emitGameSystem && res.publicText) {
      emitGameSystem(lobbyId, res.publicText).catch(() => {});
    }

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  // Deck-scoped optional powers (Usher / Insurrectionary / Noble)
  socket.on("game:power:usher", ({ lobbyId, targetSeat } = {}) => {
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

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    ensureSecretState(gs);

    const res = useUsherPick({ gs, actorSeat: mySeat, targetSeat: target, now: Date.now() });
    if (!res?.ok) return;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:insurrectionary", ({ lobbyId, targetSeat } = {}) => {
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

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    ensureSecretState(gs);
    ensurePolicyDeckMeta(gs);

    const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
    const res = useInsurrectionaryPick({ gs, actorSeat: mySeat, targetSeat: target, deckNumber });
    if (!res?.ok) return;

    const forcedStr = res.forced === true ? "Seat will learn rumors until reshuffle." : "Seat was already learning rumors.";
    gs.secret.lastInvestigationBySeat[mySeat] = {
      ts: Date.now(),
      targetSeat: target,
      result: { kind: "text", text: `Insurrectionary: ${forcedStr}` },
    };

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:noble", ({ lobbyId, targetSeat } = {}) => {
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

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;

    ensureSecretState(gs);
    ensurePolicyDeckMeta(gs);

    const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
    const res = useNoblePick({ gs, actorSeat: mySeat, targetSeat: target, deckNumber });
    if (!res?.ok) return;

    // Noble kill is anonymous (do not reveal Noble).
    const aliveSeatsBefore = getAliveSeats(gs);
    const targetRole = gs.secret?.roleBySeat?.[target] ?? null;

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

    const p = (gs.players ?? []).find((x) => x?.seat === target);
    if (!p) return;
    p.alive = false;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${target} has died.`).catch(() => {});
    }

    if (targetRole?.id === "Hitler") {
      const didEnd = endGame(gs, "liberal", "Hitler died.");
      if (didEnd) scheduleCloseLobby(gs, closeLobby, lobbyId);
      if (emitGameSystem) {
        emitGameSystem(lobbyId, "Game over. Liberals win! Hitler has died.").catch(() => {});
      }
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    onSeatDiedMaybeKlutz({ gs, deadSeat: target, now: Date.now() });

    // If the current president dies, advance to the next alive president now.
    if (gs?.election?.presidentSeat === target) {
      const nextPres = nextAlivePresidentSeat(gs.players, target, gs?.exile?.exiledBySeat);
      gs.phase = "election_nomination";
      gs.election.presidentSeat = nextPres;
      gs.election.nominatedChancellorSeat = null;

      const aliveSeatsNow = getAliveSeats(gs);
      const votes = {};
      for (const s of aliveSeatsNow) votes[s] = null;
      gs.election.votes = votes;
      gs.election.revealed = false;
      gs.election.passed = null;
    }

    // If the nominee dies, clear the nomination.
    if (gs?.election?.nominatedChancellorSeat === target) {
      gs.phase = "election_nomination";
      gs.election.nominatedChancellorSeat = null;

      const aliveSeatsNow = getAliveSeats(gs);
      const votes = {};
      for (const s of aliveSeatsNow) votes[s] = null;
      gs.election.votes = votes;
      gs.election.revealed = false;
      gs.election.passed = null;
    }

    // Harrier: upon dying, publicly chooses a player and learns their role.
    if (targetRole?.id === "Harrier") {
      const aliveSeatsNow = getAliveSeats(gs);
      const harrierPower = buildHarrierDeathPower({
        actorSeat: target,
        eligibleSeats: aliveSeatsNow,
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

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:grandmaRegisterAs", ({ lobbyId, registerAsRoleId } = {}) => {
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

    ensureSecretState(gs);

    const myRole = gs.secret?.roleBySeat?.[mySeat] ?? null;
    if (!isGrandmaRole(myRole)) return;

    const normalized = normalizeRegisterAsRoleId(registerAsRoleId);
    const ok = setGrandmaRegisterAs({ role: myRole, registerAsRoleId: normalized });
    if (!ok) return;

    const text = normalized
      ? `Grandma registers as ${normalized}.`
      : "Grandma clears their registration.";

    if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
      gs.secret.lastInvestigationBySeat = {};
    }

    gs.secret.lastInvestigationBySeat[mySeat] = {
      ts: Date.now(),
      result: { kind: "text", text },
    };

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });

  socket.on("game:power:rolePick", ({ lobbyId, targetSeat } = {}) => {
    if (typeof lobbyId !== "string") return;
    if (!isPlayerInLobby(socket.id, lobbyId, playerLobby)) return;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.status !== "in_game") return;

    ensureGameState(lobby);
    const gs = lobby.gameState;
    if (!gs) return;

    if (gs.phase === "game_over" || gs.gameOver) return;
    if (gs.phase !== "power_role_pick") return;
    if (gs.power?.type !== "role_pick") return;

    const mySeat = getMySeat(lobby, socket, online);
    if (!mySeat) return;

    const allowDeadActor = gs.power.allowDeadActor === true;
    if (!allowDeadActor && !isSeatAlive(gs, mySeat)) return;
    if (mySeat !== gs.power.actorSeat) return;

    const target = Number(targetSeat);
    if (!Number.isFinite(target)) return;
    if (!Array.isArray(gs.power.eligibleSeats) || !gs.power.eligibleSeats.includes(target)) return;
    if (!isSeatAlive(gs, target)) return;

    ensureSecretState(gs);

    if (!Array.isArray(gs.power.pickedSeats)) gs.power.pickedSeats = [];
    if (gs.power.pickedSeats.includes(target)) return;

    gs.power.pickedSeats.push(target);
    gs.power.eligibleSeats = (gs.power.eligibleSeats ?? []).filter((s) => s !== target);

    const pickCount = Number(gs.power.pickCount ?? 0);
    if (!Number.isFinite(pickCount) || pickCount <= 0) return;

    if (gs.power.pickedSeats.length < pickCount) {
      emitGameState({ io, lobbyId, lobby, playerLobby, online });
      return;
    }

    const picks = gs.power.pickedSeats
      .slice(0, pickCount)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x));

    const kind = String(gs.power.kind ?? "");
    const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
    const learningRumors = gs.secret?.learningRumorsBySeat?.[mySeat] === true;

    let text = null;
    if (kind === "deputy") {
      text =
        getDeputyInfo({
          roleBySeat: gs.secret?.roleBySeat ?? null,
          seatCount,
          pickedSeats: picks,
          learningRumors,
        })?.text ?? null;
    } else if (kind === "journalist") {
      const c = getJournalistLiberalCount({
        roleBySeat: gs.secret?.roleBySeat ?? null,
        seatCount,
        pickedSeats: picks,
        learningRumors,
      });
      const n = Number(c ?? 0);
      text = `Journalist info: ${n} liberal${n === 1 ? "" : "s"} among seats ${picks.join(", ")}.`;
    } else if (kind === "monk") {
      text =
        getMonkInfo({
          roleBySeat: gs.secret?.roleBySeat ?? null,
          seatCount,
          pickedSeats: picks,
          actorSeat: mySeat,
          learningRumors,
        })?.text ?? null;
    } else if (kind === "surveyor") {
      text =
        resolveSurveyorPick({
          actorSeat: mySeat,
          pickedSeats: picks,
          roleBySeat: gs.secret?.roleBySeat ?? null,
          seatCount,
          learningRumors,
        })?.text ?? null;
    } else if (kind === "harrier") {
      const t = picks[0] ?? null;
      text =
        resolveHarrierPick({
          actorSeat: mySeat,
          targetSeat: t,
          targetRole: t != null ? gs.secret?.roleBySeat?.[t] ?? null : null,
          roleBySeat: gs.secret?.roleBySeat ?? null,
          seatCount,
          learningRumors,
        })?.text ?? null;
    } else if (kind === "usher") {
      const t = picks[0] ?? null;
      const res = useUsherPick({ gs, actorSeat: mySeat, targetSeat: t, now: Date.now(), writeLastInvestigation: false });
      if (!res?.ok) return;
      text = res.privateText ?? null;
    } else if (kind === "insurrectionary") {
      const t = picks[0] ?? null;
      const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
      const res = useInsurrectionaryPick({ gs, actorSeat: mySeat, targetSeat: t, deckNumber });
      if (!res?.ok) return;
      const forcedStr = res.forced === true ? " (now learning rumors)" : "";
      text = `Insurrectionary: For deck ${res.deckNumber}, seat ${res.targetSeat}${forcedStr}.`;
    } else if (kind === "noble") {
      const t = picks[0] ?? null;
      const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
      const res = useNoblePick({ gs, actorSeat: mySeat, targetSeat: t, deckNumber });
      if (!res?.ok) return;
      text = `Noble: For deck ${res.deckNumber}, your marked seat is ${res.targetSeat}.`;
    }

    const announcePick =
      kind === "deputy" ||
      kind === "journalist" ||
      kind === "monk" ||
      kind === "surveyor" ||
      kind === "harrier";

    if (emitGameSystem && announcePick) {
      emitGameSystem(lobbyId, `Seat ${mySeat} chooses seats ${picks.join(", ")}.`).catch(() => {});
    }

    if (text) {
      gs.secret.lastInvestigationBySeat[mySeat] = {
        ts: Date.now(),
        result: { kind: "text", text },
      };
    }

    const resume = String(gs.power.resumePhase ?? "election_nomination");
    gs.power = null;
    gs.phase = resume;

    emitGameState({ io, lobbyId, lobby, playerLobby, online });
  });
}

module.exports = { registerRolePowerHandlers };
