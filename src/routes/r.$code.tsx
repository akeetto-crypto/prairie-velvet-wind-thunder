import { createFileRoute } from "@tanstack/react-router";
import { Session } from "@/components/session";

export const Route = createFileRoute("/r/$code")({
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  return <Session mode="room" code={code} />;
}
