// The Grandma, upon dying, remains alive and publicly chooses a player to die,
// and may register as any Liberal while their loyalty card remains Liberal.

// Keep in sync with docs/roles.txt and app/gameLogic/roles.js
const LOYALIST_ROLE_IDS = [
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
];

const DISSIDENT_ROLE_IDS = ["Usher", "Rumorist", "Klutz"]; // TODO later: Conformist

const LIBERAL_ROLE_ID_POOL = [...LOYALIST_ROLE_IDS, ...DISSIDENT_ROLE_IDS];

function isGrandmaRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Grandma");
}

function liberalGroupForRoleId(roleId) {
  const id = String(roleId ?? "");
  if (LOYALIST_ROLE_IDS.includes(id)) return "loyalist";
  if (DISSIDENT_ROLE_IDS.includes(id)) return "dissident";
  return null;
}

function normalizeRegisterAsRoleId(roleId) {
  const id = typeof roleId === "string" ? roleId.trim() : String(roleId ?? "").trim();
  if (!id) return null;
  if (!LIBERAL_ROLE_ID_POOL.includes(id)) return null;
  return id;
}

function setGrandmaRegisterAs({ role, registerAsRoleId }) {
  if (!isGrandmaRole(role)) return false;

  const id = normalizeRegisterAsRoleId(registerAsRoleId);
  if (!id) {
    // Clear any prior registration.
    if (role && typeof role === "object") delete role.registerAs;
    return true;
  }

  const group = liberalGroupForRoleId(id) ?? "loyalist";
  role.registerAs = {
    group,
    alignment: "liberal",
    roleId: id,
  };
  return true;
}

function getGrandmaRegisterAsRoleId(role) {
  if (!isGrandmaRole(role)) return null;
  const raw = role?.registerAs?.roleId ?? null;
  return normalizeRegisterAsRoleId(raw);
}

// Helper for role-reveal style effects: Grandma may register as a Liberal role.
function getRoleIdForRoleReveal(role) {
  if (!role || typeof role !== "object") return null;
  if (role.id !== "Grandma") return role.id ?? null;

  const reg = getGrandmaRegisterAsRoleId(role);
  return reg ?? role.id;
}

function buildGrandmaReprisalExecutePower(actorSeat, aliveSeats) {
  const actor = Number(actorSeat);
  if (!Number.isFinite(actor)) return null;

  const seats = Array.isArray(aliveSeats) ? aliveSeats : [];
  const eligibleSeats = seats
    .map((s) => Number(s))
    .filter((s) => Number.isFinite(s) && s !== actor);

  eligibleSeats.sort((a, b) => a - b);

  return {
    type: "execute",
    presidentSeat: actor,
    eligibleSeats,
  };
}

module.exports = {
  LOYALIST_ROLE_IDS,
  DISSIDENT_ROLE_IDS,
  LIBERAL_ROLE_ID_POOL,
  isGrandmaRole,
  liberalGroupForRoleId,
  normalizeRegisterAsRoleId,
  setGrandmaRegisterAs,
  getGrandmaRegisterAsRoleId,
  getRoleIdForRoleReveal,
  buildGrandmaReprisalExecutePower,
};
