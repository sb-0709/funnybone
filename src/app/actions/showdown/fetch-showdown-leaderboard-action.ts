"use server";

import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import type { ShowdownActionResult, ShowdownLeaderboardEntry } from "./types";

type LeaderboardRow =
  Database["public"]["Functions"]["get_showdown_leaderboard"]["Returns"][number];

export const fetchShowdownLeaderboardAction = async (
  limit = 50,
  minMatches = 1
): Promise<ShowdownActionResult<ShowdownLeaderboardEntry[]>> => {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_showdown_leaderboard", {
    p_limit: limit,
    p_min_matches: minMatches,
  });

  if (error) {
    console.error("Error fetching showdown leaderboard:", error);
    return { ok: false, error: "Couldn't load the leaderboard." };
  }

  return {
    ok: true,
    data: ((data ?? []) as LeaderboardRow[]).map((row) => ({
      captionId: row.caption_id,
      content: row.content ?? "",
      imageId: row.image_id,
      imageUrl: row.image_url ?? "",
      rating: row.rating,
      matches: row.matches,
      wins: row.wins,
    })),
  };
};
