"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const DEFAULT_CARDBACK_BG = "/images/card_backs/default_cardback.png";
const DEAD_CARDBACK_BG = "/images/card_backs/dead.png";

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
  style.textContent =
    "@keyframes zk_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
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

  // Bottom-center overlay (active roles)
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

function TermLockBadges({
  isPresidentTL,
  isChancellorTL,
}: {
  isPresidentTL?: boolean;
  isChancellorTL?: boolean;
}) {
  if (!isPresidentTL && !isChancellorTL) return null;

  // Top-center overlay (faded term-lock)
  return (
    <div
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: "50%",
        top: 2,
        transform: "translateX(-49%)",
        display: "flex",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.45,
        filter: "grayscale(1) brightness(1.15) drop-shadow(0 2px 2px rgba(0,0,0,0.65))",
      }}
    >
      {isPresidentTL ? (
        <img
          src={PRESIDENT_ROLE}
          alt="President (term locked)"
          draggable={false}
          style={{ height: 22, width: "auto", maxWidth: 100, objectFit: "contain", display: "block" }}
        />
      ) : null}
      {isChancellorTL ? (
        <img
          src={CHANCELLOR_ROLE}
          alt="Chancellor (term locked)"
          draggable={false}
          style={{ height: 22, width: "auto", maxWidth: 100, objectFit: "contain", display: "block" }}
        />
      ) : null}
    </div>
  );
}

