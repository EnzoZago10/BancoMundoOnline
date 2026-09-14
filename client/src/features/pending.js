export function canRespondPending(pending, playerId, isAdmin) {
  if (!pending) return false;
  if (pending.kind === "money" || pending.kind === "transfer") return pending.toId === playerId;
  return Boolean(isAdmin);
}

export function canSeePending(pending, playerId, isAdmin) {
  return Boolean(pending && (pending.fromId === playerId || pending.toId === playerId || isAdmin));
}
