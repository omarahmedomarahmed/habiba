import { RouteNotFound } from "@/components/patient/route-not-found";

export default function RoomNotFound() {
  /* TE55: the room's layout is navy, so the words are light. */
  return <RouteNotFound home="/sessions" tone="dark" />;
}
