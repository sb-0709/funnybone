"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Swords, Trophy, SkipForward, RotateCcw } from "lucide-react";

import {
  fetchShowdownMatchupAction,
  recordShowdownPickAction,
} from "@/app/actions/showdown";
import type {
  ShowdownActionResult,
  ShowdownMatchup,
  ShowdownPickResult,
} from "@/app/actions/showdown";
import { Top100CaptionImage } from "@/components/top-100-caption-image";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { showdownStyles } from "./styles";

type Side = "left" | "right";

type Reveal = {
  winner: Side;
  result: ShowdownPickResult;
};

type Phase = "choosing" | "saving" | "revealed" | "loading" | "done" | "error";

const REVEAL_MS = 1600;
const DONE_MESSAGE =
  "There are no caption pairs left that you haven't compared. " +
  "See how your picks shaped the rankings.";

interface ShowdownGameProps {
  initialMatchup: ShowdownMatchup | null;
  initialError: string | null;
  initialPickCount: number;
}

export function ShowdownGame({
  initialMatchup,
  initialError,
  initialPickCount,
}: ShowdownGameProps) {
  const { toast } = useToast();
  const [matchup, setMatchup] = useState<ShowdownMatchup | null>(initialMatchup);
  const [phase, setPhase] = useState<Phase>(
    initialError ? "error" : initialMatchup ? "choosing" : "done"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [sessionPicks, setSessionPicks] = useState(0);
  const [totalPicks, setTotalPicks] = useState(initialPickCount);

  // Next matchup is fetched while the result is on screen, so "next" feels instant.
  const prefetchRef = useRef<Promise<ShowdownActionResult<ShowdownMatchup | null>> | null>(
    null
  );
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMatchup = useCallback(
    (result: ShowdownActionResult<ShowdownMatchup | null>) => {
      setReveal(null);
      if (!result.ok) {
        setErrorMessage(result.error);
        setPhase("error");
        return;
      }
      setErrorMessage(null);
      setMatchup(result.data);
      setPhase(result.data ? "choosing" : "done");
    },
    []
  );

  const loadNext = useCallback(
    async (excludeImageId?: string | null) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      setPhase("loading");
      const pending = prefetchRef.current ?? fetchShowdownMatchupAction(excludeImageId);
      prefetchRef.current = null;
      try {
        showMatchup(await pending);
      } catch (error) {
        console.error("Error loading matchup:", error);
        showMatchup({ ok: false, error: "Couldn't load the next matchup." });
      }
    },
    [showMatchup]
  );

  const pick = useCallback(
    async (winner: Side) => {
      if (!matchup || phase !== "choosing") return;
      const winnerCaption = winner === "left" ? matchup.left : matchup.right;
      const loserCaption = winner === "left" ? matchup.right : matchup.left;

      setPhase("saving");
      // Start loading the next pair right away (skip this image so it feels varied).
      prefetchRef.current = fetchShowdownMatchupAction(matchup.imageId);

      let result: ShowdownActionResult<ShowdownPickResult>;
      try {
        result = await recordShowdownPickAction(winnerCaption.id, loserCaption.id);
      } catch (error) {
        console.error("Error saving pick:", error);
        result = { ok: false, error: "Couldn't save your pick. Please try again." };
      }

      if (!result.ok) {
        toast({ title: "Pick not saved", description: result.error });
        // Already-judged pair: just move on. Anything else: let them retry.
        if (result.error.includes("already judged")) {
          void loadNext(matchup.imageId);
        } else {
          prefetchRef.current = null;
          setPhase("choosing");
        }
        return;
      }

      setReveal({ winner, result: result.data });
      setSessionPicks((n) => n + 1);
      setTotalPicks((n) => n + 1);
      setPhase("revealed");
      advanceTimerRef.current = setTimeout(() => {
        void loadNext(matchup.imageId);
      }, REVEAL_MS);
    },
    [loadNext, matchup, phase, toast]
  );

  const skip = useCallback(() => {
    if (!matchup || phase !== "choosing") return;
    void loadNext(matchup.imageId);
  }, [loadNext, matchup, phase]);

  // Keyboard: ← / 1 = left, → / 2 = right, S or ↓ = skip, Space/Enter = next.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (phase === "choosing") {
        if (event.key === "ArrowLeft" || event.key === "1") {
          event.preventDefault();
          void pick("left");
        } else if (event.key === "ArrowRight" || event.key === "2") {
          event.preventDefault();
          void pick("right");
        } else if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
          event.preventDefault();
          skip();
        }
      } else if (phase === "revealed" && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        void loadNext(matchup?.imageId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadNext, matchup?.imageId, phase, pick, skip]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    []
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 pb-16 pt-6 sm:pt-10">
      <header className={showdownStyles.pageHeader}>
        <div>
          <h1 className={showdownStyles.pageTitle}>
            <Swords className="h-8 w-8 text-primary" aria-hidden="true" />
            Caption Showdown
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Same image, two captions. Tap the funnier one.
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <Stat label="This session" value={sessionPicks} />
          <Stat label="All-time" value={totalPicks} />
          <Link
            href="/showdown/leaderboard"
            className={showdownStyles.secondaryButton}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Leaderboard
          </Link>
        </div>
      </header>

      {phase === "error" && (
        <EmptyState
          title="Something went wrong"
          body={errorMessage ?? "Couldn't load a matchup."}
          action={
            <button
              type="button"
              onClick={() => void loadNext()}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5",
                "font-semibold text-primary-foreground hover:bg-primary/90",
              )}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          }
        />
      )}

      {phase === "done" && (
        <EmptyState
          title="You've judged every matchup!"
          body={DONE_MESSAGE}
          action={
            <Link
              href="/showdown/leaderboard"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5",
                "font-semibold text-primary-foreground hover:bg-primary/90",
              )}
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              View leaderboard
            </Link>
          }
        />
      )}

      {matchup && phase !== "error" && phase !== "done" && (
        <AnimatePresence mode="wait">
          <motion.section
            key={`${matchup.imageId}-${matchup.left.id}-${matchup.right.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: phase === "loading" ? 0.4 : 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            aria-busy={phase === "loading" || phase === "saving"}
          >
            <div className={showdownStyles.imageFrame}>
              <Top100CaptionImage src={matchup.imageUrl} captionId={matchup.imageId} />
            </div>

            <div className={showdownStyles.choicesGrid}>
              <CaptionChoice
                side="left"
                shortcut="←"
                content={matchup.left.content}
                phase={phase}
                reveal={reveal}
                rating={matchup.left.rating}
                onPick={pick}
              />
              <div
                className={cn(
                  "flex items-center justify-center text-sm font-bold uppercase",
                  "tracking-widest text-muted-foreground",
                )}
                aria-hidden="true"
              >
                vs
              </div>
              <CaptionChoice
                side="right"
                shortcut="→"
                content={matchup.right.content}
                phase={phase}
                reveal={reveal}
                rating={matchup.right.rating}
                onPick={pick}
              />
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              {phase === "revealed" ? (
                <button
                  type="button"
                  onClick={() => void loadNext(matchup.imageId)}
                  className={cn(
                    "rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground",
                    "hover:bg-primary/90",
                  )}
                >
                  Next matchup
                </button>
              ) : (
                <button
                  type="button"
                  onClick={skip}
                  disabled={phase !== "choosing"}
                  className={showdownStyles.skipButton}
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  Can&apos;t decide — skip
                </button>
              )}
              <p className="hidden text-xs text-muted-foreground sm:block">
                Keyboard: ← left · → right · S skip
              </p>
            </div>

            <p aria-live="polite" className="sr-only">
              {reveal
                ? `Saved. The ${reveal.winner} caption gained ${Math.round(
                    reveal.result.ratingChange
                  )} points.`
                : ""}
            </p>
          </motion.section>
        </AnimatePresence>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={showdownStyles.statBox}>
      <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</div>
      <div className="whitespace-nowrap text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function CaptionChoice({
  side,
  shortcut,
  content,
  phase,
  reveal,
  rating,
  onPick,
}: {
  side: Side;
  shortcut: string;
  content: string;
  phase: Phase;
  reveal: Reveal | null;
  rating: number;
  onPick: (side: Side) => void;
}) {
  const revealed = phase === "revealed" && reveal;
  const isWinner = revealed && reveal.winner === side;
  const isLoser = revealed && reveal.winner !== side;
  const change = reveal ? Math.round(reveal.result.ratingChange) : 0;
  const newRating = reveal
    ? Math.round(isWinner ? reveal.result.winnerRating : reveal.result.loserRating)
    : Math.round(rating);

  return (
    <button
      type="button"
      onClick={() => onPick(side)}
      disabled={phase !== "choosing"}
      aria-label={`Pick this caption: ${content}`}
      className={cn(
        showdownStyles.choiceBase,
        phase === "choosing" &&
          showdownStyles.choiceIdle,
        phase !== "choosing" && !revealed && "border-gray-200 dark:border-white/10",
        isWinner && "border-primary shadow-lg shadow-primary/20",
        isLoser && "border-gray-200 opacity-60 dark:border-white/10"
      )}
    >
      <p className="text-lg font-medium leading-relaxed text-gray-900 dark:text-white">{content}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className={showdownStyles.keyHint}>{shortcut}</span>
        <AnimatePresence>
          {revealed && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  isWinner ? "text-green-500" : "text-primary"
                )}
              >
                {isWinner ? `+${change}` : `−${change}`}
              </span>
              <span className="tabular-nums">rating {newRating}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {isWinner && (
        <span className={showdownStyles.pickBadge}>
          Your pick
        </span>
      )}
    </button>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center",
        showdownStyles.panel
      )}
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
