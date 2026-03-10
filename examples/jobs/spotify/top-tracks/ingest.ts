import { db } from "@/db/index.ts";
import { spotifyTopTracks } from "@/db/schema/index.ts";
import { fetchTopTracks, type TimeRange } from "../api.ts";
import { fetchSpotifyProfileUserId, getAccessToken } from "../auth.ts";
import type { SpotifyTopTracksJobPayload, TopTrackItem } from "./types.ts";

const ALL_TIME_RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

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

async function runForTimeRange(
  accessToken: string,
  spotifyUserId: string,
  timeRange: TimeRange,
  snapshotDate: string,
  dryRun: boolean,
): Promise<{
  timeRange: TimeRange;
  fetched: number;
  valid: number;
  inserted: number;
  duplicates: number;
}> {
  console.log(
    `Spotify top tracks: user=${spotifyUserId} timeRange=${timeRange} snapshot=${snapshotDate} dryRun=${dryRun}`,
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
    return { timeRange, fetched: items.length, valid: 0, inserted: 0, duplicates: 0 };
  }

  if (dryRun) {
    console.log(
      `Spotify top tracks: dry run complete. valid=${rows.length}, inserted=0, duplicates=0`,
    );
    return { timeRange, fetched: items.length, valid: rows.length, inserted: 0, duplicates: 0 };
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
    timeRange,
    fetched: items.length,
    valid: rows.length,
    inserted: insertedRows.length,
    duplicates: rows.length - insertedRows.length,
  };
}

export async function runSpotifyTopTracksJob(payload: SpotifyTopTracksJobPayload = {}) {
  const accessToken = await getAccessToken();
  const spotifyUserId = payload.spotifyUserId ?? (await fetchSpotifyProfileUserId(accessToken));
  const snapshotDate = todayDateString();
  const dryRun = payload.dryRun ?? false;

  const timeRangesToRun: TimeRange[] = payload.timeRange ? [payload.timeRange] : ALL_TIME_RANGES;

  console.log(
    `Spotify top tracks: user=${spotifyUserId} timeRanges=[${timeRangesToRun.join(", ")}] snapshot=${snapshotDate} dryRun=${dryRun}`,
  );

  const results = await Promise.all(
    timeRangesToRun.map((tr) =>
      runForTimeRange(accessToken, spotifyUserId, tr, snapshotDate, dryRun),
    ),
  );

  return {
    spotifyUserId,
    snapshotDate,
    dryRun,
    results,
  };
}
