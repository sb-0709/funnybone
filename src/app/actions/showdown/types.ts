export type ShowdownCaption = {
  id: string;
  content: string;
  rating: number;
  matches: number;
};

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

export type ShowdownLeaderboardEntry = {
  captionId: string;
  content: string;
  imageId: string;
  imageUrl: string;
  rating: number;
  matches: number;
  wins: number;
};

export type ShowdownActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
