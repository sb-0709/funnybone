"use server";

import { createClient } from "@/utils/supabase/server";
import type { ShowdownActionResult, ShowdownMatchup } from "./types";

/**
 * Ask the database for the next Caption Showdown matchup: one public image and
 * two of its captions the signed-in user has not compared yet.
 * Returns data: null when the user has judged every available pair.
 */
export const fetchShowdownMatchupAction = async (
  excludeImageId?: string | null
): Promise<ShowdownActionResult<ShowdownMatchup | null>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Log in to play Caption Showdown." };
  }

  const { data, error } = await supabase.rpc(
    "get_showdown_matchup",
    excludeImageId ? { p_exclude_image_id: excludeImageId } : {}
  );

  if (error) {
    console.error("Error fetching showdown matchup:", error);
    return { ok: false, error: "Couldn't load the next matchup." };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      imageId: row.image_id,
      imageUrl: row.image_url ?? "",
      imageDescription: row.image_description,
      left: {
        id: row.left_caption_id,
        content: row.left_content ?? "",
        rating: row.left_rating,
        matches: row.left_matches,
      },
      right: {
        id: row.right_caption_id,
        content: row.right_content ?? "",
        rating: row.right_rating,
        matches: row.right_matches,
      },
    },
  };
};
