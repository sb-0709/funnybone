import type { ShowdownMatchup } from "@/app/actions/showdown/types";

export const SESSION_LENGTH = 5;

export type Side = "left" | "right";

/** What happened in one round of a session. */
export type RoundResult =
  | {
      kind: "picked";
      side: Side;
      winnerId: string;
      /** Rating points the winner gained (null if the pick couldn't be saved). */
      change: number | null;
      /** true = picked the caption that was already rated higher; null = both were equal. */
      agreedWithCrowd: boolean | null;
    }
  | { kind: "skipped" };

export type SessionRound = {
  matchup: ShowdownMatchup;
  result: RoundResult | null;
};

/** Plain data so it can be saved to localStorage and resumed after a refresh. */
export type SessionState = {
  version: 1;
  rounds: SessionRound[];
};

export const newSession = (first: ShowdownMatchup): SessionState => ({
  version: 1,
  rounds: [{ matchup: first, result: null }],
});

export const currentRound = (s: SessionState): SessionRound | null => {
  const last = s.rounds[s.rounds.length - 1];
  return last && !last.result ? last : null;
};

export const finishedRounds = (s: SessionState) => s.rounds.filter((r) => r.result).length;

export const isComplete = (s: SessionState) =>
  finishedRounds(s) >= SESSION_LENGTH && !currentRound(s);

export const usedImageIds = (s: SessionState) => s.rounds.map((r) => r.matchup.imageId);

export const recordResult = (s: SessionState, result: RoundResult): SessionState => ({
  ...s,
  rounds: s.rounds.map((r, i) => (i === s.rounds.length - 1 ? { ...r, result } : r)),
});

export const addRound = (s: SessionState, matchup: ShowdownMatchup): SessionState => ({
  ...s,
  rounds: [...s.rounds, { matchup, result: null }],
});

/** Totals for the end-of-session summary. */
export const sessionStats = (s: SessionState) => {
  const picked = s.rounds
    .map((r) => r.result)
    .filter((r): r is Extract<RoundResult, { kind: "picked" }> => r?.kind === "picked");
  const judged = picked.filter((r) => r.agreedWithCrowd !== null);
  const agreed = judged.filter((r) => r.agreedWithCrowd).length;
  let biggestUpsetIndex = -1;
  let biggestChange = 0;
  s.rounds.forEach((r, i) => {
    if (r.result?.kind === "picked" && r.result.agreedWithCrowd === false) {
      const change = r.result.change ?? 0;
      if (change > biggestChange) {
        biggestChange = change;
        biggestUpsetIndex = i;
      }
    }
  });
  return {
    picks: picked.length,
    skipped: s.rounds.filter((r) => r.result?.kind === "skipped").length,
    agreed,
    comparable: judged.length,
    pointsMoved: Math.round(picked.reduce((sum, r) => sum + (r.change ?? 0), 0)),
    biggestUpsetIndex,
  };
};

const STORAGE_PREFIX = "funnybone:showdown:session:v1:";

export const loadSavedSession = (userId: string): SessionState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.rounds) || parsed.rounds.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveSession = (userId: string, s: SessionState | null) => {
  try {
    if (!s) window.localStorage.removeItem(STORAGE_PREFIX + userId);
    else window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(s));
  } catch {
    // Storage can be unavailable (private mode); the game still works without resume.
  }
};