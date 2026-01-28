"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const DEFAULT_CARDBACK_BG = "/images/card_backs/default_cardback.png";

const ELECTION_BALLOT = "/images/election_cards/ballot.png";
const ELECTION_JA = "/images/election_cards/ja.png";
const ELECTION_NEIN = "/images/election_cards/nein.png";

const PRESIDENT_ROLE = "/images/public_roles/president_role.png";
const CHANCELLOR_ROLE = "/images/public_roles/chancellor_role.png";

type Vote = "ja" | "nein";

type PlayerSlot = {
  name: string;
};

let SPIN_KEYFRAMES_READY = false;
function ensureSpinKeyframes() {
  if (SPIN_KEYFRAMES_READY) return;
  if (typeof document === "undefined") return;

  const id = "zk_spin_keyframes";
  if (document.getElementById(id)) {
    SPIN_KEYFRAMES_READY = true;
    return;
  }

  const style = document.createElement("style");
  style.id = id;
  style.textContent = "@keyframes zk_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
  SPIN_KEYFRAMES_READY = true;
}

function electionBackSrc(phase: string | undefined, vote: Vote | null | undefined) {
  if (phase === "election_voting") return ELECTION_BALLOT;
  if (phase === "election_reveal") {
    if (vote === "ja") return ELECTION_JA;
    if (vote === "nein") return ELECTION_NEIN;
    return ELECTION_BALLOT;
  }
  return null;
}

function CardBackRect({
  w,
  h,
  src,
  flipToSrc,
  flip,
  pending,
}: {
  w: number;
  h: number;
  src?: string;
  flipToSrc?: string;
  flip?: boolean;
  pending?: boolean;
}) {
  const front = src ?? DEFAULT_CARDBACK_BG;
  const back = flipToSrc ?? front;
  const hasBack = Boolean(flipToSrc);

  useEffect(() => {
    ensureSpinKeyframes();
  }, []);

  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!hasBack) {
      setFlipped(false);
      return;
    }

    if (!flip) {
      setFlipped(false);
      return;
    }

    setFlipped(false);
    const t = setTimeout(() => setFlipped(true), 60);
    return () => clearTimeout(t);
  }, [flip, hasBack, flipToSrc]);

  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(0,0,0,0.35)",
        perspective: 800,
      }}
    >
      {!hasBack ? (
        <img
          src={front}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 520ms ease",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <img
            src={front}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              backfaceVisibility: "hidden",
            }}
          />
          <img
            src={back}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          />
        </div>
      )}

      {pending ? (
        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            right: 6,
            top: 6,
            width: 16,
            height: 16,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.22)",
            borderTopColor: "rgba(255,255,255,0.9)",
            animation: "zk_spin 850ms linear infinite",
            boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
            background: "rgba(0,0,0,0.25)",
          }}
        />
      ) : null}
    </div>
  );
}

function RoleBadges({
  isPresident,
  isChancellor,
}: {
  isPresident?: boolean;
  isChancellor?: boolean;
}) {
  if (!isPresident && !isChancellor) return null;

  // Bottom-center overlay (no pill background; preserve icon aspect ratio)
  return (
    <div
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: "50%",
        bottom: 0,
        transform: "translateX(-49%)",
        display: "flex",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.75))",
      }}
    >
      {isPresident ? (
        <img
          src={PRESIDENT_ROLE}
          alt="President"
          draggable={false}
          style={{ height: 25, width: "auto", maxWidth: 100, objectFit: "contain", display: "block" }}
        />
      ) : null}
      {isChancellor ? (
        <img
          src={CHANCELLOR_ROLE}
          alt="Chancellor"
          draggable={false}
          style={{ height: 25, width: "auto", maxWidth: 100, objectFit: "contain", display: "block" }}
        />
      ) : null}
    </div>
  );
}

function ClickableCardWrap({
  enabled,
  onClick,
  children,
}: {
  enabled: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role={enabled ? "button" : undefined}
      tabIndex={enabled ? 0 : -1}
      onClick={enabled ? onClick : undefined}
      onKeyDown={
        enabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        position: "relative",
        width: 86,
        height: 112,
        borderRadius: 10,
        outline: "none",
        cursor: enabled ? "pointer" : "default",
        filter: enabled ? "none" : "none",
      }}
    >
      {children}
      {enabled ? (
        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            border: "2px solid rgba(255, 214, 0, 0.88)",
            boxShadow: "0 0 0 3px rgba(255, 214, 0, 0.16), 0 10px 28px rgba(0,0,0,0.45)",
          }}
        />
      ) : null}
    </div>
  );
}

