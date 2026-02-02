const fs = require("fs");
const path = require("path");

let ROLE_DESC_CACHE = null;
let ROLE_DESC_CACHE_ERR = null;

function parseRolesDoc(text) {
  /** @type {Record<string, string>} */
  const out = {};
  const lines = String(text ?? "").split(/\r?\n/);

  for (const raw of lines) {
    const line = String(raw ?? "").trim();
    if (!line) continue;

    if (
      line === "Loyalists" ||
      line === "Dissidents" ||
      line === "Agents" ||
      line === "Dictator" ||
      line === "Rules and Notes"
    ) {
      continue;
    }

    if (line.startsWith("The ")) {
      const m = line.match(/^The\s+([A-Za-z]+)\b/);
      if (!m) continue;
      const roleName = m[1];
      out[roleName] = line;
      continue;
    }

    if (line.startsWith("Hitler ")) {
      out.Hitler = line;
    }
  }

  return out;
}

function getRoleDescriptions() {
  if (ROLE_DESC_CACHE) return ROLE_DESC_CACHE;
  if (ROLE_DESC_CACHE_ERR) return {};

  try {
    const filePath = path.join(__dirname, "../../../docs/roles.txt");
    const text = fs.readFileSync(filePath, "utf8");
    ROLE_DESC_CACHE = parseRolesDoc(text);
    return ROLE_DESC_CACHE;
  } catch (e) {
    ROLE_DESC_CACHE_ERR = e;
    return {};
  }
}

function getRoleDescription(roleId) {
  if (!roleId) return null;
  const map = getRoleDescriptions();
  return map?.[String(roleId)] ?? null;
}

module.exports = {
  getRoleDescriptions,
  getRoleDescription,
};
