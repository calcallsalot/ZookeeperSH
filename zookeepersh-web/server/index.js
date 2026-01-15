require("dotenv").config({ path: ".env.local" }); // for .env.local support hosted on 3001 rn

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

const { MongoClient, ObjectId } = require("mongodb");

const { startGameIfReady } = require("../app/gameLogic/startGameIfReady");


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



async function emitGameSystem(lobbyId, text) { // not used by useful for emitting system messages to game chat
  const msg = {
    lobbyId,
    kind: "system",
    text: String(text),
    ts: Date.now(),
    createdAt: new Date(),
  };
  const res = await gameChatCol.insertOne(msg);
  io.to(gameRoom(lobbyId)).emit("game_chat:new", {
    id: res.insertedId.toString(),
    ...msg,
  });
}

function canPlayOrChat(socket) {
  const p = online.get(socket.id);
  return !!p && p.authed;
}

// --- In-memory presence store (socket.id -> player) ---
const online = new Map(); // { id, name, elo, authed, presenceKey, updatedAt}
// const onlineList = () => Array.from(online.values());
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

  // Client tells servger who they are
  socket.on("presence:set", ({ name, elo, authed, guestId } = {}) => {

    const prev = online.get(socket.id) || { id: socket.id };
    //const isGuest = name === "Guest";
    // not needed and before with !null || it was always true
    const displayName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : prev.name ?? "Guest";
    const isAuthed = !!authed;
    let nextElo = typeof elo === "number" ? elo : prev.elo;

    if (isAuthed && typeof nextElo !== "number") {
      nextElo = 1600;
    }
    const guestKey =
      typeof guestId === "string" && guestId.trim().length > 0
        ? guestId.trim()
        : socket.id;
    const presenceKey = (isAuthed ? `user:${displayName}` : `guest:${guestKey}`).toLowerCase();
    if (prev.presenceKey && prev.presenceKey !== presenceKey) {
      removePresenceSocket(prev.presenceKey, socket.id);
    }
    addPresenceSocket(presenceKey, socket.id);

    online.set(socket.id, {
      ...prev,
      id: socket.id,
      name: displayName,
      elo: typeof nextElo === "number" ? nextElo : null,
      authed: isAuthed,
      presenceKey,
      updatedAt: Date.now(),
    });

    io.emit("onlinePlayers:update", onlineList());
  });

  // lobby chat by {lobbyId}
  socket.on("game_chat:join", async ({ lobbyId }) => {
    if (!lobbyId || typeof lobbyId !== "string") return;

    socket.join(gameRoom(lobbyId));

    const history = await gameChatCol
      .find({ lobbyId })
      .sort({ ts: 1 })
      .limit(250)
      .toArray();

    socket.emit("game_chat:history", {
      lobbyId,
      messages: history.map((m) => ({
        id: m._id?.toString?.() ?? undefined,
        lobbyId: m.lobbyId,
        kind: m.kind,
        text: m.text,
        userName: m.userName ?? null,
        seat: m.seat ?? null,
        elo: m.elo ?? null,
        ts: m.ts,
      })),
    });
  });
  // Send user message
  socket.on("game_chat:send", async ({ lobbyId, text }) => {
    if (!lobbyId || typeof lobbyId !== "string") return;
    if (typeof text !== "string") return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const player = online.get(socket.id);
    const finalName = player?.name ?? "Unknown";
    const finalElo = player?.elo ?? null;

    const lobby = lobbies.get(lobbyId);
    const started = lobby?.status === "in_game";
    const lobbyInfo = playerLobby.get(socket.id);
    const observer = lobbyInfo?.lobbyId === lobbyId && lobbyInfo.role === "observer";
    const seat = started && !observer ? (lobby?.seatByName?.[finalName] ?? null) : null;

    const msg = {
      lobbyId,
      kind: "user",
      text: trimmed,
      userName: finalName,
      elo: finalElo,
      seat, // becomes a number only after startGameIfReady sets seatByName and also !observer
      observer,
      ts: Date.now(),
      createdAt: new Date(),
    };

    const res = await gameChatCol.insertOne(msg);

    io.to(gameRoom(lobbyId)).emit("game_chat:new", {
      id: res.insertedId.toString(),
      ...msg,
    });
  });




  // lobby chat not game for each lobby chat 
  socket.on("init:get", async () => {
    socket.emit("init", {
      lobbies: lobbyListPublic(),
      onlinePlayers: onlineList(),
    });

    socket.emit("me:lobby", { lobbyId: playerLobby.get(socket.id)?.lobbyId ?? null }); // identify playerLobby

    try {
      if (!chatCol) {
        socket.emit("chat:history", []);
        return;
      }
      const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // TTL is 24 hours so if you want 7 days change from 1 * to 7 * 
      const msgs = await chatCol
        .find({ createdAt: { $gte: since } })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();

      
      socket.emit(
        "chat:history",
        msgs.map((m) => ({
          id: String(m._id),
          name: m.name,
          text: m.text,
          ts: m.ts ?? m.createdAt.getTime(),
        }))
      );
    } catch (e) {
      console.error("[chat] history error:", e);
      socket.emit("chat:history", []);
    }
  });

  // chat sending 
  socket.on("chat:send", async ({ text } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to chat." });
      return;
    }

    const msg = String(text ?? "").trim();
    if (!msg) return;
    if (msg.length > 300) {
      socket.emit("error:chat", { message: "Message too long (max 300 chars)." });
      return;
    }

    const player = online.get(socket.id);
    const doc = {
      name: player?.name ?? "Unknown",
      text: msg,
      ts: Date.now(),
      createdAt: new Date(), // TTL uses this
    };

    try {
      if (!chatCol) {
        socket.emit("error:chat", { message: "Chat DB not ready." });
        return;
      }

      const r = await chatCol.insertOne(doc);

      const payload = {
        id: String(r.insertedId),
        name: doc.name,
        text: doc.text,
        ts: doc.ts,
      };

      io.emit("chat:message", payload);
    } catch (e) {
      console.error("[chat] insert error:", e);
      socket.emit("error:chat", { message: "Failed to send message." });
    }
  });
  // Example createLobby handler (kept)
  socket.on("lobby:create", () => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to create or join games." });
      return;
    }
    const host = online.get(socket.id);
    const presenceKey = host?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);

    const hostName = host?.name ?? "Guest";

    const lobby = {
      id: lobbyId,
      name: null,
      hostName,
      players: [hostName],
      status: "open",
      createdAt: Date.now(),
    };

    lobbies.set(lobbyId, lobby);
    startGameIfReady({
      io,
      lobbies,
      lobbyId: lobbyId,
      gameRoom,
      lobbyListPublic,
      emitGameSystem,
    });

    playerLobby.set(socket.id, { lobbyId, role: "player" });

    io.emit("lobbies:update", lobbyListPublic());

    console.log("[io] created lobby:", lobby);

    socket.emit("me:lobby", { lobbyId });
    socket.emit("lobby:created", { lobbyId });
  });



  // joining lobbies
  socket.on("lobby:join", ({ lobbyId } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to create or join games." });
      return;
    }

    const targetLobbyId = typeof lobbyId === "string" ? lobbyId : null;
    const lobby = targetLobbyId ? lobbies.get(targetLobbyId) : null;
    if (!lobby) {
      socket.emit("error:lobby", { message: "Lobby not found." });
      return;
    }

    const player = online.get(socket.id);
    const playerName = player?.name ?? "Guest";
    const presenceKey = player?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence && existingPresence.lobbyId !== targetLobbyId) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }

    const existingPlayers = lobby.players ?? [];
    const isAlreadyPlayer = existingPlayers.includes(playerName);
    const nextRole = isAlreadyPlayer ? "player" : existingPresence?.role ?? "observer";
    playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: nextRole });

    if (isAlreadyPlayer && presenceKey) {
      setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
    }

    socket.emit("me:lobby", { lobbyId: targetLobbyId });
  });

  socket.on("lobby:sit", ({ lobbyId } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to create or join games." });
      return;
    }

    const targetLobbyId = typeof lobbyId === "string" ? lobbyId : null;
    const lobby = targetLobbyId ? lobbies.get(targetLobbyId) : null;
    if (!lobby) {
      socket.emit("error:lobby", { message: "Lobby not found." });
      return;
    }

    const player = online.get(socket.id);
    const playerName = player?.name ?? "Guest";
    const presenceKey = player?.presenceKey ?? null;
    const existingPresence = getPresenceLobbyInfo(presenceKey);
    if (existingPresence && existingPresence.lobbyId !== targetLobbyId) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }

    const existingPlayers = lobby.players ?? [];
    if (existingPlayers.includes(playerName)) {
      playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: "player" });
      if (presenceKey) {
        setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
      }
      socket.emit("me:lobby", { lobbyId: targetLobbyId });
      return;
    }

    if (lobby.status === "in_game" || existingPlayers.length >= 7) {
      socket.emit("error:lobby", { message: "Lobby is full." });
      return;
    }

    const nextPlayers = [...existingPlayers, playerName];
    lobbies.set(targetLobbyId, { ...lobby, players: nextPlayers });

    playerLobby.set(socket.id, { lobbyId: targetLobbyId, role: "player" });
    if (presenceKey) {
      setPresenceRoleInLobby(presenceKey, targetLobbyId, "player");
    }

    startGameIfReady({
      io,
      lobbies,
      lobbyId: targetLobbyId,
      gameRoom,
      lobbyListPublic,
      emitGameSystem,
    });

    io.emit("lobbies:update", lobbyListPublic());
    socket.emit("me:lobby", { lobbyId: targetLobbyId });
  });







  socket.on("disconnect", (reason) => {
    console.log("[io] disconnected:", socket.id, reason);

    const player = online.get(socket.id);
    const presenceKey = player?.presenceKey;
    const playerName = player?.name;
    const lobbyInfo = playerLobby.get(socket.id);
    playerLobby.delete(socket.id);
    if (presenceKey) {
      removePresenceSocket(presenceKey, socket.id);
    }

    // Remove from presence and broadcast update
    online.delete(socket.id);
    io.emit("onlinePlayers:update", onlineList());
    // sloppiest fucking code ever we're gonna have to fix this
    if (lobbyInfo?.lobbyId && lobbyInfo.role === "player" && presenceKey) {
      const stillInLobby = hasPresenceInLobby(presenceKey, lobbyInfo.lobbyId, "player");
      if (!stillInLobby) {
        const lobby = lobbies.get(lobbyInfo.lobbyId);
        if (lobby) {
          const currentPlayers = lobby.players ?? [];
          const nextPlayers = playerName
            ? currentPlayers.filter((name) => name !== playerName)
            : currentPlayers;
          if (nextPlayers.length !== currentPlayers.length) {
            if (nextPlayers.length === 0) {
              closeLobby(lobbyInfo.lobbyId, "no-seated-players");
            } else {
              lobbies.set(lobbyInfo.lobbyId, { ...lobby, players: nextPlayers });
              io.emit("lobbies:update", lobbyListPublic());
            }
          }

        }
      }
    }
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
