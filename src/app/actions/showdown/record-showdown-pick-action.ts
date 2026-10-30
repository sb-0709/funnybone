"use server";

import { createClient } from "@/utils/supabase/server";
import type { ShowdownActionResult, ShowdownPickResult } from "./types";

/**
 * Record that the signed-in user found `winnerCaptionId` funnier than
 * `loserCaptionId`. The database validates the pair and updates both Elo ratings.
 */
export const recordShowdownPickAction = async (
  winnerCaptionId: string,
  loserCaptionId: string
): Promise<ShowdownActionResult<ShowdownPickResult>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Log in to play Caption Showdown." };
  }

  const { data, error } = await supabase.rpc("record_showdown_pick", {
    p_winner_caption_id: winnerCaptionId,
    p_loser_caption_id: loserCaptionId,
  });

  if (error) {
    console.error("Error recording showdown pick:", error);
    // Messages raised by record_showdown_pick are written for users.
    const friendly =
      error.code === "23505" || error.code === "22023" || error.code === "P0002"
        ? error.message
        : "Couldn't save your pick. Please try again.";
    return { ok: false, error: friendly };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, error: "Couldn't save your pick. Please try again." };
  }

  return {
    ok: true,
    data: {
      winnerRating: row.winner_rating,
      loserRating: row.loser_rating,
      ratingChange: row.rating_change,
      winnerMatches: row.winner_matches,
      loserMatches: row.loser_matches,
    },
  };
};
