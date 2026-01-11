export const POWERS_BY_PLAYER_COUNT: Record<number, string[]> = {
  7: [],
};

export const getPowersForPlayerCount = (playerCount: number) => {
  return POWERS_BY_PLAYER_COUNT[playerCount] ?? [];
};
