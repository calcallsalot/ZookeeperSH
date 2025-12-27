import Image from "next/image";

export default function Boards() {
  return (
    <div>
      <Image
        src="/images/cards/liberal_board.png"
        alt="Fascist board"
        width={650}
        height={442}
      />
      <Image
        src="/images/cards/fascist_board.png"
        alt="Liberal board"
        width={650}
        height={442}
      />
    </div>
  );
}
