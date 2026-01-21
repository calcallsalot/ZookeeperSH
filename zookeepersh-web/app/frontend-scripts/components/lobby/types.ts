export type OnlinePlayer = {
  id?: string;
  name: string;
  elo?: number | null;
};

export type Lobby = {
  id: string;
  name?: string | null;
  hostName?: string | null;
  players?: string[];
  seatOrder?: string[];
  status?: "open" | "in_game" | "closed";
  createdAt?: number;
  gameState?: any; // probably need to change from any later
};


