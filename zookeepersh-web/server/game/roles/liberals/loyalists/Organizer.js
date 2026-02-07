// The Organizer, once per game, may publicly choose a player and learns whether that player is an Agent
// or is learning rumors.

function playerBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function ensureOrganizerState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.organizer || typeof gs.secret.organizer !== "object") {
    gs.secret.organizer = { usedBySeat: {} };
  }

  if (!gs.secret.organizer.usedBySeat || typeof gs.secret.organizer.usedBySeat !== "object") {
    gs.secret.organizer.usedBySeat = {};
  }

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }

  if (!gs.secret.learningRumorsBySeat || typeof gs.secret.learningRumorsBySeat !== "object") {
    gs.secret.learningRumorsBySeat = {};
  }
}

function hasOrganizerPower(role, coverRole) {
  if (role?.id === "Organizer") return true;

  // Mirror how exile/fisherman powers work: fascists may gain a bluffable liberal power via their cover role.
  if (role?.alignment === "fascist" && coverRole?.id === "Organizer") return true;

  return false;
}

function countsAsAgentForOrganizer(role) {
  if (!role || typeof role !== "object") return false;

  // Special register rules
  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return false;

  // Future-proofing: some roles may be able to "register" as another group.
  const registerGroup =
    role.registerAsGroup ?? role.registerGroup ?? role.registerAs?.group ?? role.registerAs?.registerGroup ?? null;
  if (registerGroup === "agent") return true;
  if (registerGroup != null) return false;

  return role.group === "agent";
}

function countsAsLearningRumorsForOrganizer({ learningRumorsBySeat, seat, role }) {
  const s = Number(seat);
  if (Number.isFinite(s) && learningRumorsBySeat?.[s] === true) return true;

  // Baseline: Rumorist always learns rumors.
  if (role?.id === "Rumorist") return true;

  return false;
}

function organizerTruthIsAgentOrLearningRumors({ targetSeat, targetRole, learningRumorsBySeat }) {
  return (
    countsAsAgentForOrganizer(targetRole) ||
    countsAsLearningRumorsForOrganizer({ learningRumorsBySeat, seat: targetSeat, role: targetRole })
  );
}

function rumorizeOrganizerTruth(truth) {
  if (truth == null) return null;

  // Rumors may contain arbitrary or false info; for a boolean question,
  // the simplest rumor is the opposite of the truth.
  return !truth;
}

function getOrganizerLearnedIsAgentOrLearningRumors({ targetSeat, targetRole, learningRumorsBySeat, learningRumors }) {
  const truth = organizerTruthIsAgentOrLearningRumors({ targetSeat, targetRole, learningRumorsBySeat });
  if (!learningRumors) return truth;
  return rumorizeOrganizerTruth(truth);
}

function getOrganizerInfoText({ targetSeat, learnedIsAgentOrLearningRumors }) {
  const s = Number(targetSeat);
  const seatStr = Number.isFinite(s) ? String(s) : "?";

  if (learnedIsAgentOrLearningRumors === true) {
    return `Organizer info: Seat ${seatStr} is an Agent or is learning rumors.`;
  }
  if (learnedIsAgentOrLearningRumors === false) {
    return `Organizer info: Seat ${seatStr} is not an Agent and is not learning rumors.`;
  }

  return "Organizer info: inconclusive.";
}

function canUseOrganizerCheck({ gs, actorSeat, targetSeat }) {
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
  if (targetPlayer.alive === false) return { ok: false, reason: "dead_target" };

  const secret = gs.secret;
  if (!secret || typeof secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const role = secret?.roleBySeat?.[actor] ?? null;
  const cover = secret?.coverRoleBySeat?.[actor] ?? null;
  if (!hasOrganizerPower(role, cover)) return { ok: false, reason: "no_power" };

  ensureOrganizerState(gs);
  if (secret?.organizer?.usedBySeat?.[actor] === true) return { ok: false, reason: "already_used" };

  const targetRole = secret?.roleBySeat?.[target] ?? null;
  if (!targetRole) return { ok: false, reason: "target_role_missing" };

  return { ok: true, reason: null };
}

function useOrganizerCheck({ gs, actorSeat, targetSeat, now, writeLastInvestigation }) {
  const check = canUseOrganizerCheck({ gs, actorSeat, targetSeat });
  if (!check.ok) return { ok: false, reason: check.reason };

  const actor = Number(actorSeat);
  const target = Number(targetSeat);

  ensureOrganizerState(gs);
  gs.secret.organizer.usedBySeat[actor] = true;

  const targetRole = gs.secret?.roleBySeat?.[target] ?? null;
  const learningRumorsBySeat = gs.secret?.learningRumorsBySeat ?? {};

  const learningRumors = learningRumorsBySeat?.[actor] === true;
  const learnedIsAgentOrLearningRumors = getOrganizerLearnedIsAgentOrLearningRumors({
    targetSeat: target,
    targetRole,
    learningRumorsBySeat,
    learningRumors,
  });

  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  const privateText = getOrganizerInfoText({ targetSeat: target, learnedIsAgentOrLearningRumors });

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
    learnedIsAgentOrLearningRumors,
    learningRumors,

    // Intended for emitGameSystem(...) by the caller.
    publicText: `Seat ${actor} uses Organizer on seat ${target}.`,
    privateText,
  };
}

module.exports = {
  ensureOrganizerState,
  hasOrganizerPower,
  countsAsAgentForOrganizer,
  getOrganizerLearnedIsAgentOrLearningRumors,
  getOrganizerInfoText,
  canUseOrganizerCheck,
  useOrganizerCheck,
};
