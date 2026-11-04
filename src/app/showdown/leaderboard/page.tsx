import type { ReactNode } from "react";
import Link from "next/link";
import { Swords, Trophy, TrendingUp, Zap, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { showdownStyles } from "@/components/showdown/styles";
import { createClient } from "@/utils/supabase/server";
import {
  fetchMyShowdownSummaryAction,
  fetchShowdownLeaderboardAction,
} from "@/app/actions/showdown";
import type { ShowdownLeaderboardEntry } from "@/app/actions/showdown/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Showdown Leaderboard",
  description: "The captions that win the most head-to-head matchups.",
};

const MIN_MATCHES = 1;
/** Below this many matchups a rating is still settling. */
const PROVISIONAL_BELOW = 3;
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function ShowdownLeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [result, summary] = await Promise.all([
    fetchShowdownLeaderboardAction(50, MIN_MATCHES),
    user ? fetchMyShowdownSummaryAction() : Promise.resolve(null),
  ]);

  const entries = result.ok ? result.data : [];
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="container mx-auto max-w-4xl px-4 pb-16 pt-6 sm:pt-10">
      <header className={showdownStyles.pageHeader}>
        <div>
          <h1 className={showdownStyles.pageTitle}>
            <Trophy className="h-8 w-8 text-primary" aria-hidden="true" />
            Showdown Leaderboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            The funniest captions on Crackd, decided by head-to-head picks.
          </p>
        </div>
        <Link
          href="/showdown"
          className={cn(showdownStyles.primaryButton, "self-start sm:self-auto")}
        >
          <Swords className="h-4 w-4" aria-hidden="true" />
          Play Showdown
        </Link>
      </header>

      <section aria-label="How ratings work" className="mb-8 grid gap-3 sm:grid-cols-3">
        <Explainer icon={<Star className="h-4 w-4" />} title="Everyone starts at 1500">
          Every caption begins equal. Its rating moves only through matchups.
        </Explainer>
        <Explainer icon={<TrendingUp className="h-4 w-4" />} title="Wins add points">
          Winning a matchup adds points to the winner and takes the same amount from the loser.
        </Explainer>
        <Explainer icon={<Zap className="h-4 w-4" />} title="Upsets pay more">
          Beating a higher-rated caption earns up to 32 points. Beating a weaker one earns
          only a few.
        </Explainer>
      </section>

      {summary && summary.totalPicks > 0 && (
        <p className={cn("mb-8 px-4 py-3 text-sm text-muted-foreground", showdownStyles.panel)}>
          You&apos;ve made{" "}
          <strong className="text-gray-900 dark:text-white">{summary.totalPicks}</strong> picks
          {summary.crowdAgreementPct !== null && (
            <>
              , agreeing with the crowd{" "}
              <strong className="text-gray-900 dark:text-white">
                {summary.crowdAgreementPct}%
              </strong>{" "}
              of the time
            </>
          )}
          {summary.dayStreak > 1 && <> · 🔥 {summary.dayStreak}-day streak</>}.
        </p>
      )}

      {!result.ok ? (
        <p className="text-center text-lg text-muted-foreground">{result.error}</p>
      ) : entries.length === 0 ? (
        <div className={cn("p-10 text-center", showdownStyles.panel)}>
          <p className="text-lg text-gray-900 dark:text-white">The leaderboard is empty.</p>
          <p className="mt-2 text-muted-foreground">
            Play a Showdown session and the captions you judge will appear here.
          </p>
        </div>
      ) : (
        <>
          <ol className="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Top three">
            {podium.map((entry, index) => (
              <PodiumCard key={entry.captionId} entry={entry} place={index} />
            ))}
          </ol>
          {rest.length > 0 && (
            <ol className="flex flex-col gap-3" start={4}>
              {rest.map((entry, index) => (
                <LeaderboardRow key={entry.captionId} entry={entry} place={index + 4} />
              ))}
            </ol>
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            &quot;Provisional&quot; means a caption has played fewer than {PROVISIONAL_BELOW}{" "}
            matchups, so its rating is still settling.
          </p>
        </>
      )}
    </div>
  );
}

function Explainer({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("p-4", showdownStyles.panel)}>
      <p className="mb-1 flex items-center gap-2 text-sm font-bold text-primary">
        {icon}
        {title}
      </p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Record({ entry }: { entry: ShowdownLeaderboardEntry }) {
  const losses = entry.matches - entry.wins;
  const undefeated = losses === 0;
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
      {entry.wins}W–{losses}L
      {undefeated && entry.matches >= 2 && (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-semibold text-green-500">
          Undefeated
        </span>
      )}
      {entry.matches < PROVISIONAL_BELOW && (
        <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold dark:bg-white/10">
          Provisional
        </span>
      )}
    </span>
  );
}

function PodiumCard({ entry, place }: { entry: ShowdownLeaderboardEntry; place: number }) {
  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden",
        showdownStyles.panel,
        place === 0 && "border-primary/60 sm:-mt-2"
      )}
    >
      <Link
        href={`/image/${entry.imageId}/captions`}
        className="relative block h-32 bg-neutral-900"
        aria-label="See all captions for this image"
      >
        {entry.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        <span className="absolute left-3 top-3 text-3xl drop-shadow" aria-hidden="true">
          {MEDALS[place]}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex-1 font-medium leading-snug text-gray-900 dark:text-white">
          {entry.content}
        </p>
        <div className="flex items-end justify-between gap-2">
          <Record entry={entry} />
          <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {Math.round(entry.rating)}
          </span>
        </div>
      </div>
    </li>
  );
}

function LeaderboardRow({ entry, place }: { entry: ShowdownLeaderboardEntry; place: number }) {
  return (
    <li className={cn("flex items-center gap-4 p-3", showdownStyles.panel)}>
      <span className={showdownStyles.placeNumber}>
        {place}
      </span>
      <Link
        href={`/image/${entry.imageId}/captions`}
        className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-900"
        aria-label="See all captions for this image"
      >
        {entry.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="leading-snug text-gray-900 dark:text-white">{entry.content}</p>
        <Record entry={entry} />
      </div>
      <span className="shrink-0 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
        {Math.round(entry.rating)}
      </span>
    </li>
  );
}