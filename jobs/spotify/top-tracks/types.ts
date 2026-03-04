export type TopTrackArtist = {
  id?: string;
  name?: string;
};

export type TopTrackItem = {
  id: string | null;
  name?: string;
  artists?: TopTrackArtist[];
  popularity?: number;
};

export type TopTracksResponse = {
  items: TopTrackItem[];
};

export type SpotifyTopTracksJobPayload = {
  spotifyUserId?: string;
  timeRange?: "short_term" | "medium_term" | "long_term";
  dryRun?: boolean;
};
