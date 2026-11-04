"use server";

import { createClient } from "@/utils/supabase/server";
import { EMPTY_SHOWDOWN_SUMMARY, type ShowdownSummary } from "./types";

/** The signed-in user's Showdown stats, computed from their saved picks. */
export const fetchMyShowdownSummaryAction = async (
  timeZone = "America/New_York"
): Promise<ShowdownSummary> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY_SHOWDOWN_SUMMARY;

  const { data, error } = await supabase.rpc("get_my_showdown_summary", {
    p_tz: timeZone,
  });

  const row = data?.[0];
  if (error || !row) {
    if (error) console.error("Error fetching showdown summary:", error);
    return EMPTY_SHOWDOWN_SUMMARY;
  }

  return {
    totalPicks: row.total_picks,
    picksToday: row.picks_today,
    tournaments: row.tournaments,
    dayStreak: row.day_streak,
    crowdAgreementPct: row.crowd_agreement_pct,
  };
};