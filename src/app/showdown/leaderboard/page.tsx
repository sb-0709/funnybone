import Link from "next/link";
import { Swords, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { showdownStyles } from "@/components/showdown/styles";

import { fetchShowdownLeaderboardAction } from "@/app/actions/showdown";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Showdown Leaderboard",
  description: "The captions that win the most head-to-head matchups.",
};

export default async function ShowdownLeaderboardPage() {
  const result = await fetchShowdownLeaderboardAction(50, 1);

  return (
    <div className="container mx-auto max-w-4xl px-4 pb-16 pt-6 sm:pt-10">
      <header className={showdownStyles.pageHeader}>
        <div>
          <h1 className={showdownStyles.pageTitle}>
            <Trophy className="h-8 w-8 text-primary" aria-hidden="true" />
            Showdown Leaderboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Captions ranked by Elo rating from head-to-head picks. Everyone starts at 1500.
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

      {!result.ok ? (
        <p className="text-center text-lg text-muted-foreground">{result.error}</p>
      ) : result.data.length === 0 ? (
        <div className={cn("p-10 text-center", showdownStyles.panel)}>
          <p className="text-lg text-gray-900 dark:text-white">No matchups have been played yet.</p>
          <p className="mt-2 text-muted-foreground">Play a few rounds to start the rankings.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {result.data.map((entry, index) => {
            const winRate = entry.matches > 0 ? Math.round((entry.wins / entry.matches) * 100) : 0;
            return (
              <li
                key={entry.captionId}
                className={cn("flex items-center gap-4 p-3", showdownStyles.panel)}
              >
                <span
                  className={`w-8 shrink-0 text-center text-xl font-bold tabular-nums ${
                    index < 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <Link
                  href={`/image/${entry.imageId}/captions`}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-200",
                    "dark:bg-neutral-900",
                  )}
                  aria-label="See all captions for this image"
                >
                  {entry.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </Link>
                <p className="min-w-0 flex-1 text-base leading-snug text-gray-900 dark:text-white">
                  {entry.content}
                </p>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                    {Math.round(entry.rating)}
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {entry.wins}/{entry.matches} wins · {winRate}%
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
