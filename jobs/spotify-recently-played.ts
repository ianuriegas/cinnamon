import path from "node:path";
import { fileURLToPath } from "node:url";
import { desc, eq } from "drizzle-orm";

import { env } from "../config/env.ts";
import { db } from "../db/index.ts";
import { spotifyRecentlyPlayed } from "../db/schema/index.ts";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_API = "https://accounts.spotify.com/api/token";
const MAX_LIMIT = 50;

type RecentlyPlayedTrack = {
  id: string | null;
  name?: string;
  artists?: Array<{ name?: string }>;
};

type RecentlyPlayedContext = {
  uri?: string;
} | null;

type RecentlyPlayedItem = {
  track: RecentlyPlayedTrack;
  played_at: string;
  context: RecentlyPlayedContext;
};

type RecentlyPlayedResponse = {
  items: RecentlyPlayedItem[];
};

type SpotifyProfileResponse = {
  id: string;
};

export type SpotifyRecentlyPlayedJobPayload = {
  spotifyUserId?: string;
  afterMs?: number;
  dryRun?: boolean;
};

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

function toValidAfterMs(value: unknown): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

async function getAccessToken(): Promise<string> {
  if (env.spotifyAccessToken) {
    return env.spotifyAccessToken;
  }

  if (!env.spotifyClientId || !env.spotifyClientSecret || !env.spotifyRefreshToken) {
    throw new Error(
      "Spotify auth is not configured. Set SPOTIFY_ACCESS_TOKEN or " +
        "SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN.",
    );
  }

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", env.spotifyRefreshToken);

  const tokenResponse = await fetch(SPOTIFY_ACCOUNTS_API, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Failed to refresh Spotify access token (${tokenResponse.status}): ${body}`);
  }

  const data = (await tokenResponse.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Spotify token response did not include access_token.");
  }

  return data.access_token;
}

async function fetchSpotifyProfileUserId(accessToken: string): Promise<string> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch Spotify profile (${response.status}): ${body}`);
  }

  const profile = (await response.json()) as SpotifyProfileResponse;
  if (!profile.id) {
    throw new Error("Spotify profile response did not include user id.");
  }

  return profile.id;
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

async function fetchRecentlyPlayed(
  accessToken: string,
  afterMs?: number,
): Promise<RecentlyPlayedItem[]> {
  const params = new URLSearchParams({ limit: String(MAX_LIMIT) });

  if (afterMs) {
    params.set("after", String(afterMs));
  }

  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/recently-played?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch recently played tracks (${response.status}): ${body}`);
  }

  const data = (await response.json()) as RecentlyPlayedResponse;
  return data.items ?? [];
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

function parseDirectExecutionPayload(args: string[]): SpotifyRecentlyPlayedJobPayload {
  const payload: SpotifyRecentlyPlayedJobPayload = {};

  for (const arg of args) {
    if (arg === "--dry" || arg === "--dry-run" || arg === "-d") {
      payload.dryRun = true;
      continue;
    }

    if (!arg.trim().startsWith("{")) {
      continue;
    }

    try {
      const parsed = JSON.parse(arg) as SpotifyRecentlyPlayedJobPayload;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...payload, ...parsed };
      }
    } catch {
      // Ignore invalid JSON input and keep scanning args.
    }
  }

  return payload;
}

const isDirectExecution =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const payload = parseDirectExecutionPayload(process.argv.slice(2));
  runSpotifyRecentlyPlayedJob(payload)
    .then((result) => {
      console.log("Spotify recently played job completed:", result);
    })
    .catch((error) => {
      console.error("Spotify recently played job failed:", error);
      process.exit(1);
    });
}
