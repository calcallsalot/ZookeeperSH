
function getTotalEnactedPolicies(enactedPolicies) {
  const libRaw = Number(enactedPolicies?.liberal ?? 0);
  const fasRaw = Number(enactedPolicies?.fascist ?? 0);

  const lib = Number.isFinite(libRaw) ? Math.max(0, libRaw) : 0;
  const fas = Number.isFinite(fasRaw) ? Math.max(0, fasRaw) : 0;

  return Math.trunc(lib + fas);
}

// The Surveyor triggers on every 3rd enacted policy (3rd, 6th, 9th, ...).
function isSurveyorTriggerPolicyCount(totalEnactedPolicies) {
  const nRaw = Number(totalEnactedPolicies ?? 0);
  const n = Number.isFinite(nRaw) ? Math.trunc(nRaw) : 0;
  if (n <= 0) return false;
  return n % 3 === 0;
}

function shouldTriggerSurveyorOnEnact({ enactedPolicies, lastTriggeredPolicyCount }) {
  const total = getTotalEnactedPolicies(enactedPolicies);
  if (!isSurveyorTriggerPolicyCount(total)) return false;

  const lastRaw = Number(lastTriggeredPolicyCount ?? 0);
  const last = Number.isFinite(lastRaw) ? Math.trunc(lastRaw) : 0;
  return total !== last;
}

function getTeamForSurveyor(role) {
  if (!role || typeof role !== "object") return null;

  // Special register rules (keep aligned with investigation logic).
  if (role.id === "Grandma") return "liberal";

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return "liberal";
  if (g === "agent" || g === "dictator") return "fascist";

  const a = role.alignment;
  if (a === "liberal" || a === "fascist") return a;

  return null;
}

// Registration rule: Liberals register as a Dictator to the Surveyor.
function registersAsDictatorForSurveyor(role) {
  if (!role || typeof role !== "object") return null;

  if (role.group === "dictator") return true;

  const team = getTeamForSurveyor(role);
  if (team === "liberal") return true;
  if (team === "fascist") return false;

  return null;
}

function surveyorTruthEitherDictator(roleA, roleB) {
  const a = registersAsDictatorForSurveyor(roleA);
  const b = registersAsDictatorForSurveyor(roleB);

  if (a === true || b === true) return true;
  if (a === false && b === false) return false;
  return null;
}

function rumorizeSurveyorEitherDictator(truth) {
  if (truth == null) return null;
  return !truth;
}

function getSurveyorEitherDictator({ roleA, roleB, learningRumors }) {
  const truth = surveyorTruthEitherDictator(roleA, roleB);
  if (!learningRumors) return truth;
  return rumorizeSurveyorEitherDictator(truth);
}

function getSurveyorEitherDictatorBySeat({ roleBySeat, seatA, seatB, learningRumors }) {
  const a = Number(seatA);
  const b = Number(seatB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  return getSurveyorEitherDictator({
    roleA: roleBySeat?.[a] ?? null,
    roleB: roleBySeat?.[b] ?? null,
    learningRumors,
  });
}

function buildSurveyorInfoText({ seatA, seatB, eitherDictator }) {
  const a = Number(seatA);
  const b = Number(seatB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Surveyor info: inconclusive.";

  if (eitherDictator == null) return "Surveyor info: inconclusive.";
  if (eitherDictator) return `Surveyor info: At least one of seats ${a} and ${b} is the Dictator.`;
  return `Surveyor info: Neither seat ${a} nor seat ${b} is the Dictator.`;
}

function inferSeatCount(roleBySeat) {
  if (!roleBySeat || typeof roleBySeat !== "object") return 0;

  let max = 0;
  for (const k of Object.keys(roleBySeat)) {
    const s = Number(k);
    if (!Number.isFinite(s)) continue;
    if (s > max) max = s;
  }
  return max;
}

function normalizePickedSeats(pickedSeats, seatCount) {
  const n = Number(seatCount ?? 0);
  const maxSeat = Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;

  const raw = Array.isArray(pickedSeats) ? pickedSeats : [];
  const out = [];
  const seen = new Set();

  for (const x of raw) {
    const s = Number(x);
    if (!Number.isFinite(s)) continue;
    const seat = Math.trunc(s);
    if (seat <= 0) continue;
    if (maxSeat != null && seat > maxSeat) continue;
    if (seen.has(seat)) continue;
    seen.add(seat);
    out.push(seat);
  }

  return out;
}

function resolveSurveyorPick({ actorSeat, pickedSeats, roleBySeat, seatCount, learningRumors }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);

  const picks = normalizePickedSeats(pickedSeats, n).slice(0, 2);
  const [a, b] = picks;

  const eitherDictator =
    picks.length === 2
      ? getSurveyorEitherDictatorBySeat({ roleBySeat, seatA: a, seatB: b, learningRumors })
      : null;

  return {
    actorSeat: Number(actorSeat),
    pickedSeats: picks,
    eitherDictator,
    text: buildSurveyorInfoText({ seatA: a, seatB: b, eitherDictator }),
  };
}

function buildSurveyorPower({ actorSeat, eligibleSeats, resumePhase }) {
  const s = Number(actorSeat);
  if (!Number.isFinite(s)) return null;

  const seats = Array.isArray(eligibleSeats) ? eligibleSeats.map((x) => Number(x)).filter(Number.isFinite) : [];
  seats.sort((a, b) => a - b);

  return {
    type: "role_pick",
    kind: "surveyor",
    actorSeat: s,
    pickCount: 2,
    pickedSeats: [],
    eligibleSeats: seats,
    resumePhase: typeof resumePhase === "string" && resumePhase ? resumePhase : "election_nomination",
  };
}

function ensureSurveyorState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.surveyor || typeof gs.secret.surveyor !== "object") {
    gs.secret.surveyor = {
      lastTriggeredPolicyCount: 0,
    };
  }

  const raw = Number(gs.secret.surveyor.lastTriggeredPolicyCount ?? 0);
  gs.secret.surveyor.lastTriggeredPolicyCount = Number.isFinite(raw) ? Math.trunc(raw) : 0;

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
}

function findSurveyorSeat({ roleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return null;

  for (let s = 1; s <= n; s += 1) {
    if (roleBySeat?.[s]?.id === "Surveyor") return s;
  }
  return null;
}

module.exports = {
  getTotalEnactedPolicies,
  isSurveyorTriggerPolicyCount,
  shouldTriggerSurveyorOnEnact,
  getTeamForSurveyor,
  registersAsDictatorForSurveyor,
  surveyorTruthEitherDictator,
  rumorizeSurveyorEitherDictator,
  getSurveyorEitherDictator,
  getSurveyorEitherDictatorBySeat,
  buildSurveyorInfoText,
  inferSeatCount,
  normalizePickedSeats,
  resolveSurveyorPick,
  buildSurveyorPower,
  ensureSurveyorState,
  findSurveyorSeat,
};
