const { ensurePolicyDeckMeta, ensureGameState, ensureSecretState, emitGameState } = require("./gameState");
const { ensureExileState, isSeatExiled, exileSeat } = require("../../game/exile");
const { isExileRoleId } = require("../../game/roles");

const {
  getNunLivingFascistNeighborCount,
  buildNunInvestigation,
} = require("../../game/roles/liberals/loyalists/Nun");
const { getDeputyInfo } = require("../../game/roles/liberals/loyalists/Deputy");
const { getJournalistLiberalCount } = require("../../game/roles/liberals/loyalists/Journalist");
const { getMonkInfo } = require("../../game/roles/liberals/loyalists/Monk");

function getMyName(socket, online) {
  const p = online.get(socket.id);
  return p?.name ?? null;
}

function getMySeat(lobby, socket, online) {
  const name = getMyName(socket, online);
  if (!name) return null;

  const s = lobby.seatByName?.[name];
  if (typeof s === "number") return s;

  const idx = (lobby.players ?? []).indexOf(name);
  return idx >= 0 ? idx + 1 : null;
}

function isPlayerInLobby(socketId, lobbyId, playerLobby) {
  const info = playerLobby.get(socketId);
  if (!info) return false;
  if (info.lobbyId !== lobbyId) return false;
  return info.role === "player";
}

function getAliveSeats(gameState) {
  return (gameState?.players ?? []).filter((p) => p?.alive).map((p) => p.seat);
}

function isSeatAlive(gameState, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return false;
  const p = (gameState?.players ?? []).find((x) => x?.seat === s);
  return Boolean(p?.alive);
}

function getExilePowerRoleId({ role }) {
  const id = role?.id;
  return isExileRoleId(id) ? String(id) : null;
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

function registerRolePowerHandlers({ io, socket, lobbies, online, playerLobby, emitGameSystem }) {
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

    // Exiled players may not run for office; disallow exiling while in office.
    const inOffice = mySeat === gs?.election?.presidentSeat || mySeat === gs?.election?.nominatedChancellorSeat;
    if (inOffice) return;

    ensureSecretState(gs);
    ensureExileState(gs);
    ensurePolicyDeckMeta(gs);

    if (isSeatExiled(gs, mySeat)) return;
    if (isSeatExiled(gs, target)) return;

    const myRole = gs.secret?.roleBySeat?.[mySeat] ?? null;
    const exileRoleId = getExilePowerRoleId({ role: myRole });
    if (!exileRoleId) return;

    const deckNumber = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
    if (!Number.isFinite(deckNumber)) return;

    const lastUsedDeck = Number(gs?.exile?.claimExileUsedDeckBySeat?.[mySeat] ?? 0);
    if (Number.isFinite(lastUsedDeck) && lastUsedDeck === deckNumber) return;

    const res = exileSeat(gs, target);
    if (!res?.ok) return;

    gs.exile.claimExileUsedDeckBySeat[mySeat] = deckNumber;

    if (emitGameSystem) {
      emitGameSystem(lobbyId, `Seat ${mySeat} exiles seat ${target}.`).catch(() => {});
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
    }

    if (emitGameSystem) {
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
