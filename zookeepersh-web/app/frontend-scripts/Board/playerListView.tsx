"use client";

import type { CSSProperties } from "react";

const DEFAULT_CARDBACK_BG = "/images/card_backs/default_cardback.png";

type PlayerSlot = {
  name: string;
};


function CardBackRect({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(0,0,0,0.35)", // letterbox background (optional)
      }}
    >
      <img
        src={DEFAULT_CARDBACK_BG}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",      // shows entire image (no crop)
          objectPosition: "center",
          display: "block",
        }}
      />
    </div>
  );
}

function AvatarTile({ name }: { name: string }) {
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
        title={name}
      >
        {name}
      </div>

      <CardBackRect w={86} h={112} />
    </div>
  );
}

function SitDownTile({
  onSit,
  disabled,
}: {
  onSit?: () => void;
  disabled?: boolean;
}) {
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
}: {
  seat: number;
  name: string;
  isChancellor?: boolean;
  isPresident?: boolean;
}) {
  return (
    <div style={{ width: 86 }}>
      {/* name */}
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

      {/* image-only card */}
      <div style={{ position: "relative" }}>
        <CardBackRect w={86} h={112} />
        {/* optional badges */}
        {isPresident ? (
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 6,
              padding: "4px 6px",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.7,
              borderRadius: 8,
              background: "rgba(20, 80, 160, 0.88)",
              border: "1px solid rgba(255,255,255,0.25)",
              textShadow: "0 2px 0 rgba(0,0,0,0.4)",
            }}
          >
            PRESIDENT
          </div>
        ) : null}

        {isChancellor ? (
          <div
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              bottom: 6,
              padding: "5px 6px",
              textAlign: "center",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.7,
              borderRadius: 8,
              background: "rgba(150, 20, 20, 0.88)",
              border: "1px solid rgba(255,255,255,0.25)",
              textShadow: "0 2px 0 rgba(0,0,0,0.4)",
            }}
          >
            CHANCELLOR
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PlayerListView({
  playerCount,
  players,
  chancellorSeat, // 1..7
  presidentSeat,  // 1..7 (optional)
  showSitButton,
  onSit,
  sitDisabled,
}: {
  playerCount: number;
  players?: PlayerSlot[];
  chancellorSeat?: number;
  presidentSeat?: number;
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

  // FULL (7) -> card view
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
            />
          );
        })}

      </div>
    );
  }

  // NOT FULL -> avatar view
  return (
    <div style={containerStyle}>
      {Array.from({ length: clamped }).map((_, index) => (
        <AvatarTile key={index} name={getName(index)} />
      ))}
      {showSeatButton ? (
        <SitDownTile onSit={onSit} disabled={sitButtonDisabled} />
      ) : null}
    </div>
  );
}

