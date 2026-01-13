require("dotenv").config({ path: ".env.local" }); // for .env.local support hosted on 3001 rn

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

const { MongoClient, ObjectId } = require("mongodb");



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
const online = new Map(); // { id, name, elo }
const onlineList = () => Array.from(online.values());

// --- In-memory lobby store (lobbyId -> lobby object) ---
const lobbies = new Map();
// const lobbyList = () => Array.from(lobbies.values());
const playerLobby = new Map(); // socket.id -> lobbyId

const publicLobby = (l) => ({
  id: l.id,
  name: l.name ?? null,
  hostName: l.hostName ?? null,
  players: l.players ?? [],
  status: l.status ?? "open",
  createdAt: l.createdAt ?? Date.now(),
});

const lobbyListPublic = () => Array.from(lobbies.values()).map(publicLobby);



io.on("connection", (socket) => {
  console.log("[io] connected:", socket.id);

  // Log every event received (helps debug)
  socket.onAny((event, ...args) => {
    console.log("[io] recv:", event, args);
  });

  // default presence
  online.set(socket.id, { id: socket.id, name: "Guest", elo: null, authed: false });

  // Broadcast current online list to everyone 
  io.emit("onlinePlayers:update", onlineList());

  // Client tells server who they are
  socket.on("presence:set", ({ name, elo, authed } = {}) => {

    const prev = online.get(socket.id) || { id: socket.id };
    //const isGuest = name === "Guest";
    // not needed and before with !null || it was always true


    online.set(socket.id, {
      ...prev,
      name: name ?? prev.name ?? "Guest",
      elo: typeof elo === "number" ? elo : (prev.elo ?? null),
      authed: !!authed,
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
  socket.on("game_chat:send", async ({ lobbyId, text, seat, elo, userName }) => {
    if (!lobbyId || typeof lobbyId !== "string") return;
    if (typeof text !== "string") return;

    const trimmed = text.trim();
    if (!trimmed) return;

    // Prefer server-known identity if known, otherwise accept payload (simple for now) need to change later so add to TODO list
    /*const finalName =
      socket.data?.userName ||
      userName ||
      socket.handshake?.auth?.userName ||
      "anon";*/
    const player = online.get(socket.id);
    const finalName = player?.name ?? "Unkown";
    const finalElo = player?.elo ?? null; // not really used need to change prob

    const msg = {
      lobbyId,
      kind: "user",
      text: trimmed,
      userName: finalName,
      seat: Number.isInteger(seat) ? seat : (socket.data?.seat ?? null),
      elo: Number.isFinite(elo) ? elo : (socket.data?.elo ?? null),
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

    socket.emit("me:lobby", { lobbyId: playerLobby.get(socket.id) ?? null }); // identify playerLobby

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
    if (playerLobby.has(socket.id)) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    } 
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to create or join games." });
      return; // exists lobby:create handler
    }
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);

    // host name

    const host = online.get(socket.id);
    const hostName = host?.name ?? "Guest";

    const lobby = {
      id: lobbyId,
      name: null,
      hostName,
      players: [hostName],   // client treats this as string[]
      status: "open",
      createdAt: Date.now(),
    };

    lobbies.set(lobbyId, lobby);

    playerLobby.set(socket.id, lobbyId); // obv set lobby for player

    io.emit("lobbies:update", lobbyListPublic()); // dk if this is needed it's public latest list

    console.log("[io] created lobby:", lobby);

    socket.emit("me:lobby", { lobbyId });
    socket.emit("lobby:created", { lobbyId });

    

    // (Optional) if later store lobbies, you'd io.emit("lobbies:update", ...)
    // will be needed to add replays like the main site does but for rn who gaf abt replays
  });


  // joining lobbies
  socket.on("lobby:join", ({ lobbyId } = {}) => {
    if (playerLobby.has(socket.id)) {
      socket.emit("error:lobby", { message: "You’re already in a lobby." });
      return;
    }
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
    const existingPlayers = lobby.players ?? [];
    const players = existingPlayers.includes(playerName)
      ? existingPlayers
      : [...existingPlayers, playerName];

    lobbies.set(targetLobbyId, { ...lobby, players });
    playerLobby.set(socket.id, targetLobbyId);

    io.emit("lobbies:update", lobbyListPublic());
    socket.emit("me:lobby", { lobbyId: targetLobbyId });
  });






  socket.on("disconnect", (reason) => {
    console.log("[io] disconnected:", socket.id, reason);

    // Remove from presence and broadcast update
    online.delete(socket.id);
    io.emit("onlinePlayers:update", onlineList());
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
