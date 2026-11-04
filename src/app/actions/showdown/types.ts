export type ShowdownCaption = {
  id: string;
  content: string;
  rating: number;
  matches: number;
};

/** One image and the two captions to compare. */
export type ShowdownMatchup = {
  imageId: string;
  imageUrl: string;
  imageDescription: string | null;
  left: ShowdownCaption;
  right: ShowdownCaption;
};

export type ShowdownPickResult = {
  winnerRating: number;
  loserRating: number;
  ratingChange: number;
  winnerMatches: number;
  loserMatches: number;
};

export type ShowdownRankedCaption = {
  captionId: string;
  content: string;
  rating: number;
  matches: number;
  wins: number;
};

export type ShowdownLeaderboardEntry = ShowdownRankedCaption & {
  imageId: string;
  imageUrl: string;
};

export type ShowdownSummary = {
  totalPicks: number;
  picksToday: number;
  tournaments: number;
  dayStreak: number;
  /** Share of picks where you chose the already-higher-rated caption; null until known. */
  crowdAgreementPct: number | null;
};

export const EMPTY_SHOWDOWN_SUMMARY: ShowdownSummary = {
  totalPicks: 0,
  picksToday: 0,
  tournaments: 0,
  dayStreak: 0,
  crowdAgreementPct: null,
};

export type ShowdownActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };