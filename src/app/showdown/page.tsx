import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import {
  fetchMyShowdownPickCountAction,
  fetchShowdownMatchupAction,
} from "@/app/actions/showdown";
import { ShowdownGame } from "@/components/showdown/showdown-game";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caption Showdown",
  description: "Two captions, one image. Pick the funnier one.",
};

export default async function ShowdownPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.provider === "anonymous") {
    return redirect("/login");
  }

  const [initialMatchup, initialPickCount] = await Promise.all([
    fetchShowdownMatchupAction(),
    fetchMyShowdownPickCountAction(),
  ]);

  return (
    <ShowdownGame
      initialMatchup={initialMatchup.ok ? initialMatchup.data : null}
      initialError={initialMatchup.ok ? null : initialMatchup.error}
      initialPickCount={initialPickCount}
    />
  );
}