function AvatarTile({
  seat,
  name,
  roleColor,
  isChancellor,
  isPresident,
  electionPhase,
  electionVote,
  hasVoted,
  nominateEnabled,
  eligibleChancellorSeats,
  onNominate,
}: {
  seat: number;
  name: string;
  roleColor?: string | null;
  isChancellor?: boolean;
  isPresident?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;
  hasVoted?: boolean;

  nominateEnabled?: boolean;
  eligibleChancellorSeats?: number[];
  onNominate?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const pending = Boolean(isVoting && !hasVoted);

  const frontSrc = isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        {roleColor ? (
          <div
            aria-hidden="true"
            style={{
              height: 4,
              width: "68%",
              margin: "0 auto 4px",
              borderRadius: 999,
              background: roleColor,
              boxShadow: "0 2px 10px rgba(0,0,0,0.55)",
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: 14,
            color: roleColor ??"white",
            textShadow: "0 2px 0 rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={`${seat}. ${name}`}
        >
          {name}
        </div>
      </div>

      <ClickableCardWrap
        enabled={Boolean(
          nominateEnabled &&
            onNominate &&
            !isPresident &&
            (eligibleChancellorSeats?.includes(seat) === true)
        )}
        onClick={() => onNominate?.(seat)}
      >
        <CardBackRect w={86} h={112} src={frontSrc} flipToSrc={backSrc} flip={isReveal} pending={pending} />
        <RoleBadges isPresident={isPresident} isChancellor={isChancellor} />
      </ClickableCardWrap>
    </div>
  );
}

function SitDownTile({ onSit, disabled }: { onSit?: () => void; disabled?: boolean }) {
  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          marginBottom: 6,
          textShadow: "0 2px 0 rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title="Sit down"
      >
        Sit down
      </div>
      <button
        type="button"
        onClick={onSit}
        disabled={disabled}
        style={{
          width: "100%",
          height: 112,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.25)",
          background: disabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.22)",
          color: "rgba(0,0,0,0.8)",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 0.4,
          fontFamily: "var(--font-comfortaa)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        Sit
      </button>
    </div>
  );
}

function CardTile({
  seat,
  name,
  roleColor,
  isChancellor,
  isPresident,
  electionPhase,
  electionVote,

  hasVoted,

  nominateEnabled,
  eligibleChancellorSeats,
  onNominate,
}: {
  seat: number;
  name: string;
  roleColor?: string | null;
  isChancellor?: boolean;
  isPresident?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;

  hasVoted?: boolean;

  nominateEnabled?: boolean;
  eligibleChancellorSeats?: number[];
  onNominate?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const pending = Boolean(isVoting && !hasVoted);

  const frontSrc = isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        {roleColor ? (
          <div
            aria-hidden="true"
            style={{
              height: 4,
              width: "68%",
              margin: "0 auto 4px",
              borderRadius: 999,
              background: roleColor,
              boxShadow: "0 2px 10px rgba(0,0,0,0.55)",
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: 13,
            color: roleColor ?? "white",
            textShadow: "0 2px 0 rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={`${seat}. ${name}`}
        >
          {seat}. {name}
        </div>
      </div>

      <ClickableCardWrap
        enabled={Boolean(
          nominateEnabled &&
            onNominate &&
            !isPresident &&
            (eligibleChancellorSeats?.includes(seat) === true)
        )}
        onClick={() => onNominate?.(seat)}
      >
        <CardBackRect w={86} h={112} src={frontSrc} flipToSrc={backSrc} flip={isReveal} pending={pending} />
        <RoleBadges isPresident={isPresident} isChancellor={isChancellor} />
      </ClickableCardWrap>
    </div>
  );
}

export default function PlayerListView({
  playerCount,
  players,
  chancellorSeat,
  presidentSeat,

  electionPhase,
  electionVotes,
  electionVoteCast,

  eligibleChancellorSeats,
  visibleRoleColorsBySeat,

  // NEW: nomination
  nominateEnabled,
  onNominateChancellor,

  showSitButton,
  onSit,
  sitDisabled,
}: {
  playerCount: number;
  players?: PlayerSlot[];
  chancellorSeat?: number;
  presidentSeat?: number;

  electionPhase?: string;
  electionVotes?: Record<number, Vote | null>;
  electionVoteCast?: Record<number, boolean>;

  eligibleChancellorSeats?: number[];
  visibleRoleColorsBySeat?: Record<number, string>;

  // If true, tiles become clickable (except president seat) and call onNominateChancellor(seat)
  nominateEnabled?: boolean;
  onNominateChancellor?: (seat: number) => void;

  showSitButton?: boolean;
  onSit?: () => void;
  sitDisabled?: boolean;
}) {
  const clamped = Math.max(0, Math.min(7, playerCount));

  const fallbackName = (index: number) => `Player${index + 1}`;
  const getName = (index: number) => players?.[index]?.name ?? fallbackName(index);

  const showSeatButton = Boolean(showSitButton && clamped < 7);
  const sitButtonDisabled = Boolean(sitDisabled || !onSit);

  const containerStyle: CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    justifyContent: "center",
    flexWrap: "wrap",
  };

  const handleNominate = (seat: number) => {
    onNominateChancellor?.(seat);
  };

  if (clamped === 7) {
    return (
      <div style={containerStyle}>
        {Array.from({ length: 7 }).map((_, index) => {
          const seat = index + 1;
          return (
            <CardTile
              key={seat}
              seat={seat}
              name={getName(index)}
              roleColor={visibleRoleColorsBySeat?.[seat] ?? null}
              isChancellor={chancellorSeat === seat}
              isPresident={presidentSeat === seat}
              electionPhase={electionPhase}
              electionVote={electionVotes?.[seat] ?? null}
              hasVoted={electionVoteCast?.[seat] === true}
              nominateEnabled={Boolean(nominateEnabled)}
              eligibleChancellorSeats={eligibleChancellorSeats}
              onNominate={handleNominate}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {Array.from({ length: clamped }).map((_, index) => {
        const seat = index + 1;
        return (
          <AvatarTile
            key={seat}
            seat={seat}
            name={getName(index)}
            roleColor={visibleRoleColorsBySeat?.[seat] ?? null}
            isChancellor={chancellorSeat === seat}
            isPresident={presidentSeat === seat}
            electionPhase={electionPhase}
            electionVote={electionVotes?.[seat] ?? null}
            hasVoted={electionVoteCast?.[seat] === true}
            nominateEnabled={Boolean(nominateEnabled)}
            eligibleChancellorSeats={eligibleChancellorSeats}
            onNominate={handleNominate}
          />
        );
      })}
      {showSeatButton ? <SitDownTile onSit={onSit} disabled={sitButtonDisabled} /> : null}
    </div>
  );
}
