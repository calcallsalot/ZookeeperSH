export const BOARD_IMAGES = {
  liberal: "/images/cards/liberal_board.png",
  fascist: "/images/cards/fascist_board.png",
};

export type BoardViewProps = {
  playerCount: number;
};

export default function BoardView({ playerCount }: BoardViewProps) {
  const boardImages = [BOARD_IMAGES.liberal, BOARD_IMAGES.fascist];

  return (
    <div style={{ display: "grid"}}>
      {boardImages.map((src) => (
        <img
          key={src}
          src={src}
          alt="Game board"
          style={{ width: "100%", maxWidth: 720, borderRadius: 12 }}
        />
      ))}
    </div>
  );
}
