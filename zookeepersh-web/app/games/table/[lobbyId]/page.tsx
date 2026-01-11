import { LobbySocketProvider } from "../../../frontend-scripts/components/lobby/LobbySocketContext";
import TableClient from "./table-client";

export default async function Page({
  params,
}: {
  params: Promise<{ lobbyId: string }>;
}) {
  const { lobbyId } = await params;

  return (
    <LobbySocketProvider>
      <TableClient lobbyId={lobbyId} />
    </LobbySocketProvider>
  );
}
