import NDK, { NDKEvent, NDKFilter, NDKKind, NDKSubscription } from "@nostr-dev-kit/ndk";
import { getNDK } from "./ndk";

// Net Worthy custom event kinds (using NIP-78 arbitrary custom app data)
export const NET_WORTHY_KIND = 30078;

// Event tags for Net Worthy
export const NET_WORTHY_TAGS = {
  APP: "net-worthy",
  NET_WORTH_SHARE: "networth-share",
  MILESTONE: "milestone",
  POST: "post",
};

// Create a text note (kind 1)
export async function createTextNote(
  content: string,
  tags?: string[][]
): Promise<NDKEvent | null> {
  const ndk = getNDK();
  if (!ndk.signer) return null;

  const event = new NDKEvent(ndk);
  event.kind = NDKKind.Text;
  event.content = content;

  if (tags) {
    event.tags = tags;
  }

  // Add Net Worthy tag
  event.tags.push(["t", NET_WORTHY_TAGS.APP]);

  await event.publish();
  return event;
}

// Create a net worth share event
export async function createNetWorthShareEvent(
  netWorthDisplay: string,
  breakdown?: Record<string, string>,
  milestone?: string
): Promise<NDKEvent | null> {
  const ndk = getNDK();
  if (!ndk.signer) return null;

  const event = new NDKEvent(ndk);
  event.kind = NET_WORTHY_KIND;
  event.content = JSON.stringify({
    netWorth: netWorthDisplay,
    breakdown,
    milestone,
  });

  event.tags = [
    ["d", `networth-${Date.now()}`],
    ["t", NET_WORTHY_TAGS.APP],
    ["t", NET_WORTHY_TAGS.NET_WORTH_SHARE],
  ];

  if (milestone) {
    event.tags.push(["t", NET_WORTHY_TAGS.MILESTONE]);
  }

  await event.publish();
  return event;
}

// Fetch feed posts (text notes) from followed users
export async function fetchFeed(
  pubkeys: string[],
  limit = 50
): Promise<NDKEvent[]> {
  const ndk = getNDK();
  await ndk.connect();

  const filter: NDKFilter = {
    kinds: [NDKKind.Text],
    authors: pubkeys,
    limit,
    "#t": [NET_WORTHY_TAGS.APP],
  };

  const events = await ndk.fetchEvents(filter);
  return Array.from(events).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

// Fetch global Net Worthy feed
export async function fetchGlobalFeed(limit = 50): Promise<NDKEvent[]> {
  const ndk = getNDK();
  await ndk.connect();

  const filter: NDKFilter = {
    kinds: [NDKKind.Text],
    limit,
    "#t": [NET_WORTHY_TAGS.APP],
  };

  const events = await ndk.fetchEvents(filter);
  return Array.from(events).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

// Fetch net worth share events
export async function fetchNetWorthShares(
  pubkeys?: string[],
  limit = 20
): Promise<NDKEvent[]> {
  const ndk = getNDK();
  await ndk.connect();

  const filter: NDKFilter = {
    kinds: [NET_WORTHY_KIND],
    limit,
    "#t": [NET_WORTHY_TAGS.NET_WORTH_SHARE],
  };

  if (pubkeys && pubkeys.length > 0) {
    filter.authors = pubkeys;
  }

  const events = await ndk.fetchEvents(filter);
  return Array.from(events).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

// Subscribe to real-time feed updates
export function subscribeFeed(
  pubkeys: string[],
  onEvent: (event: NDKEvent) => void
): NDKSubscription {
  const ndk = getNDK();

  const filter: NDKFilter = {
    kinds: [NDKKind.Text],
    authors: pubkeys,
    "#t": [NET_WORTHY_TAGS.APP],
    since: Math.floor(Date.now() / 1000),
  };

  const subscription = ndk.subscribe(filter, { closeOnEose: false });
  subscription.on("event", onEvent);

  return subscription;
}

// React to an event (like)
export async function reactToEvent(
  eventId: string,
  eventPubkey: string,
  reaction = "+"
): Promise<NDKEvent | null> {
  const ndk = getNDK();
  if (!ndk.signer) return null;

  const event = new NDKEvent(ndk);
  event.kind = NDKKind.Reaction;
  event.content = reaction;
  event.tags = [
    ["e", eventId],
    ["p", eventPubkey],
  ];

  await event.publish();
  return event;
}

// Fetch reactions for an event
export async function fetchReactions(eventId: string): Promise<NDKEvent[]> {
  const ndk = getNDK();
  await ndk.connect();

  const filter: NDKFilter = {
    kinds: [NDKKind.Reaction],
    "#e": [eventId],
  };

  const events = await ndk.fetchEvents(filter);
  return Array.from(events);
}

// Reply to an event
export async function replyToEvent(
  eventId: string,
  eventPubkey: string,
  content: string
): Promise<NDKEvent | null> {
  const ndk = getNDK();
  if (!ndk.signer) return null;

  const event = new NDKEvent(ndk);
  event.kind = NDKKind.Text;
  event.content = content;
  event.tags = [
    ["e", eventId, "", "reply"],
    ["p", eventPubkey],
    ["t", NET_WORTHY_TAGS.APP],
  ];

  await event.publish();
  return event;
}

// Fetch replies to an event
export async function fetchReplies(eventId: string): Promise<NDKEvent[]> {
  const ndk = getNDK();
  await ndk.connect();

  const filter: NDKFilter = {
    kinds: [NDKKind.Text],
    "#e": [eventId],
  };

  const events = await ndk.fetchEvents(filter);
  return Array.from(events).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}
