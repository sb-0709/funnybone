"use server";

import { createClient } from "@/utils/supabase/server";

/** Total number of Showdown picks the signed-in user has made (all time). */
export const fetchMyShowdownPickCountAction = async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("caption_showdown_picks")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if (error) {
    console.error("Error counting showdown picks:", error);
    return 0;
  }

  return count ?? 0;
};
