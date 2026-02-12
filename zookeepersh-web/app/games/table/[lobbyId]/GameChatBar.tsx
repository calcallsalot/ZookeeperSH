"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLobby } from "../../../frontend-scripts/components/lobby/LobbySocketContext";
import ClaimCardsModal, { type ClaimCardsModalMode } from "../../../frontend-scripts/game/ClaimCardsModal";
import ClaimInvestigationResultModal, {
  type InvestigationResultClaim,
} from "../../../frontend-scripts/game/ClaimInvestigationResultModal";

function nameColorFromElo(elo?: number | null) {
  if (elo == null) return "rgba(255,255,255,0.9)";
  if (elo >= 1500 && elo <= 1600) return "#2ecc71";
  if (elo >= 1601 && elo <= 1700) return "#f1c40f";
  return "rgba(255,255,255,0.9)";
}

const CLAIM_GOLD = "rgb(251, 189, 8)";
const CLAIM_WHITE = "rgb(255,255,255)";
const CLAIM_FASCIST_RED = "#f2654c";
const CLAIM_LIBERAL_BLUE = "#4da3ff";

function formatClaimCardsSystemText(text: string): ReactNode | null {
  const t = String(text ?? "").trim();
  if (!t) return null;

  // Supports legacy server text that included "to have seen".
  const m = t.match(
    /^(President|Chancellor)\s+(.+?)\s+\{(\d+)\}\s+claims(?:\s+to have seen)?\s+([RB]{2,3})\.?\s*$/i
  );
  if (!m) return null;

  const roleRaw = String(m[1] ?? "");
  const role = roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase() : "";
  const name = String(m[2] ?? "").trim();
  const seat = String(m[3] ?? "").trim();
  const cards = String(m[4] ?? "").trim().toUpperCase();
  if (!role || !name || !seat || !cards) return null;

  return (
    <span>
      <span style={{ color: CLAIM_GOLD, fontWeight: 900 }}>{role}</span>{" "}
      <span style={{ color: CLAIM_WHITE, fontWeight: 900 }}>{name}</span>{" "}
      <span style={{ color: CLAIM_WHITE, fontWeight: 900 }}>{`{${seat}}`}</span>{" "}
      <span style={{ color: CLAIM_GOLD, fontWeight: 900 }}>claims</span>{" "}
      {cards.split("").map((ch, idx) => (
        <span
          key={`claim-card-${idx}`}
          style={{
            color: ch === "R" ? CLAIM_FASCIST_RED : CLAIM_LIBERAL_BLUE,
            fontWeight: 900,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function formatSystemText(text: string): ReactNode {
  const claimCards = formatClaimCardsSystemText(text);
  if (claimCards) return claimCards;

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
  claimCards,
  claimInv,
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
  claimCards?:
    | {
        presidentSeat?: number | null;
        chancellorSeat?: number | null;
        usedBySeat?: Record<number, boolean> | Record<string, boolean>;
      }
    | null;
  claimInv?:
    | {
        presidentSeat?: number | null;
        ready?: boolean;
        used?: boolean;
      }
    | null;
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

  const [claimCardsOpen, setClaimCardsOpen] = useState(false);
  const [claimCardsMode, setClaimCardsMode] = useState<ClaimCardsModalMode>("president");
  const [claimedCardsGovKey, setClaimedCardsGovKey] = useState<string | null>(null);

  const [claimInvOpen, setClaimInvOpen] = useState(false);
  const [claimedInvKey, setClaimedInvKey] = useState<string | null>(null);
  const [localNotices, setLocalNotices] = useState<any[]>([]);

  const claimGovKey = useMemo(() => {
    const pres = claimCards?.presidentSeat;
    const chan = claimCards?.chancellorSeat;
    if (typeof pres !== "number" || typeof chan !== "number") return null;
    return `${pres}:${chan}`;
  }, [claimCards?.chancellorSeat, claimCards?.presidentSeat]);

  const invKey = useMemo(() => {
    const pres = claimInv?.presidentSeat;
    if (typeof pres !== "number") return null;
    const ready = claimInv?.ready === true ? "1" : "0";
    return `${pres}:${ready}`;
  }, [claimInv?.presidentSeat, claimInv?.ready]);

  useEffect(() => {
    setClaimedCardsGovKey(null);
  }, [claimGovKey]);

  useEffect(() => {
    setClaimedInvKey(null);
  }, [invKey]);

  useEffect(() => {
    setLocalNotices([]);
  }, [lobbyId]);

  const pushNotice = (noticeText: string) => {
    const ts = Date.now();
    setLocalNotices((prev) => {
      const next = [
        ...prev,
        {
          id: `local:notice:${lobbyId}:${ts}:${Math.random().toString(36).slice(2)}`,
          lobbyId,
          kind: "system",
          text: String(noticeText ?? ""),
          ts,
        },
      ];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };

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
    const combined = [...localSystem, ...localNotices, ...sorted];
    combined.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    return combined;
  }, [localNotices, localSystem, sorted]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [viewMessages.length]);

  const disabled = !connected || !canChat || myAlive === false || claimCardsOpen || claimInvOpen;

  const onSend = () => {
    const msg = text.trim();
    if (!msg) return;

    const parts = msg.split(/\s+/);
    const cmd = String(parts[0] ?? "").toLowerCase();
    const type = String(parts[1] ?? "").toLowerCase();
    const rest = parts.slice(2).join(" ").trim();

    // UI helper: typing `/claim cards` opens a picker for the last government.
    if (cmd === "/claim" && type === "cards" && rest.length === 0) {
      const presSeat = claimCards?.presidentSeat ?? null;
      const chanSeat = claimCards?.chancellorSeat ?? null;
      const isPres = mySeat != null && presSeat != null && mySeat === presSeat;
      const isChan = mySeat != null && chanSeat != null && mySeat === chanSeat;

      if (isPres || isChan) {
        const usedBySeat = (claimCards as any)?.usedBySeat ?? null;
        const alreadyClaimedServer = mySeat != null && usedBySeat?.[mySeat] === true;
        const alreadyClaimedLocal = claimGovKey != null && claimedCardsGovKey === claimGovKey;
        if (alreadyClaimedServer || alreadyClaimedLocal) {
          pushNotice("You already claimed cards for this government.");
          setText("");
          return;
        }

        setClaimCardsMode(isPres ? "president" : "chancellor");
        setClaimCardsOpen(true);
        setText("");
        return;
      }
    }

    // UI helper: typing `/claim inv` opens a picker for fascist/liberal.
    if (
      cmd === "/claim" &&
      (type === "inv" || type === "investigation" || type === "investigation_result") &&
      rest.length === 0
    ) {
      const presSeat = claimInv?.presidentSeat ?? null;
      const isPres = mySeat != null && presSeat != null && mySeat === presSeat;
      const isReady = claimInv?.ready === true;

      if (isPres && isReady) {
        const alreadyUsedServer = claimInv?.used === true;
        const alreadyUsedLocal = invKey != null && claimedInvKey === invKey;
        if (alreadyUsedServer || alreadyUsedLocal) {
          pushNotice("You already claimed investigation for this window.");
          setText("");
          return;
        }

        setClaimInvOpen(true);
        setText("");
        return;
      }
    }

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

      <ClaimCardsModal
        open={claimCardsOpen}
        mode={claimCardsMode}
        onClose={() => setClaimCardsOpen(false)}
        onSubmit={(cards) => {
          if (claimGovKey) setClaimedCardsGovKey(claimGovKey);
          sendGameChat?.(lobbyId, `/claim cards ${cards}`);
          setClaimCardsOpen(false);
          setText("");
        }}
      />

      <ClaimInvestigationResultModal
        open={claimInvOpen}
        onClose={() => setClaimInvOpen(false)}
        onSubmit={(result: InvestigationResultClaim) => {
          if (invKey) setClaimedInvKey(invKey);
          sendGameChat?.(lobbyId, `/claim inv ${result}`);
          setClaimInvOpen(false);
          setText("");
        }}
      />
    </section>
  );
}
