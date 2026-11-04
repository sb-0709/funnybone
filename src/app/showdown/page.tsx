import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import {
  fetchMyShowdownSummaryAction,
  fetchShowdownSessionMatchupAction,
} from "@/app/actions/showdown";
import { ShowdownGame } from "@/components/showdown/showdown-game";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caption Showdown",
  description: "5 images, 2 captions each. Pick the funnier one.",
};

export default async function ShowdownPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.provider === "anonymous") {
    return redirect("/login");
  }

  const [firstMatchup, initialSummary] = await Promise.all([
    fetchShowdownSessionMatchupAction([]),
    fetchMyShowdownSummaryAction(),
  ]);

  return (
    <ShowdownGame
      userId={user.id}
      initialMatchup={firstMatchup.ok ? firstMatchup.data : null}
      initialError={firstMatchup.ok ? null : firstMatchup.error}
      initialSummary={initialSummary}
    />
  );
}