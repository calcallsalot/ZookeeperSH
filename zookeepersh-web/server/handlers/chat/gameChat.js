const { ensureClaimsState } = require("../../game/claims");

function emitPrivateGameSystem(socket, lobbyId, text) {
  const ts = Date.now();
  socket.emit("game_chat:new", {
    id: `local:system:${lobbyId}:${ts}:${Math.random().toString(36).slice(2)}`,
    lobbyId,
    kind: "system",
    text: String(text ?? ""),
    ts,
  });
}

function titleCaseWords(s) {
  const parts = String(s ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function playerNameBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const p = (gs?.players ?? []).find((x) => x?.seat === s) ?? null;
  return p?.name ?? null;
}

function canonicalizeCards(compactUpper) {
  const str = String(compactUpper ?? "").replace(/\s+/g, "").toUpperCase();
  if (!str) return null;
  if (!/^[RB]+$/.test(str)) return null;

  const len = str.length;
  if (len !== 2 && len !== 3) return null;

  let red = 0;
  for (const ch of str) if (ch === "R") red += 1;

  if (len === 3) return red === 3 ? "RRR" : red === 2 ? "RRB" : red === 1 ? "RBB" : "BBB";
  return red === 2 ? "RR" : red === 1 ? "RB" : "BB";
}

function registerGameChatHandlers({
  io,
  socket,
  lobbies,
  playerLobby,
  online,
  gameChatCol,
  gameRoom,
  emitGameSystem,
}) {
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
    const observer =
      lobbyInfo?.lobbyId === lobbyId && lobbyInfo.role === "observer";
    const seat =
      started && !observer ? lobby?.seatByName?.[finalName] ?? null : null;

    if (started && seat != null) {
      const alive = lobby?.gameState?.players?.find?.((p) => p.seat === seat)?.alive;
      if (alive === false) {
        socket.emit("error:chat", { message: "You are dead." });
        return;
      }
    }

    // /claim commands are server-authoritative and are emitted as global system messages.
    // They do not appear as a normal user chat message.
    if (trimmed.split(/\s+/)[0]?.toLowerCase() === "/claim") {
      if (!emitGameSystem) {
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {claims unavailable}");
        return;
      }

      if (!started || observer || seat == null) {
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {must be a seated player}");
        return;
      }

      const gs = lobby?.gameState ?? null;
      if (!gs) {
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {game state not ready}");
        return;
      }

      ensureClaimsState(gs);

      const parts = trimmed.split(/\s+/);
      const typeLower = String(parts[1] ?? "").toLowerCase();
      const argRaw = parts.slice(2).join(" ").trim();
      const argLower = argRaw.toLowerCase();

      if (!typeLower) {
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {missing type}");
        return;
      }
      if (!argRaw) {
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {missing argument}");
        return;
      }

      try {
        // /claim cards
        if (typeLower === "cards") {
          const presSeat = gs?.claims?.cards?.presidentSeat;
          const chanSeat = gs?.claims?.cards?.chancellorSeat;
          const isPres = typeof presSeat === "number" && seat === presSeat;
          const isChan = typeof chanSeat === "number" && seat === chanSeat;
          if (!isPres && !isChan) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {only the last government may claim cards}");
            return;
          }

          if (gs?.claims?.cards?.usedBySeat?.[seat] === true) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {you already claimed cards}");
            return;
          }

          const compact = argRaw.replace(/\s+/g, "").toUpperCase();
          if (!/^[RB]+$/.test(compact)) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {cards must only contain R and B}");
            return;
          }

          const requiredLen = isPres ? 3 : 2;
          if (compact.length !== requiredLen) {
            const who = isPres ? "president" : "chancellor";
            emitPrivateGameSystem(socket, lobbyId, `incorrect argument {${who} must claim ${requiredLen} cards}`);
            return;
          }

          const canonical = canonicalizeCards(compact);
          if (!canonical) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {invalid cards}");
            return;
          }

          const whoLabel = isPres ? "President" : "Chancellor";
          const name = playerNameBySeat(gs, seat) ?? finalName;
          await emitGameSystem(lobbyId, `${whoLabel} ${name} {${seat}} claims to have seen ${canonical}.`);

          gs.claims.cards.usedBySeat[seat] = true;
          return;
        }

        // /claim inv
        if (typeLower === "inv" || typeLower === "investigation" || typeLower === "investigation_result") {
          const inv = gs?.claims?.inv2 ?? null;
          if (!inv || inv.ready !== true) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {investigation claim not available}");
            return;
          }
          if (inv.used === true) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {investigation claim already used}");
            return;
          }
          if (inv.presidentSeat !== seat) {
            emitPrivateGameSystem(
              socket,
              lobbyId,
              "incorrect argument {only the president who enacted the 2nd fascist policy may claim inv}"
            );
            return;
          }

          const team = argLower === "fascist" ? "fascist" : argLower === "liberal" ? "liberal" : null;
          if (!team) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {inv must be fascist or liberal}");
            return;
          }

          const targetSeat = inv.targetSeat;
          if (typeof targetSeat !== "number") {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {investigation target missing}");
            return;
          }

          const presName = playerNameBySeat(gs, seat) ?? finalName;
          const targetName = playerNameBySeat(gs, targetSeat) ?? "Unknown";

          await emitGameSystem(
            lobbyId,
            `President ${presName} {${seat}} sees the party membership of ${targetName} ${targetSeat} and claims to see a member of the ${team} team.`
          );

          inv.used = true;
          return;
        }

        // /claim role
        if (typeLower === "role") {
          const role = titleCaseWords(argRaw);
          if (!role) {
            emitPrivateGameSystem(socket, lobbyId, "incorrect argument {missing role}");
            return;
          }
          const name = playerNameBySeat(gs, seat) ?? finalName;
          await emitGameSystem(lobbyId, `${name} {${seat}} claims role ${role}.`);
          return;
        }

        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {unknown type}");
        return;
      } catch (e) {
        console.error("[claim] error:", e);
        emitPrivateGameSystem(socket, lobbyId, "incorrect argument {failed to post claim}");
        return;
      }
    }

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
}

module.exports = { registerGameChatHandlers };
