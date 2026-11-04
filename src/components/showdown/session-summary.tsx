"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PartyPopper, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { sessionStats, type SessionState } from "./session";
import { showdownStyles } from "./styles";

const CONFETTI = ["🎉", "😂", "🏆", "✨", "🤣", "🎊"];

// Deterministic spread so the burst renders the same every time.
const spread = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  emoji: CONFETTI[i % CONFETTI.length],
  x: (spread(i, 1) - 0.5) * 520,
  y: -(120 + spread(i, 2) * 220),
  rotate: (spread(i, 3) - 0.5) * 540,
  delay: spread(i, 4) * 0.15,
}));

interface SessionSummaryProps {
  session: SessionState;
  onPlayAgain: () => void;
}

export function SessionSummary({ session, onPlayAgain }: SessionSummaryProps) {
  const stats = sessionStats(session);
  const finished = session.rounds.filter((r) => r.result);

  const headline =
    stats.comparable === 0
      ? "You set the first rankings for these captions."
      : stats.agreed === stats.comparable
        ? "You and the crowd think alike."
        : stats.agreed === 0
          ? "A true contrarian. You went against the crowd every time."
          : `You agreed with the crowd on ${stats.agreed} of ${stats.comparable} matchups.`;

  return (
    <section className="relative" style={{ overflowX: "clip" }} aria-live="polite">
      <div className="pointer-events-none absolute left-1/2 top-24 z-20" aria-hidden="true">
        {CONFETTI_PIECES.map((p) => (
          <motion.span
            key={p.id}
            className="absolute text-2xl"
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{
              x: p.x,
              y: [0, p.y, p.y + 380],
              opacity: [1, 1, 0],
              rotate: p.rotate,
              scale: 1,
            }}
            transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className={cn("p-6 text-center sm:p-8", showdownStyles.panel, "border-primary/60")}
      >
        <p className={cn(showdownStyles.eyebrow, "justify-center")}>
          <PartyPopper className="h-5 w-5" aria-hidden="true" />
          Session complete
        </p>
        <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          {headline}
        </h2>

        <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-3">
          <SummaryStat label="Picks" value={stats.picks} />
          <SummaryStat label="Too close" value={stats.skipped} />
          <SummaryStat label="Points moved" value={stats.pointsMoved} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className={showdownStyles.primaryButton}
            autoFocus
          >
            Play another session
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <Link href="/showdown/leaderboard" className={showdownStyles.secondaryButton}>
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Leaderboard
          </Link>
        </div>
      </motion.div>

      <h3 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Your picks
      </h3>
      <ol className="flex flex-col gap-3">
        {finished.map((round, index) => {
          const result = round.result!;
          const winner =
            result.kind === "picked"
              ? result.side === "left"
                ? round.matchup.left
                : round.matchup.right
              : null;
          const upset = session.rounds.indexOf(round) === stats.biggestUpsetIndex;
          return (
            <li
              key={round.matchup.imageId}
              className={cn("flex items-center gap-4 p-3", showdownStyles.panel)}
            >
              <span className={showdownStyles.roundNumber}>
                {index + 1}
              </span>
              <Link
                href={`/image/${round.matchup.imageId}/captions`}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-900"
                aria-label="See all captions for this image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={round.matchup.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="leading-snug text-gray-900 dark:text-white">
                  {winner ? winner.content : "Too close to call"}
                </p>
                {result.kind === "picked" && (
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {result.agreedWithCrowd === true && <Chip tone="green">Agreed with crowd</Chip>}
                    {result.agreedWithCrowd === false && <Chip tone="red">Underdog pick</Chip>}
                    {result.agreedWithCrowd === null && <Chip tone="grey">First verdict</Chip>}
                    {upset && <Chip tone="red">Biggest upset</Chip>}
                  </p>
                )}
              </div>
              {result.kind === "picked" && result.change !== null && (
                <span className="shrink-0 text-sm font-bold tabular-nums text-green-500">
                  +{Math.round(result.change)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={showdownStyles.statBox}>
      <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</div>
      <div className="text-[11px] uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Chip({ tone, children }: { tone: "green" | "red" | "grey"; children: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-semibold",
        tone === "green" && "bg-green-500/15 text-green-600 dark:text-green-400",
        tone === "red" && "bg-primary/15 text-primary",
        tone === "grey" && "bg-black/5 text-muted-foreground dark:bg-white/10"
      )}
    >
      {children}
    </span>
  );
}