"use client";

import ElectionModal, { type ElectionUIState, type Vote } from "../game/ElectionModal";
import PolicyModal, { type LegislativeUIState } from "../game/PolicyModal";

export const BOARD_IMAGES = {
  liberal: "/images/cards/liberal_board.png",
  fascist: "/images/cards/fascist_board.png",
};

export type BoardViewProps = {
  playerCount: number;

  // NEW (optional)
  election?: ElectionUIState;
  mySeat?: number | null;
  onVote?: (vote: Vote) => void;

  legislative?: LegislativeUIState;
  onPresidentDiscard?: (discardIndex: number) => void;
  onChancellorEnact?: (enactIndex: number) => void;
};

export default function BoardView({
  playerCount,
  election,
  mySeat = null,
  onVote,
  legislative,
  onPresidentDiscard,
  onChancellorEnact,
}: BoardViewProps) {
  const boards = [
    { key: "liberal" as const, src: BOARD_IMAGES.liberal },
    { key: "fascist" as const, src: BOARD_IMAGES.fascist },
  ];
  const showElectionModal = election?.phase === "election_voting";

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
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        {boards.map((b) => (
          <div key={b.key} style={{ position: "relative", width: "100%", maxWidth: 720, zIndex: 0 }}>
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
            />
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
