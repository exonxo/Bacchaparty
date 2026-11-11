#!/usr/bin/env node
/** Mirrors src/lib/useHostRoom host presence helpers (keep in sync). */
function hostPresenceId(ownerId, tabId) {
  return `host:${ownerId}:${tabId}`;
}

function parseHostPresence(id) {
  if (!id.startsWith("host:")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep >= rest.length - 1) return null;
  return { ownerId: rest.slice(0, sep), tabId: rest.slice(sep + 1) };
}

function presenceHostConflict(ids, ownerId, tabId, seenRemoteRoom) {
  if (!ownerId) return ids.some((id) => id.startsWith("host:"));
  for (const id of ids) {
    const who = parseHostPresence(id);
    if (!who) continue;
    if (who.ownerId !== ownerId) return true;
    if (who.tabId !== tabId) return seenRemoteRoom;
  }
  return false;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const owner = "auth-user-1";
const tabA = "tab-a";
const tabB = "tab-b";

assert(parseHostPresence("host:u:t")?.ownerId === "u", "parse owner");
assert(parseHostPresence("host:onlytab") === null, "legacy tab-only ignored");
assert(hostPresenceId(owner, tabA) === `host:${owner}:${tabA}`, "format");

// Stale same-user presence after refresh: other tab id ghost, no live broadcasts
assert(
  !presenceHostConflict([hostPresenceId(owner, tabB)], owner, tabA, false),
  "same user stale ghost must not conflict"
);

// Live second tab
assert(
  presenceHostConflict([hostPresenceId(owner, tabB)], owner, tabA, true),
  "same user live second tab conflicts"
);

// Different user (should not happen for owned room)
assert(
  presenceHostConflict([hostPresenceId("other", tabB)], owner, tabA, false),
  "different owner conflicts"
);

console.log("host-presence-unit: OK");
