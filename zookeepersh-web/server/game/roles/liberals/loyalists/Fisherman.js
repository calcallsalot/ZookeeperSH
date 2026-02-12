// The Fisherman, once per game, may publicly choose a dead player and learns that player's role.

// Used for rumorized info when a player is learning rumors.
// Keep in sync with app/gameLogic/roles.js ROLE_GROUPS.
const ROLE_ID_POOL = [
  // Loyalists
  "Bureaucrat",
  "Inspector",
  "Vicar",
  "Surveyor",
  "Nun",
  "Fisherman",
  "Organizer",
  "Deputy",
  "Journalist",
  "Monk",
  "Harrier",
  "Pacifist",
  "Governor",

  // Dissidents
  "Usher",
  "Rumorist",
  "Klutz",

  // Agents
  "Insurrectionary",
  "Noble",
  "Grandma",

  // Dictator
  "Hitler",
];

function playerBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function ensureFishermanState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.fisherman || typeof gs.secret.fisherman !== "object") {
    gs.secret.fisherman = { usedBySeat: {} };
  }

  if (!gs.secret.fisherman.usedBySeat || typeof gs.secret.fisherman.usedBySeat !== "object") {
    gs.secret.fisherman.usedBySeat = {};
  }

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
}

function hasFishermanPower(role, coverRole) {
  if (role?.id === "Fisherman") return true;

  // Mirror how exile powers work: fascists may gain a bluffable liberal power via their cover role.
  if (role?.alignment === "fascist" && coverRole?.id === "Fisherman") return true;

  return false;
}

function rumorizeRoleId(truthRoleId) {
  const truth = String(truthRoleId ?? "");
  if (!truth) return null;

  const options = ROLE_ID_POOL.filter((id) => id && id !== truth);
  if (options.length === 0) return truth;
  return options[Math.floor(Math.random() * options.length)] ?? truth;
}

function canUseFishermanReveal({ gs, actorSeat, targetSeat }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  if (gs.phase === "game_over" || gs.gameOver) return { ok: false, reason: "game_over" };

  const actor = Number(actorSeat);
  if (!Number.isFinite(actor)) return { ok: false, reason: "invalid_actor_seat" };

  const target = Number(targetSeat);
  if (!Number.isFinite(target)) return { ok: false, reason: "invalid_target_seat" };

  const actorPlayer = playerBySeat(gs, actor);
  if (!actorPlayer) return { ok: false, reason: "unknown_actor_seat" };
  if (actorPlayer.alive === false) return { ok: false, reason: "dead_actor" };

  const targetPlayer = playerBySeat(gs, target);
  if (!targetPlayer) return { ok: false, reason: "unknown_target_seat" };
  if (targetPlayer.alive !== false) return { ok: false, reason: "target_not_dead" };

  const secret = gs.secret;
  if (!secret || typeof secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const role = secret?.roleBySeat?.[actor] ?? null;
  const cover = secret?.coverRoleBySeat?.[actor] ?? null;
  if (!hasFishermanPower(role, cover)) return { ok: false, reason: "no_power" };

  ensureFishermanState(gs);
  if (secret?.fisherman?.usedBySeat?.[actor] === true) return { ok: false, reason: "already_used" };

  const targetRole = secret?.roleBySeat?.[target] ?? null;
  if (!targetRole?.id) return { ok: false, reason: "target_role_missing" };

  return { ok: true, reason: null };
}

function useFishermanReveal({ gs, actorSeat, targetSeat, now, writeLastInvestigation }) {
  const check = canUseFishermanReveal({ gs, actorSeat, targetSeat });
  if (!check.ok) return { ok: false, reason: check.reason };

  const actor = Number(actorSeat);
  const target = Number(targetSeat);

  ensureFishermanState(gs);
  gs.secret.fisherman.usedBySeat[actor] = true;

  const truthRoleIdRaw = gs.secret?.roleBySeat?.[target]?.id ?? null;
  const truthRoleId = truthRoleIdRaw != null ? String(truthRoleIdRaw) : null;

  const learningRumors = gs.secret?.learningRumorsBySeat?.[actor] === true;
  const revealedRoleId = learningRumors ? rumorizeRoleId(truthRoleId) : truthRoleId;

  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();

  const privateText =
    revealedRoleId != null
      ? `Fisherman info: Seat ${target}'s role is ${revealedRoleId}.`
      : "Fisherman info: inconclusive.";

  const shouldWrite = writeLastInvestigation !== false;
  if (shouldWrite) {
    gs.secret.lastInvestigationBySeat[actor] = {
      ts,
      targetSeat: target,
      result: { kind: "text", text: privateText },
    };
  }

  return {
    ok: true,
    reason: null,
    actorSeat: actor,
    targetSeat: target,
    revealedRoleId,
    learningRumors,

    // Intended for emitGameSystem(...) by the caller.
    publicText: `Seat ${actor} uses Fisherman on seat ${target}.`,
    privateText,
  };
}

module.exports = {
  ROLE_ID_POOL,
  ensureFishermanState,
  hasFishermanPower,
  canUseFishermanReveal,
  useFishermanReveal,
};
