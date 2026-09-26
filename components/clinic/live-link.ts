/** 🔴 Board 308: the link from the last invite, or null once that invitation is gone. */
export function liveLink(
  state: { ok?: boolean; link?: string; invitationId?: string },
  invitations: { id: string }[],
): string | null {
  if (!state.ok || !state.link) return null;
  if (state.invitationId && !invitations.some((row) => row.id === state.invitationId)) return null;
  return state.link;
}
