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
}: {
  w: number;
  h: number;
  src?: string;
  flipToSrc?: string;
  flip?: boolean;
}) {
  const front = src ?? DEFAULT_CARDBACK_BG;
  const back = flipToSrc ?? front;
  const hasBack = Boolean(flipToSrc);

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
        bottom: 6,
        transform: "translateX(-50%)",
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
          style={{ height: 20, width: "auto", maxWidth: 70, objectFit: "contain", display: "block" }}
        />
      ) : null}
      {isChancellor ? (
        <img
          src={CHANCELLOR_ROLE}
          alt="Chancellor"
          draggable={false}
          style={{ height: 20, width: "auto", maxWidth: 70, objectFit: "contain", display: "block" }}
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
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            border: "2px solid rgba(255,255,255,0.28)",
            boxShadow: "0 0 0 3px rgba(0,0,0,0.25)",
            opacity: 0,
            transition: "opacity 140ms ease",
          }}
          // simple hover effect without CSS files: use onMouseEnter/Leave? (kept minimal)
        />
      ) : null}
    </div>
  );
}

function AvatarTile({
  seat,
  name,
  isChancellor,
  isPresident,
  electionPhase,
  electionVote,
  nominateEnabled,
  onNominate,
}: {
  seat: number;
  name: string;
  isChancellor?: boolean;
  isPresident?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;

  nominateEnabled?: boolean;
  onNominate?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const frontSrc = isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  const canClick = Boolean(nominateEnabled && onNominate && !isPresident);

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 14,
          color: "white",
          marginBottom: 6,
          textShadow: "0 2px 0 rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={`${seat}. ${name}`}
      >
        {name}
      </div>

      <ClickableCardWrap enabled={canClick} onClick={() => onNominate?.(seat)}>
        <CardBackRect w={86} h={112} src={frontSrc} flipToSrc={backSrc} flip={isReveal} />
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
  isChancellor,
  isPresident,
  electionPhase,
  electionVote,

  nominateEnabled,
  onNominate,
}: {
  seat: number;
  name: string;
  isChancellor?: boolean;
  isPresident?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;

  nominateEnabled?: boolean;
  onNominate?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const frontSrc = isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  // president can’t nominate themselves (typical rule), so disable click on president seat
  const canClick = Boolean(nominateEnabled && onNominate && !isPresident);

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "white",
          marginBottom: 6,
          textShadow: "0 2px 0 rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={`${seat}. ${name}`}
      >
        {seat}. {name}
      </div>

      <ClickableCardWrap enabled={canClick} onClick={() => onNominate?.(seat)}>
        <CardBackRect w={86} h={112} src={frontSrc} flipToSrc={backSrc} flip={isReveal} />
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
              isChancellor={chancellorSeat === seat}
              isPresident={presidentSeat === seat}
              electionPhase={electionPhase}
              electionVote={electionVotes?.[seat] ?? null}
              nominateEnabled={Boolean(nominateEnabled)}
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
            isChancellor={chancellorSeat === seat}
            isPresident={presidentSeat === seat}
            electionPhase={electionPhase}
            electionVote={electionVotes?.[seat] ?? null}
            nominateEnabled={Boolean(nominateEnabled)}
            onNominate={handleNominate}
          />
        );
      })}
      {showSeatButton ? <SitDownTile onSit={onSit} disabled={sitButtonDisabled} /> : null}
    </div>
  );
}
