import type { RecentlyPlayedItem, RecentlyPlayedResponse } from "./recently-played/types.ts";
import type { TopTrackItem, TopTracksResponse } from "./top-tracks/types.ts";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const MAX_LIMIT = 50;

export async function fetchRecentlyPlayed(
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

export type TimeRange = "short_term" | "medium_term" | "long_term";

export async function fetchTopTracks(
  accessToken: string,
  timeRange: TimeRange = "medium_term",
): Promise<TopTrackItem[]> {
  const params = new URLSearchParams({
    limit: String(MAX_LIMIT),
    time_range: timeRange,
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/me/top/tracks?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch top tracks (${response.status}): ${body}`);
  }

  const data = (await response.json()) as TopTracksResponse;
  return data.items ?? [];
}
