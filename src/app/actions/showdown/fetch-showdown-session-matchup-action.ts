"use server";

import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";
import type { ShowdownActionResult, ShowdownMatchup } from "./types";

type MatchupRow =
  Database["public"]["Functions"]["get_showdown_session_matchup"]["Returns"][number];

/**
 * Next matchup for a Showdown session: one image (not already used in this
 * session) and two of its captions the signed-in user hasn't compared.
 * Returns data: null when there are no matchups left for this user.
 */
export const fetchShowdownSessionMatchupAction = async (
  excludeImageIds: string[] = []
): Promise<ShowdownActionResult<ShowdownMatchup | null>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Log in to play Caption Showdown." };
  }

  const { data, error } = await supabase.rpc("get_showdown_session_matchup", {
    p_exclude_image_ids: excludeImageIds,
  });

  if (error) {
    console.error("Error fetching showdown matchup:", error);
    return { ok: false, error: "Couldn't load the next matchup." };
  }

  const row = ((data ?? []) as MatchupRow[])[0];
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