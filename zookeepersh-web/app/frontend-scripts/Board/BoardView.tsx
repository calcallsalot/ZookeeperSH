"use client";

import ElectionModal, { type ElectionUIState, type Vote } from "../game/ElectionModal";
import PolicyModal, { type LegislativeUIState } from "../game/PolicyModal";

export const BOARD_IMAGES = {
  liberal: "/images/cards/liberal_board.png",
  fascist: "/images/cards/fascist_board.png",
};

const POLICY_IMAGES = {
  liberal: "/images/cards/liberal-policy.png",
  fascist: "/images/cards/fascist-policy.png",
};

type EnactedPolicies = {
  liberal: number;
  fascist: number;
};

function PolicyTrack({ kind, count }: { kind: "liberal" | "fascist"; count: number }) {
  const totalSlots = kind === "liberal" ? 5 : 6;
  const safeCount = Math.max(0, Math.min(totalSlots, Math.floor(count)));

  const trackBox =
    kind === "liberal"
      ? { left: "12%", top: "14%", width: "64%", height: "56%", cols: 5, gap: "2.2%" }
      : { left: "12%", top: "22%", width: "74%", height: "54%", cols: 6, gap: "2.0%" };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: trackBox.left,
        top: trackBox.top,
        width: trackBox.width,
        height: trackBox.height,
        display: "grid",
        gridTemplateColumns: `repeat(${trackBox.cols}, 1fr)`,
        gap: trackBox.gap,
        alignItems: "center",
        justifyItems: "center",
      }}
    >
      {Array.from({ length: totalSlots }).map((_, idx) => (
        <div
          key={`${kind}-slot-${idx}`}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {idx < safeCount ? (
            <img
              src={POLICY_IMAGES[kind]}
              alt=""
              draggable={false}
              style={{
                height: "92%",
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: 6,
                filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.55))",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type BoardViewProps = {
  playerCount: number;

  // NEW (optional)
  election?: ElectionUIState;
  mySeat?: number | null;
  myAlive?: boolean;
  onVote?: (vote: Vote) => void;

  legislative?: LegislativeUIState;
  onPresidentDiscard?: (discardIndex: number) => void;
  onChancellorEnact?: (enactIndex: number) => void;

  enactedPolicies?: EnactedPolicies | null;
};

export default function BoardView({
  playerCount,
  election,
  mySeat = null,
  myAlive = true,
  onVote,
  legislative,
  onPresidentDiscard,
  onChancellorEnact,
  enactedPolicies,
}: BoardViewProps) {
  const libCount = enactedPolicies?.liberal ?? 0;
  const fasCount = enactedPolicies?.fascist ?? 0;

  const boards = [
    { key: "liberal" as const, src: BOARD_IMAGES.liberal },
    { key: "fascist" as const, src: BOARD_IMAGES.fascist },
  ];
  const showElectionModal = election?.phase === "election_voting" && myAlive !== false;

  const showPresidentPolicyModal =
    legislative?.phase === "legislative_president" &&
    mySeat != null &&
    legislative.presidentSeat === mySeat &&
    Array.isArray(legislative.presidentPolicies) &&
    typeof onPresidentDiscard === "function";

  const showChancellorPolicyModal =
    legislative?.phase === "legislative_chancellor" &&
    mySeat != null &&
    legislative.chancellorSeat === mySeat &&
    Array.isArray(legislative.chancellorPolicies) &&
    typeof onChancellorEnact === "function";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "grid", gap: 0, justifyItems: "start" }}>
        {boards.map((b) => (
          <div key={b.key} style={{ position: "relative", width: "100%", maxWidth: 675, zIndex: 0 }}>
            <img
              src={b.src}
              alt="Game board"
              draggable={false}
              style={{ width: "100%", borderRadius: 12, display: "block" }}
            />

            {/* policy overlay layer (place policy cards here later, percent-based positioning works well) */}
            <div
              data-policy-layer={b.key}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <PolicyTrack kind={b.key} count={b.key === "liberal" ? libCount : fasCount} />
            </div>
          </div>
        ))}
      </div>

      {election && onVote ? (
        <ElectionModal open={!!showElectionModal} election={election} mySeat={mySeat} onVote={onVote} />
      ) : null}

      {showPresidentPolicyModal ? (
        <PolicyModal
          open={true}
          mode="president"
          policies={legislative?.presidentPolicies ?? []}
          onPick={(i) => onPresidentDiscard?.(i)}
        />
      ) : null}

      {showChancellorPolicyModal ? (
        <PolicyModal
          open={true}
          mode="chancellor"
          policies={legislative?.chancellorPolicies ?? []}
          onPick={(i) => onChancellorEnact?.(i)}
        />
      ) : null}
    </div>
  );
}
