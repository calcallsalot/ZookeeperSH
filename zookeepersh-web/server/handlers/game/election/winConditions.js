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
  const delayMs = 60 * 1000;
  gameState.gameOver.closeLobbyScheduled = true;
  gameState.gameOver.closeLobbyAt = Date.now() + delayMs;
  setTimeout(() => closeLobby(lobbyId, "game-over"), delayMs);
}

module.exports = {
  checkPolicyWin,
  endGame,
  scheduleCloseLobby,
};
