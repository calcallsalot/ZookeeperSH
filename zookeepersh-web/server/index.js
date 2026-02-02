require("dotenv").config({ path: ".env.local" }); // for .env.local support hosted on 3001 rn

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

const { MongoClient, ObjectId } = require("mongodb");

const { startGameIfReady } = require("../app/gameLogic/startGameIfReady");

const { registerPresenceHandlers } = require("./handlers/presence");
const { registerGameChatHandlers } = require("./handlers/chat/gameChat");
const { registerElectionHandlers } = require("./handlers/game/election");
const { registerInitHandlers } = require("./handlers/init");
const { registerChatHandlers } = require("./handlers/chat");
const { registerLobbyHandlers } = require("./handlers/lobby");
const { registerDisconnectHandlers } = require("./handlers/disconnect");
const { makeEmitGameSystem } = require("./handlers/chat/emitGameSystem");

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Next dev server
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI env var");
}

const client = new MongoClient(MONGODB_URI);
let chatCol;
let gameChatCol;

async function initMongo() {
  await client.connect();
  const db = client.db(); // uses db name from URI; or client.db("zookeeper")
  gameChatCol = db.collection("game_chat_messages");
  chatCol = db.collection("chat_messages");

  const TTL_SECONDS = 60 * 60 * 24; // TTL is 24 hours just do * 7 for 7 days

  await chatCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

  //await chatCol.createIndex({ createdAt: 1 });

  console.log("[mongo] connected and indexes ensured");
}

/*
function shuffle(arr) { // just a random shuffle of an array
  array.sort(() => Math.random() -0.5);
}

// fisher yates method might need who knows
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}*/

function gameRoom(lobbyId) {
  return `game:${lobbyId}`; // can't be '' lol it has to be ``
}

function canPlayOrChat(socket) {
  const p = online.get(socket.id);
  return !!p && p.authed;
}

// --- In-memory presence store (socket.id -> player) ---
const online = new Map(); // { id, name, elo, authed, presenceKey, updatedAt}
// const onlineList = () => Array.from(online. values());
// changed from this to presence because of observers
const presenceSockets = new Map(); // presenceKey -> Set<socket.id>

// --- In-memory lobby store (lobbyId -> lobby object) ---
const lobbies = new Map();
// const lobbyList = () => Array.from(lobbies.values());
const playerLobby = new Map(); // socket.id -> { lobbyId, role }

function addPresenceSocket(presenceKey, socketId) {
  if (!presenceKey) return;
  const existing = presenceSockets.get(presenceKey);
  if (existing) {
    existing.add(socketId);
    return;
  }
  presenceSockets.set(presenceKey, new Set([socketId]));
}
function removePresenceSocket(presenceKey, socketId) {
  const existing = presenceSockets.get(presenceKey);
  if (!existing) return 0;
  existing.delete(socketId);
  if (existing.size === 0) {
    presenceSockets.delete(presenceKey);
    return 0;
  }
  return existing.size;
}
function hasPresenceInLobby(presenceKey, lobbyId, role) {
  if (!presenceKey || !lobbyId) return false;
  for (const [socketId, info] of playerLobby.entries()) {
    if (!info || info.lobbyId !== lobbyId) continue;
    if (role && info.role !== role) continue;
    const player = online.get(socketId);
    if (player?.presenceKey === presenceKey) return true;
  }
  return false;
}

function getPresenceLobbyInfo(presenceKey) {
  if (!presenceKey) return null;
  let lobbyId = null;
  let role = null;
  for (const [socketId, info] of playerLobby.entries()) {
    if (!info?.lobbyId) continue;
    const player = online.get(socketId);
    if (player?.presenceKey !== presenceKey) continue;
    if (!lobbyId) {
      lobbyId = info.lobbyId;
      role = info.role ?? "observer";
      continue;
    }
    if (info.lobbyId !== lobbyId) {
      return { lobbyId, role: role ?? "observer", conflict: true };
    }
    if (info.role === "player") {
      role = "player";
    }
  }
  return lobbyId ? { lobbyId, role: role ?? "observer" } : null;
}

function setPresenceRoleInLobby(presenceKey, lobbyId, role) {
  if (!presenceKey || !lobbyId) return;
  for (const [socketId, info] of playerLobby.entries()) {
    if (!info?.lobbyId || info.lobbyId !== lobbyId) continue;
    const player = online.get(socketId);
    if (player?.presenceKey !== presenceKey) continue;
    playerLobby.set(socketId, { ...info, lobbyId, role });
  }
}

