export type RecentlyPlayedTrack = {
  id: string | null;
  name?: string;
  artists?: Array<{ name?: string }>;
};

export type RecentlyPlayedContext = {
  uri?: string;
} | null;

export type RecentlyPlayedItem = {
  track: RecentlyPlayedTrack;
  played_at: string;
  context: RecentlyPlayedContext;
};

export type RecentlyPlayedResponse = {
  items: RecentlyPlayedItem[];
};

export type SpotifyRecentlyPlayedJobPayload = {
  spotifyUserId?: string;
  afterMs?: number;
  dryRun?: boolean;
};
