import { db } from "@/db/index.ts";
import { spotifyTopTracks } from "@/db/schema/index.ts";
import { fetchTopTracks, type TimeRange } from "../api.ts";
import { fetchSpotifyProfileUserId, getAccessToken } from "../auth.ts";
import type { SpotifyTopTracksJobPayload, TopTrackItem } from "./types.ts";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function logFetchedItems(items: TopTrackItem[], timeRange: TimeRange) {
  if (items.length === 0) {
    console.log(`Spotify top tracks (${timeRange}): fetched 0 items.`);
    return;
  }

  console.log(`Spotify top tracks (${timeRange}): fetched ${items.length} items.`);
  for (const [index, item] of items.entries()) {
    const trackId = item.id ?? "unknown-track";
    const trackName = item.name ?? "unknown-name";
    const artistNames =
      item.artists?.map((a) => a.name).filter((name): name is string => !!name) ?? [];
    const artistsLabel = artistNames.length > 0 ? artistNames.join(", ") : "unknown-artist";
    console.log(
      `  ${index + 1}. track="${trackName}" artists="${artistsLabel}" track_id=${trackId}`,
    );
  }
}

export async function runSpotifyTopTracksJob(payload: SpotifyTopTracksJobPayload = {}) {
  const accessToken = await getAccessToken();
  const spotifyUserId = payload.spotifyUserId ?? (await fetchSpotifyProfileUserId(accessToken));
  const timeRange: TimeRange = payload.timeRange ?? "medium_term";
  const snapshotDate = todayDateString();

  console.log(
    `Spotify top tracks: user=${spotifyUserId} timeRange=${timeRange} snapshot=${snapshotDate} dryRun=${payload.dryRun ?? false}`,
  );

  const items = await fetchTopTracks(accessToken, timeRange);
  logFetchedItems(items, timeRange);

  const rows = items
    .map((item, index) => {
      if (!item.id) return null;

      return {
        userId: spotifyUserId,
        trackId: item.id,
        timeRange,
        rank: index + 1,
        snapshotDate,
        trackRaw: item,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    console.log("Spotify top tracks: no valid rows to insert.");
    return {
      spotifyUserId,
      timeRange,
      snapshotDate,
      fetched: items.length,
      valid: 0,
      inserted: 0,
      duplicates: 0,
      dryRun: payload.dryRun ?? false,
    };
  }

  if (payload.dryRun) {
    console.log(
      `Spotify top tracks: dry run complete. valid=${rows.length}, inserted=0, duplicates=0`,
    );
    return {
      spotifyUserId,
      timeRange,
      snapshotDate,
      fetched: items.length,
      valid: rows.length,
      inserted: 0,
      duplicates: 0,
      dryRun: true,
    };
  }

  const insertedRows = await db
    .insert(spotifyTopTracks)
    .values(rows)
    .onConflictDoNothing({
      target: [
        spotifyTopTracks.userId,
        spotifyTopTracks.trackId,
        spotifyTopTracks.timeRange,
        spotifyTopTracks.snapshotDate,
      ],
    })
    .returning({ id: spotifyTopTracks.id });

  console.log(
    `Spotify top tracks: valid=${rows.length}, inserted=${insertedRows.length}, duplicates=${
      rows.length - insertedRows.length
    }`,
  );

  return {
    spotifyUserId,
    timeRange,
    snapshotDate,
    fetched: items.length,
    valid: rows.length,
    inserted: insertedRows.length,
    duplicates: rows.length - insertedRows.length,
    dryRun: false,
  };
}
