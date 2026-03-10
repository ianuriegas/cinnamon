import { getEnv } from "@/config/env.ts";
import type { SpotifyProfileResponse } from "./types.ts";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_API = "https://accounts.spotify.com/api/token";

export async function getAccessToken(): Promise<string> {
  const env = getEnv();

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

export async function fetchSpotifyProfileUserId(accessToken: string): Promise<string> {
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
