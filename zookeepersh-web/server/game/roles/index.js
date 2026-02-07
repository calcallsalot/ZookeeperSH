function isExileRoleId(roleId) {
  const x = String(roleId ?? "");
  return x === "Nun" || x === "Deputy" || x === "Journalist" || x === "Monk";
}

module.exports = {
  isExileRoleId,
};
