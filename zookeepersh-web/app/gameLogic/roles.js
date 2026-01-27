const { shuffle } = require("./shuffle");

// Role groups (docs/roles.txt)
const ROLE_GROUPS = {
  loyalist: [
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
  ],
  dissident: ["Usher", "Rumorist", "Conformist", "Klutz"],
  agent: ["Insurrectionary", "Noble", "Grandma", "Jester"],
  dictator: ["Hitler"],
};

const ROLE_GROUP_TO_ALIGNMENT = {
  loyalist: "liberal",
  dissident: "liberal",
  agent: "fascist",
  dictator: "fascist",
};

// UI colors by group
const ROLE_GROUP_TO_COLOR = {
  loyalist: "#76E4FF", // light cyan-blue
  dissident: "#1E40AF", // dark blue
  agent: "#F59E0B", // orange
  dictator: "#991B1B", // dark red
};

function buildRole(roleId, group) {
  return {
    id: roleId,
    group,
    alignment: ROLE_GROUP_TO_ALIGNMENT[group] ?? "liberal",
    color: ROLE_GROUP_TO_COLOR[group] ?? "rgba(255,255,255,0.9)",
  };
}

function assignRolesFor7() {
  // 7-player baseline: 4 Liberals (2 loyalist + 2 dissident), 3 Fascists (2 agent + Hitler)
  // Guarantee Bureaucrat exists for its starting info.
  const loyalistPool = [...ROLE_GROUPS.loyalist].filter((r) => r !== "Bureaucrat");
  shuffle(loyalistPool);
  const loyalistRoles = ["Bureaucrat", loyalistPool[0] ?? "Inspector"];

  const dissidentRoles = shuffle([...ROLE_GROUPS.dissident]).slice(0, 2);
  const agentRoles = shuffle([...ROLE_GROUPS.agent]).slice(0, 2);

  const roles = [
    ...loyalistRoles.map((r) => buildRole(r, "loyalist")),
    ...dissidentRoles.map((r) => buildRole(r, "dissident")),
    ...agentRoles.map((r) => buildRole(r, "agent")),
    buildRole("Hitler", "dictator"),
  ];

  shuffle(roles);
  return roles;
}

function assignRolesFallback(playerCount) {
  const n = Number(playerCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];

  // Minimal fallback: 1 Hitler + fill with Loyalist roles.
  const roles = [buildRole("Hitler", "dictator")];
  const loyalistPool = shuffle([...ROLE_GROUPS.loyalist]);
  let i = 0;
  while (roles.length < n) {
    const r = loyalistPool[i % loyalistPool.length] ?? "Inspector";
    roles.push(buildRole(r, "loyalist"));
    i += 1;
  }
  shuffle(roles);
  return roles.slice(0, n);
}

function assignRolesForPlayerCount(playerCount) {
  const n = Number(playerCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];
  if (n === 7) return assignRolesFor7();
  return assignRolesFallback(n);
}

function isFascistRole(role) {
  return role?.alignment === "fascist";
}

// Seats are a ring: (1-2, 2-3, ..., N-1–N, N-1)
function countAdjacentFascistPairs(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 1) return 0;

  let pairs = 0;
  for (let s = 1; s <= n; s += 1) {
    const next = s === n ? 1 : s + 1;
    if (isFascistRole(roleBySeat?.[s]) && isFascistRole(roleBySeat?.[next])) pairs += 1;
  }
  return pairs;
}

function buildPrivateRoleState(seatCount) {
  const roles = assignRolesForPlayerCount(seatCount);
  /** @type {Record<number, any>} */
  const roleBySeat = {};
  for (let i = 0; i < seatCount; i += 1) {
    roleBySeat[i + 1] = roles[i] ?? buildRole("Inspector", "loyalist");
  }

  /** @type {Record<number, any>} */
  const cluesBySeat = {};

  const fascistPairs = countAdjacentFascistPairs(roleBySeat, seatCount);
  for (let s = 1; s <= seatCount; s += 1) {
    if (roleBySeat[s]?.id === "Bureaucrat") {
      cluesBySeat[s] = {
        bureaucratFascistPairs: fascistPairs,
      };
    }
  }

  return { roleBySeat, cluesBySeat };
}

module.exports = {
  ROLE_GROUPS,
  ROLE_GROUP_TO_ALIGNMENT,
  ROLE_GROUP_TO_COLOR,
  buildRole,
  assignRolesForPlayerCount,
  countAdjacentFascistPairs,
  buildPrivateRoleState,
};