const onlineList = () => {
  const unique = new Map();
  for (const player of online.values()) {
    const key = player?.presenceKey ?? player?.id ?? player?.name;
    if (!key) continue;
    const existing = unique.get(key);
    if (!existing || (player.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      unique.set(key, player);
    }
  }
  return Array.from(unique.entries()).map(([key, player]) => ({
    id: key,
    name: player?.name ?? "Guest",
    elo: player?.elo ?? null,
  }));
};

const publicLobby = (l) => ({
  id: l.id,
  name: l.name ?? null,
  hostName: l.hostName ?? null,
  players: l.players ?? [],
  status: l.status ?? "open",
  createdAt: l.createdAt ?? Date.now(),
});

const lobbyListPublic = () => Array.from(lobbies.values()).map(publicLobby);

function getLobbySocketIds(lobbyId) {
  const socketIds = [];
  for (const [socketId, info] of playerLobby.entries()) {
    if (info?.lobbyId === lobbyId) {
      socketIds.push(socketId);
    }
  }
  return socketIds;
}

function closeLobby(lobbyId, reason) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  lobbies.delete(lobbyId);
  const lobbySocketIds = getLobbySocketIds(lobbyId);
  lobbySocketIds.forEach((socketId) => {
    playerLobby.delete(socketId);
    io.to(socketId).emit("me:lobby", { lobbyId: null });
    io.to(socketId).emit("lobby:closed", { lobbyId });
  });
  console.log("[io] lobby:closed", { lobbyId, reason });
  io.emit("lobbies:update", lobbyListPublic());
}

io.on("connection", (socket) => {
  console.log("[io] connected:", socket.id);

  // Log every event received (helps debug)
  socket.onAny((event, ...args) => {
    console.log("[io] recv:", event, args);
  });

  
  // default presence
  const defaultPresenceKey = `guest:${socket.id}`;
  //online.set(socket.id, { id: socket.id, name: "Guest", elo: null, authed: false });
  online.set(socket.id, {
    id: socket.id,
    name: "Guest",
    elo: null,
    authed: false,
    presenceKey: defaultPresenceKey,
    updatedAt: Date.now(),
  });
  addPresenceSocket(defaultPresenceKey, socket.id);

  // Broadcast current online list to everyone
  io.emit("onlinePlayers:update", onlineList());

  registerPresenceHandlers({
    io,
    socket,
    online,
    addPresenceSocket,
    removePresenceSocket,
    onlineList,
  });
  const emitGameSystem = makeEmitGameSystem({
    io,
    gameChatCol,
    gameRoom,
  });

  registerElectionHandlers({
    io,
    socket,
    lobbies,
    online,
    playerLobby,
    gameRoom,
    emitGameSystem,
    closeLobby,
  });

  registerGameChatHandlers({
    io,
    socket,
    lobbies,
    playerLobby,
    online,
    gameChatCol,
    gameRoom,
    emitGameSystem,
  });

  registerInitHandlers({
    socket,
    lobbyListPublic,
    onlineList,
    playerLobby,
    chatCol,
  });

  registerChatHandlers({
    io,
    socket,
    online,
    chatCol,
    canPlayOrChat,
  });

  registerLobbyHandlers({
    io,
    socket,
    online,
    lobbies,
    playerLobby,
    hasPresenceInLobby,
    closeLobby,
    canPlayOrChat,
    getPresenceLobbyInfo,
    setPresenceRoleInLobby,
    startGameIfReady,
    gameRoom,
    lobbyListPublic,
    emitGameSystem,
  });

  registerDisconnectHandlers({
    io,
    socket,
    online,
    playerLobby,
    removePresenceSocket,
    onlineList,
    hasPresenceInLobby,
    lobbies,
    closeLobby,
    lobbyListPublic,
  });
});

app.get("/", (req, res) => res.send("socket server ok"));

initMongo()
  .then(() => {
    httpServer.listen(3001, "127.0.0.1", () => {
      console.log("Socket.IO server listening on http://127.0.0.1:3001");
    });
  })
  .catch((err) => {
    console.error("[mongo] init failed:", err);
    process.exit(1);
  });

/*httpServer.listen(3001, "127.0.0.1", () => {
  console.log("Socket.IO server listening on http://127.0.0.1:3001");
});*/
