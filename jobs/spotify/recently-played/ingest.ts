import { desc, eq } from "drizzle-orm";

import { db } from "@/db/index.ts";
import { spotifyRecentlyPlayed } from "@/db/schema/index.ts";
import { fetchRecentlyPlayed } from "../api.ts";
import { fetchSpotifyProfileUserId, getAccessToken } from "../auth.ts";
import type { RecentlyPlayedItem, SpotifyRecentlyPlayedJobPayload } from "./types.ts";

function logFetchedItems(items: RecentlyPlayedItem[]) {
  if (items.length === 0) {
    console.log("Spotify recently played: fetched 0 items.");
    return;
  }

  console.log(`Spotify recently played: fetched ${items.length} items.`);
  for (const [index, item] of items.entries()) {
    const trackId = item.track?.id ?? "unknown-track";
    const trackName = item.track?.name ?? "unknown-name";
    const artistNames =
      item.track?.artists?.map((artist) => artist.name).filter((name): name is string => !!name) ??
      [];
    const artistsLabel = artistNames.length > 0 ? artistNames.join(", ") : "unknown-artist";
    const playedAt = item.played_at;
    const contextUri = item.context?.uri ?? "no-context";
    console.log(
      `  ${index + 1}. track="${trackName}" artists="${artistsLabel}" track_id=${trackId} played_at=${playedAt} context_uri=${contextUri}`,
    );
  }
}

export function toValidAfterMs(value: unknown): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

async function getLatestPlayedAtMs(userId: string): Promise<number | undefined> {
  const latest = await db
    .select({ playedAt: spotifyRecentlyPlayed.playedAt })
    .from(spotifyRecentlyPlayed)
    .where(eq(spotifyRecentlyPlayed.userId, userId))
    .orderBy(desc(spotifyRecentlyPlayed.playedAt))
    .limit(1);

  const playedAt = latest[0]?.playedAt;
  if (!playedAt) {
    return undefined;
  }

  return playedAt.getTime();
}

export async function runSpotifyRecentlyPlayedJob(payload: SpotifyRecentlyPlayedJobPayload = {}) {
  const accessToken = await getAccessToken();
  const spotifyUserId = payload.spotifyUserId ?? (await fetchSpotifyProfileUserId(accessToken));
  const payloadAfterMs = toValidAfterMs(payload.afterMs);
  const cursorAfterMs = payloadAfterMs ?? (await getLatestPlayedAtMs(spotifyUserId));
  console.log(
    `Spotify recently played: user=${spotifyUserId} afterMs=${cursorAfterMs ?? "none"} dryRun=${
      payload.dryRun ?? false
    }`,
  );
  const items = await fetchRecentlyPlayed(accessToken, cursorAfterMs);
  logFetchedItems(items);

  const rows = items
    .map((item) => {
      const trackId = item.track?.id;
      const playedAt = new Date(item.played_at);

      if (!trackId || Number.isNaN(playedAt.getTime())) {
        return null;
      }

      return {
        userId: spotifyUserId,
        trackId,
        playedAt,
        contextUri: item.context?.uri ?? null,
        trackRaw: item.track,
        contextRaw: item.context ?? null,
        raw: item,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    console.log("Spotify recently played: no valid rows to insert.");
    return {
      spotifyUserId,
      fetched: items.length,
      valid: 0,
      inserted: 0,
      duplicates: 0,
      usedAfterMs: cursorAfterMs ?? null,
      latestPlayedAt: null,
      dryRun: payload.dryRun ?? false,
    };
  }

  const latestPlayedAt = rows.reduce(
    (latest, row) => (row.playedAt.getTime() > latest.getTime() ? row.playedAt : latest),
    rows[0].playedAt,
  );

  if (payload.dryRun) {
    console.log(
      `Spotify recently played: dry run complete. valid=${rows.length}, inserted=0, duplicates=0`,
    );
    return {
      spotifyUserId,
      fetched: items.length,
      valid: rows.length,
      inserted: 0,
      duplicates: 0,
      usedAfterMs: cursorAfterMs ?? null,
      latestPlayedAt: latestPlayedAt.toISOString(),
      dryRun: true,
    };
  }

  const insertedRows = await db
    .insert(spotifyRecentlyPlayed)
    .values(rows)
    .onConflictDoNothing({
      target: [spotifyRecentlyPlayed.userId, spotifyRecentlyPlayed.playedAt],
    })
    .returning({ id: spotifyRecentlyPlayed.id });

  console.log(
    `Spotify recently played: valid=${rows.length}, inserted=${insertedRows.length}, duplicates=${
      rows.length - insertedRows.length
    }`,
  );

  return {
    spotifyUserId,
    fetched: items.length,
    valid: rows.length,
    inserted: insertedRows.length,
    duplicates: rows.length - insertedRows.length,
    usedAfterMs: cursorAfterMs ?? null,
    latestPlayedAt: latestPlayedAt.toISOString(),
    dryRun: false,
  };
}