function ClickableCardWrap({
  enabled,
  onClick,
  highlightColor,
  highlightGlow,
  children,
}: {
  enabled: boolean;
  onClick?: () => void;
  highlightColor?: string;
  highlightGlow?: string;
  children: ReactNode;
}) {
  const border = highlightColor ?? "rgba(255, 214, 0, 0.88)";
  const glow = highlightGlow ?? "rgba(255, 214, 0, 0.16)";
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
            border: `2px solid ${border}`,
            boxShadow: `0 0 0 3px ${glow}, 0 10px 28px rgba(0,0,0,0.45)`,
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
  revealedRoleName,
  isDead,
  isChancellor,
  isChancellorTL,
  isPresident,
  isPresidentTL,
  electionPhase,
  electionVote,
  hasVoted,
  nominateEnabled,
  eligibleChancellorSeats,
  onNominate,
  investigateEnabled,
  eligibleInvestigateSeats,
  onInvestigate,
  executeEnabled,
  eligibleExecuteSeats,
  onExecute,
}: {
  seat: number;
  name: string;
  roleColor?: string | null;
  revealedRoleName?: string | null;
  isDead?: boolean;
  isChancellor?: boolean;
  isChancellorTL?: boolean;
  isPresident?: boolean;
  isPresidentTL?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;
  hasVoted?: boolean;

  nominateEnabled?: boolean;
  eligibleChancellorSeats?: number[];
  onNominate?: (seat: number) => void;

  investigateEnabled?: boolean;
  eligibleInvestigateSeats?: number[];
  onInvestigate?: (seat: number) => void;

  executeEnabled?: boolean;
  eligibleExecuteSeats?: number[];
  onExecute?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const pending = Boolean(!isDead && isVoting && !hasVoted);

  const frontSrc = isDead ? DEAD_CARDBACK_BG : isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isDead ? undefined : isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  const action =
    !isDead && executeEnabled && onExecute && eligibleExecuteSeats?.includes(seat) === true
      ? ("execute" as const)
      : !isDead && investigateEnabled && onInvestigate && eligibleInvestigateSeats?.includes(seat) === true
        ? ("investigate" as const)
        : !isDead &&
            nominateEnabled &&
            onNominate &&
            !isPresident &&
            eligibleChancellorSeats?.includes(seat) === true
          ? ("nominate" as const)
          : null;

  const highlightColor =
    action === "execute"
      ? "rgba(255, 77, 77, 0.92)"
      : action === "investigate"
        ? "rgba(77, 163, 255, 0.92)"
        : action === "nominate"
          ? "rgba(255, 214, 0, 0.88)"
          : undefined;

  const highlightGlow =
    action === "execute"
      ? "rgba(255, 77, 77, 0.18)"
      : action === "investigate"
        ? "rgba(77, 163, 255, 0.18)"
        : action === "nominate"
          ? "rgba(255, 214, 0, 0.16)"
          : undefined;

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ opacity: isDead ? 0.72 : 1 }}>
          <div
            style={{
              fontSize: 14,
              color: roleColor ?? "white",
              textShadow: "0 2px 0 rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${seat}. ${name}`}
          >
            {name}
          </div>
          {revealedRoleName ? (
            <div
              style={{
                marginTop: 1,
                fontSize: 11,
                color: roleColor ?? "rgba(255,255,255,0.85)",
                textShadow: "0 2px 0 rgba(0,0,0,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={revealedRoleName}
            >
              {revealedRoleName}
            </div>
          ) : null}
        </div>
      </div>

      <ClickableCardWrap
        enabled={Boolean(action)}
        highlightColor={highlightColor}
        highlightGlow={highlightGlow}
        onClick={() => {
          if (action === "execute") onExecute?.(seat);
          else if (action === "investigate") onInvestigate?.(seat);
          else if (action === "nominate") onNominate?.(seat);
        }}
      >
        <CardBackRect
          w={86}
          h={112}
          src={frontSrc}
          flipToSrc={backSrc}
          flip={!isDead && isReveal}
          pending={pending}
        />
        <TermLockBadges isPresidentTL={isPresidentTL} isChancellorTL={isChancellorTL} />
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
  revealedRoleName,
  isDead,
  isChancellor,
  isChancellorTL,
  isPresident,
  isPresidentTL,
  electionPhase,
  electionVote,
  hasVoted,
  nominateEnabled,
  eligibleChancellorSeats,
  onNominate,
  investigateEnabled,
  eligibleInvestigateSeats,
  onInvestigate,
  executeEnabled,
  eligibleExecuteSeats,
  onExecute,
}: {
  seat: number;
  name: string;
  roleColor?: string | null;
  revealedRoleName?: string | null;
  isDead?: boolean;
  isChancellor?: boolean;
  isChancellorTL?: boolean;
  isPresident?: boolean;
  isPresidentTL?: boolean;
  electionPhase?: string;
  electionVote?: Vote | null;

  hasVoted?: boolean;

  nominateEnabled?: boolean;
  eligibleChancellorSeats?: number[];
  onNominate?: (seat: number) => void;

  investigateEnabled?: boolean;
  eligibleInvestigateSeats?: number[];
  onInvestigate?: (seat: number) => void;

  executeEnabled?: boolean;
  eligibleExecuteSeats?: number[];
  onExecute?: (seat: number) => void;
}) {
  const electionSrc = electionBackSrc(electionPhase, electionVote);
  const isVoting = electionPhase === "election_voting";
  const isReveal = electionPhase === "election_reveal";

  const pending = Boolean(!isDead && isVoting && !hasVoted);

  const frontSrc = isDead ? DEAD_CARDBACK_BG : isVoting || isReveal ? ELECTION_BALLOT : DEFAULT_CARDBACK_BG;
  const backSrc = isDead ? undefined : isReveal ? (electionSrc ?? ELECTION_BALLOT) : undefined;

  const action =
    !isDead && executeEnabled && onExecute && eligibleExecuteSeats?.includes(seat) === true
      ? ("execute" as const)
      : !isDead && investigateEnabled && onInvestigate && eligibleInvestigateSeats?.includes(seat) === true
        ? ("investigate" as const)
        : !isDead &&
            nominateEnabled &&
            onNominate &&
            !isPresident &&
            eligibleChancellorSeats?.includes(seat) === true
          ? ("nominate" as const)
          : null;

  const highlightColor =
    action === "execute"
      ? "rgba(255, 77, 77, 0.92)"
      : action === "investigate"
        ? "rgba(77, 163, 255, 0.92)"
        : action === "nominate"
          ? "rgba(255, 214, 0, 0.88)"
          : undefined;

  const highlightGlow =
    action === "execute"
      ? "rgba(255, 77, 77, 0.18)"
      : action === "investigate"
        ? "rgba(77, 163, 255, 0.18)"
        : action === "nominate"
          ? "rgba(255, 214, 0, 0.16)"
          : undefined;

  return (
    <div style={{ width: 86 }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ opacity: isDead ? 0.72 : 1 }}>
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
          {revealedRoleName ? (
            <div
              style={{
                marginTop: 1,
                fontSize: 11,
                color: roleColor ?? "rgba(255,255,255,0.85)",
                textShadow: "0 2px 0 rgba(0,0,0,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={revealedRoleName}
            >
              {revealedRoleName}
            </div>
          ) : null}
        </div>
      </div>

      <ClickableCardWrap
        enabled={Boolean(action)}
        highlightColor={highlightColor}
        highlightGlow={highlightGlow}
        onClick={() => {
          if (action === "execute") onExecute?.(seat);
          else if (action === "investigate") onInvestigate?.(seat);
          else if (action === "nominate") onNominate?.(seat);
        }}
      >
        <CardBackRect
          w={86}
          h={112}
          src={frontSrc}
          flipToSrc={backSrc}
          flip={!isDead && isReveal}
          pending={pending}
        />
        <TermLockBadges isPresidentTL={isPresidentTL} isChancellorTL={isChancellorTL} />
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

  // term-lock seats
  chancellorSeatTL,
  presidentSeatTL,

  electionPhase,
  electionVotes,
  electionVoteCast,

  eligibleChancellorSeats,
  visibleRoleColorsBySeat,

  aliveBySeat,
  revealedRolesBySeat,

  // nomination
  nominateEnabled,
  onNominateChancellor,

  // powers
  investigateEnabled,
  eligibleInvestigateSeats,
  onInvestigate,
  executeEnabled,
  eligibleExecuteSeats,
  onExecute,

  showSitButton,
  onSit,
  sitDisabled,
}: {
  playerCount: number;
  players?: PlayerSlot[];
  chancellorSeat?: number;
  presidentSeat?: number;

  chancellorSeatTL?: number;
  presidentSeatTL?: number;

  electionPhase?: string;
  electionVotes?: Record<number, Vote | null>;
  electionVoteCast?: Record<number, boolean>;

  eligibleChancellorSeats?: number[];
  visibleRoleColorsBySeat?: Record<number, string>;

  aliveBySeat?: Record<number, boolean>;
  revealedRolesBySeat?: Record<number, { id: string; color?: string } | null> | null;

  nominateEnabled?: boolean;
  onNominateChancellor?: (seat: number) => void;

  investigateEnabled?: boolean;
  eligibleInvestigateSeats?: number[];
  onInvestigate?: (seat: number) => void;
  executeEnabled?: boolean;
  eligibleExecuteSeats?: number[];
  onExecute?: (seat: number) => void;

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

  const handleInvestigate = (seat: number) => {
    onInvestigate?.(seat);
  };

  const handleExecute = (seat: number) => {
    onExecute?.(seat);
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
              revealedRoleName={revealedRolesBySeat?.[seat]?.id ?? null}
              isDead={aliveBySeat?.[seat] === false}
              isChancellor={chancellorSeat === seat}
              isPresident={presidentSeat === seat}
              isChancellorTL={chancellorSeatTL === seat}
              isPresidentTL={presidentSeatTL === seat}
              electionPhase={electionPhase}
              electionVote={electionVotes?.[seat] ?? null}
              hasVoted={electionVoteCast?.[seat] === true}
              nominateEnabled={Boolean(nominateEnabled)}
              eligibleChancellorSeats={eligibleChancellorSeats}
              onNominate={handleNominate}
              investigateEnabled={Boolean(investigateEnabled)}
              eligibleInvestigateSeats={eligibleInvestigateSeats}
              onInvestigate={handleInvestigate}
              executeEnabled={Boolean(executeEnabled)}
              eligibleExecuteSeats={eligibleExecuteSeats}
              onExecute={handleExecute}
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
            revealedRoleName={revealedRolesBySeat?.[seat]?.id ?? null}
            isDead={aliveBySeat?.[seat] === false}
            isChancellor={chancellorSeat === seat}
            isPresident={presidentSeat === seat}
            isChancellorTL={chancellorSeatTL === seat}
            isPresidentTL={presidentSeatTL === seat}
            electionPhase={electionPhase}
            electionVote={electionVotes?.[seat] ?? null}
            hasVoted={electionVoteCast?.[seat] === true}
            nominateEnabled={Boolean(nominateEnabled)}
            eligibleChancellorSeats={eligibleChancellorSeats}
            onNominate={handleNominate}
            investigateEnabled={Boolean(investigateEnabled)}
            eligibleInvestigateSeats={eligibleInvestigateSeats}
            onInvestigate={handleInvestigate}
            executeEnabled={Boolean(executeEnabled)}
            eligibleExecuteSeats={eligibleExecuteSeats}
            onExecute={handleExecute}
          />
        );
      })}
      {showSeatButton ? <SitDownTile onSit={onSit} disabled={sitButtonDisabled} /> : null}
    </div>
  );
}
