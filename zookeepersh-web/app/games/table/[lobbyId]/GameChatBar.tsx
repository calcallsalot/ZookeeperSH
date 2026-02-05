"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLobby } from "../../../frontend-scripts/components/lobby/LobbySocketContext";

function nameColorFromElo(elo?: number | null) {
  if (elo == null) return "rgba(255,255,255,0.9)";
  if (elo >= 1500 && elo <= 1600) return "#2ecc71";
  if (elo >= 1601 && elo <= 1700) return "#f1c40f";
  return "rgba(255,255,255,0.9)";
}

function formatSystemText(text: string): ReactNode {
  const parts = text.split(/(fascist policy|liberal policy|\d+\s+liberal|\d+\s+fascist|fascist|liberal)/gi);
  return parts.map((part, idx) => {
    const p = part.toLowerCase();
    if (p === "fascist policy") {
      return (
        <span key={idx} style={{ color: "#ff4d4d", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    if (p === "liberal policy") {
      return (
        <span key={idx} style={{ color: "#4da3ff", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    if (/^\d+\s+liberal$/i.test(part)) {
      return (
        <span key={idx} style={{ color: "#4da3ff", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    if (/^\d+\s+fascist$/i.test(part)) {
      return (
        <span key={idx} style={{ color: "#ff4d4d", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    if (p === "fascist") {
      return (
        <span key={idx} style={{ color: "#ff4d4d", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    if (p === "liberal") {
      return (
        <span key={idx} style={{ color: "#4da3ff", fontWeight: 900 }}>
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function GameChatBar({
  lobbyId,
  gameStarted,
  mySeat,
  myElo,
  myAlive,
  myRole,
  myCoverRole,
  myClues,
  myLastInvestigation,
}: {
  lobbyId: string;
  gameStarted: boolean;
  mySeat?: number | null;
  myElo?: number | null;
  myAlive?: boolean;
  myRole?: { id: string; color?: string; description?: string | null } | null;
  myCoverRole?: { id: string; color?: string; description?: string | null } | null;
  myClues?: { bureaucratFascistPairs?: number | null } | null;
  myLastInvestigation?:
    | {
        ts?: number;
        targetSeat?: number;
        result?: { kind?: string; team?: "liberal" | "fascist" } | null;

        // Legacy format (older servers stored the full investigated role)
        role?: {
          id: string;
          group?: string;
          alignment?: string;
          color?: string;
          description?: string | null;
        } | null;
      }
    | null;
}) {
  const { connected, canChat, gameChatMessages, joinGameChat, sendGameChat } =
    useLobby() as any;

  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if(!connected) return;
    joinGameChat?.(lobbyId);
  }, [connected, joinGameChat, lobbyId]);

  const sorted = useMemo(() => {
    return [...(gameChatMessages ?? [])]
      .filter((m) => m?.lobbyId === lobbyId) // safety
      .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  }, [gameChatMessages, lobbyId]);

  const localSystem = useMemo(() => {
    /** @type {any[]} */
    const out = [];

     const getTeamFromInvestigation = (inv: any): "liberal" | "fascist" | null => {
       const kind = inv?.result?.kind;
       if (kind === "team" && (inv?.result?.team === "liberal" || inv?.result?.team === "fascist")) {
         return inv.result.team;
       }

       const r = inv?.role;
       if (r?.id === "Grandma") return "liberal";
       if (r?.group === "loyalist" || r?.group === "dissident") return "liberal";
       if (r?.group === "agent" || r?.group === "dictator") return "fascist";
       if (r?.alignment === "liberal" || r?.alignment === "fascist") return r.alignment;

       return null;
     };

    if (gameStarted && mySeat != null && myRole?.id) {
      out.push({
        id: `local:role:${lobbyId}`,
        lobbyId,
        kind: "system",
        ts: 0,
        content: (
          <span>
            The game begins and you receive the role{" "}
            <span style={{ color: myRole.color ?? "white", fontWeight: 900 }}>{myRole.id}</span> and take seat{" "}
            <span style={{ fontWeight: 900 }}>{mySeat}</span>
            {myRole.description ? `\n${myRole.description}` : ""}
            {myCoverRole?.id ? (
              <>
                {"\n"}Your fake liberal role is{" "}
                <span style={{ color: myCoverRole.color ?? "white", fontWeight: 900 }}>{myCoverRole.id}</span>
                {myCoverRole.description ? `\n${myCoverRole.description}` : ""}
              </>
            ) : null}
          </span>
        ),
      });
    }

    // Bureaucrat starting info (private)
    const pairsRaw = myClues?.bureaucratFascistPairs;
    const pairs = typeof pairsRaw === "number" && Number.isFinite(pairsRaw) ? pairsRaw : null;
    if (gameStarted && myRole?.id === "Bureaucrat" && pairs != null) {
      out.push({
        id: `local:clue:bureaucrat:${lobbyId}`,
        lobbyId,
        kind: "system",
        ts: 0,
        content: (
          <span>
            There {pairs === 1 ? "is" : "are"}{" "}
            <span style={{ fontWeight: 900 }}>{pairs}</span> fascist {pairs === 1 ? "pair" : "pairs"}.
          </span>
        ),
      });
    }

    const invResult = myLastInvestigation?.result as any;
    if (gameStarted && invResult?.kind === "text" && typeof invResult?.text === "string" && invResult.text.trim()) {
      const ts = typeof myLastInvestigation?.ts === "number" ? myLastInvestigation.ts : Date.now();
      out.push({
        id: `local:private:${lobbyId}:${ts}`,
        lobbyId,
        kind: "system",
        ts,
        content: <span>{invResult.text}</span>,
      });
    } else {
      const invTeam = getTeamFromInvestigation(myLastInvestigation);
      if (gameStarted && myLastInvestigation?.targetSeat != null && invTeam) {
        const ts = typeof myLastInvestigation.ts === "number" ? myLastInvestigation.ts : Date.now();
        const teamColor = invTeam === "liberal" ? "#4da3ff" : "#ff4d4d";
        out.push({
          id: `local:investigate:${lobbyId}:${ts}`,
          lobbyId,
          kind: "system",
          ts,
          content: (
            <span>
              Investigation result: Seat{" "}
              <span style={{ fontWeight: 900 }}>{myLastInvestigation.targetSeat}</span> is{" "}
              <span style={{ color: teamColor, fontWeight: 900 }}>{invTeam}</span>
            </span>
          ),
        });
      }
    }

    return out;
  }, [gameStarted, lobbyId, myClues, myCoverRole, myLastInvestigation, myRole, mySeat]);

  const viewMessages = useMemo(() => {
    const combined = [...localSystem, ...sorted];
    combined.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    return combined;
  }, [localSystem, sorted]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [viewMessages.length]);

  const disabled = !connected || !canChat || myAlive === false;

  const onSend = () => {
    const msg = text.trim();
    if (!msg) return;
    sendGameChat?.(lobbyId, msg); // mySeat ?? null, myElo ?? null);
    setText("");
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <section
      style={{
        height: "100%",
        minHeight: 0,            
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "8px 10px",
          fontSize: 14,
          lineHeight: 1.25,
        }}
      >
        {viewMessages.map((m, idx) => {
          const key = m.id ?? `${m.ts}-${idx}`;

          if (m.kind === "system") {
            return (
              <div
                key={key}
                style={{
                  color: "rgba(255,255,255,0.55)",
                  padding: "2px 0",
                  whiteSpace: "pre-line",
                }}
              >
                {m.content ?? formatSystemText(String(m.text ?? ""))}
              </div>
            );
          }
          const isObserver = Boolean(m.observer);
          const observerLabel = isObserver ? " (observer)" : "";
          const seatStr = !isObserver && gameStarted && m.seat != null ? ` {${m.seat}}` : "";

          return (
            <div key={key} style={{ padding: "2px 0" }}>
              <span style={{ color: nameColorFromElo(m.elo), fontWeight: 800 }}>
                {m.userName ?? "anon"}
                {observerLabel}
                {seatStr}
              </span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>:</span>
              <span style={{ color: "white" }}> {m.text}</span> 
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Bottom input bar (thin, like screenshot) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={
            !connected || !canChat
              ? "Chat disabled"
              : myAlive === false
                ? "You are dead"
                : "Type a message…"
          }
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.15)",
            color: "white",
            padding: "0 10px",
            outline: "none",
          }}
        />

        <button
          onClick={onSend}
          disabled={disabled}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: disabled ? "rgba(255,255,255,0.10)" : "#2d5bff",
            color: "white",
            fontWeight: 800,
            cursor: disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Chat
        </button>
      </div>
    </section>
  );
}
