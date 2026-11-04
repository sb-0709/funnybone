"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, RotateCcw, Scale, Swords, Trophy, Users } from "lucide-react";

import {
  fetchMyShowdownSummaryAction,
  fetchShowdownSessionMatchupAction,
  recordShowdownPickAction,
} from "@/app/actions/showdown";
import type {
  ShowdownActionResult,
  ShowdownMatchup,
  ShowdownSummary,
} from "@/app/actions/showdown/types";
import { Top100CaptionImage } from "@/components/top-100-caption-image";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  SESSION_LENGTH,
  addRound,
  currentRound,
  finishedRounds,
  isComplete,
  loadSavedSession,
  newSession,
  recordResult,
  saveSession,
  usedImageIds,
  type RoundResult,
  type SessionState,
  type Side,
} from "./session";
import { SessionSummary } from "./session-summary";
import { showdownStyles } from "./styles";

type Phase = "starting" | "choosing" | "saving" | "revealed" | "summary" | "done" | "error";

const REVEAL_MS = 1200;
const ALL_PLAYED_MESSAGE =
  "There are no caption pairs left that you haven't judged. " +
  "See how your picks shaped the rankings.";

interface ShowdownGameProps {
  userId: string;
  initialMatchup: ShowdownMatchup | null;
  initialError: string | null;
  initialSummary: ShowdownSummary;
}

export function ShowdownGame({
  userId,
  initialMatchup,
  initialError,
  initialSummary,
}: ShowdownGameProps) {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionState | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [summary, setSummary] = useState<ShowdownSummary>(initialSummary);
  const [resumed, setResumed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchRef = useRef<Promise<ShowdownActionResult<ShowdownMatchup | null>> | null>(null);
  const timeZone = useRef<string>("America/New_York");

  const refreshSummary = useCallback(async () => {
    try {
      setSummary(await fetchMyShowdownSummaryAction(timeZone.current));
    } catch (error) {
      console.error("Error refreshing summary:", error);
    }
  }, []);

  const update = useCallback(
    (next: SessionState | null) => {
      setSession(next);
      saveSession(userId, next);
    },
    [userId]
  );

  /** Move on after a round: next matchup, or the summary after round 5. */
  const goToNextRound = useCallback(
    async (state: SessionState) => {
      if (isComplete(state)) {
        prefetchRef.current = null;
        update(state);
        setPhase("summary");
        void refreshSummary();
        return;
      }
      setPhase("starting");
      const pending =
        prefetchRef.current ?? fetchShowdownSessionMatchupAction(usedImageIds(state));
      prefetchRef.current = null;
      try {
        const result = await pending;
        if (!result.ok) {
          update(state);
          setErrorMessage(result.error);
          setPhase("error");
          return;
        }
        if (!result.data) {
          // Nothing left to judge: end the session early if any rounds were played.
          update(state);
          setPhase(finishedRounds(state) > 0 ? "summary" : "done");
          return;
        }
        update(addRound(state, result.data));
        setPhase("choosing");
      } catch (error) {
        console.error("Error loading next matchup:", error);
        update(state);
        setErrorMessage("Couldn't load the next matchup.");
        setPhase("error");
      }
    },
    [refreshSummary, update]
  );

  const startNewSession = useCallback(async () => {
    setPhase("starting");
    setResumed(false);
    try {
      const result = await fetchShowdownSessionMatchupAction([]);
      if (!result.ok) {
        setErrorMessage(result.error);
        setPhase("error");
        return;
      }
      if (!result.data) {
        update(null);
        setPhase("done");
        return;
      }
      update(newSession(result.data));
      setPhase("choosing");
    } catch (error) {
      console.error("Error starting session:", error);
      setErrorMessage("Couldn't start a new session.");
      setPhase("error");
    }
  }, [update]);

  // First load: resume this browser's unfinished session, if there is one.
  useEffect(() => {
    const init = () => {
      try {
        timeZone.current = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone.current;
      } catch {
        // keep default
      }
      void refreshSummary();

      const saved = loadSavedSession(userId);
      if (saved) {
        if (isComplete(saved)) {
          setSession(saved);
          setPhase("summary");
          return;
        }
        setResumed(true);
        if (currentRound(saved)) {
          setSession(saved);
          setPhase("choosing");
        } else {
          void goToNextRound(saved);
        }
        return;
      }
      if (initialError) {
        setPhase("error");
        return;
      }
      if (!initialMatchup) {
        setPhase("done");
        return;
      }
      update(newSession(initialMatchup));
      setPhase("choosing");
    };
    const id = window.setTimeout(init, 0);
    return () => window.clearTimeout(id);
  }, [goToNextRound, initialError, initialMatchup, refreshSummary, update, userId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const finishRound = useCallback(
    (state: SessionState, result: RoundResult) => {
      const next = recordResult(state, result);
      update(next);
      // Start loading the next matchup while the result is on screen.
      if (!isComplete(next)) {
        prefetchRef.current = fetchShowdownSessionMatchupAction(usedImageIds(next));
      }
      return next;
    },
    [update]
  );

  const pick = useCallback(
    async (side: Side) => {
      const round = session ? currentRound(session) : null;
      if (!session || !round || phase !== "choosing") return;
      const winner = side === "left" ? round.matchup.left : round.matchup.right;
      const loser = side === "left" ? round.matchup.right : round.matchup.left;

      setPhase("saving");
      let change: number | null = null;
      try {
        const result = await recordShowdownPickAction(winner.id, loser.id);
        if (result.ok) {
          change = result.data.ratingChange;
          setSummary((s) => ({
            ...s,
            totalPicks: s.totalPicks + 1,
            picksToday: s.picksToday + 1,
          }));
        } else if (!result.error.includes("already judged")) {
          toast({ title: "Pick not saved", description: result.error });
          setPhase("choosing");
          return;
        }
      } catch (error) {
        console.error("Error saving pick:", error);
        toast({ title: "Pick not saved", description: "Please try again." });
        setPhase("choosing");
        return;
      }

      const agreedWithCrowd =
        winner.rating === loser.rating ? null : winner.rating > loser.rating;
      const next = finishRound(session, {
        kind: "picked",
        side,
        winnerId: winner.id,
        change,
        agreedWithCrowd,
      });
      setPhase("revealed");
      timerRef.current = setTimeout(() => void goToNextRound(next), REVEAL_MS);
    },
    [finishRound, goToNextRound, phase, session, toast]
  );

  // "Too close to call": counts as a round, but nothing is saved.
  const skip = useCallback(() => {
    if (!session || !currentRound(session) || phase !== "choosing") return;
    const next = finishRound(session, { kind: "skipped" });
    void goToNextRound(next);
  }, [finishRound, goToNextRound, phase, session]);

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
        } else if (event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          skip();
        }
      } else if (phase === "summary" && event.key === "Enter") {
        event.preventDefault();
        void startNewSession();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, pick, skip, startNewSession]);

  // The round on screen: the open one, or (while revealing) the one just decided.
  const shownRound = session
    ? currentRound(session) ??
      (phase === "revealed" ? session.rounds[session.rounds.length - 1] : null)
    : null;
  const shownResult = phase === "revealed" ? shownRound?.result ?? null : null;

  return (
    <div className="container mx-auto max-w-5xl px-4 pb-16 pt-6 sm:pt-10">
      <header className={showdownStyles.pageHeader}>
        <div>
          <h1 className={showdownStyles.pageTitle}>
            <Swords className="h-8 w-8 text-primary" aria-hidden="true" />
            Caption Showdown
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            5 images, 2 captions each. Pick the funnier one.
          </p>
        </div>
        <Link href="/showdown/leaderboard" className={showdownStyles.secondaryButton}>
          <Trophy className="h-4 w-4" aria-hidden="true" />
          Leaderboard
        </Link>
      </header>

      <StatsBar summary={summary} />

      {phase === "error" && (
        <EmptyState
          title="Something went wrong"
          body={errorMessage ?? "Couldn't load a matchup."}
          action={
            <button
              type="button"
              onClick={() => (session ? void goToNextRound(session) : void startNewSession())}
              className={showdownStyles.primaryButton}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          }
        />
      )}

      {phase === "done" && (
        <EmptyState
          title="You've judged everything!"
          body={ALL_PLAYED_MESSAGE}
          action={
            <Link href="/showdown/leaderboard" className={showdownStyles.primaryButton}>
              <Trophy className="h-4 w-4" aria-hidden="true" />
              View leaderboard
            </Link>
          }
        />
      )}

      {phase === "starting" && (
        <div className="h-[420px] animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
      )}

      {phase === "summary" && session && (
        <SessionSummary session={session} onPlayAgain={() => void startNewSession()} />
      )}

      {session && shownRound && ["choosing", "saving", "revealed"].includes(phase) && (
        <section aria-busy={phase === "saving"}>
          <SessionProgress session={session} resumed={resumed} />

          <AnimatePresence mode="wait">
            <motion.div
              key={shownRound.matchup.imageId}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              <div className={showdownStyles.imageFrame}>
                <Top100CaptionImage
                  src={shownRound.matchup.imageUrl}
                  captionId={shownRound.matchup.imageId}
                />
              </div>

              <div className={showdownStyles.choicesGrid}>
                <CaptionChoice
                  side="left"
                  shortcut="←"
                  content={shownRound.matchup.left.content}
                  phase={phase}
                  result={shownResult}
                  onPick={pick}
                />
                <div className={showdownStyles.versus} aria-hidden="true">
                  vs
                </div>
                <CaptionChoice
                  side="right"
                  shortcut="→"
                  content={shownRound.matchup.right.content}
                  phase={phase}
                  result={shownResult}
                  onPick={pick}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex min-h-[64px] flex-col items-center gap-3">
            {phase === "revealed" && shownResult?.kind === "picked" ? (
              <CrowdNote result={shownResult} />
            ) : (
              <>
                <button
                  type="button"
                  onClick={skip}
                  disabled={phase !== "choosing"}
                  className={showdownStyles.skipButton}
                >
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  Too close to call
                </button>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Keyboard: ← left · → right · Space too close to call
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function CrowdNote({ result }: { result: Extract<RoundResult, { kind: "picked" }> }) {
  const text =
    result.agreedWithCrowd === null
      ? "First verdict on this pair. Your pick sets the ranking."
      : result.agreedWithCrowd
        ? "🤝 You agreed with the crowd."
        : "😈 Underdog pick! You went against the crowd.";
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center text-base font-medium text-gray-900 dark:text-white"
      aria-live="polite"
    >
      {text}
    </motion.p>
  );
}

function StatsBar({ summary }: { summary: ShowdownSummary }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        icon={<Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />}
        label="Day streak"
        value={`${summary.dayStreak}`}
      />
      <Stat label="Picks today" value={`${summary.picksToday}`} />
      <Stat label="All-time picks" value={`${summary.totalPicks}`} />
      <Stat
        icon={<Users className="h-4 w-4 text-primary" aria-hidden="true" />}
        label="Agree w/ crowd"
        value={summary.crowdAgreementPct === null ? "—" : `${summary.crowdAgreementPct}%`}
        title="How often you picked the caption that was already rated higher"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  title,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <div className={showdownStyles.statBox} title={title}>
      <div className="flex items-center justify-center gap-1.5 text-xl font-bold tabular-nums">
        {icon}
        <span className="text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="whitespace-nowrap text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function SessionProgress({ session, resumed }: { session: SessionState; resumed: boolean }) {
  const roundNumber = Math.min(session.rounds.length, SESSION_LENGTH);
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          Round {roundNumber}
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            of {SESSION_LENGTH}
          </span>
        </p>
        {resumed && <p className="text-sm text-primary">Picked up where you left off</p>}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: SESSION_LENGTH }, (_, i) => {
          const result = session.rounds[i]?.result;
          return (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                result?.kind === "picked" && "bg-primary",
                result?.kind === "skipped" && "bg-gray-400 dark:bg-white/30",
                !result && i === roundNumber - 1 && "bg-primary/40",
                !result && i !== roundNumber - 1 && "bg-gray-200 dark:bg-white/10"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function CaptionChoice({
  side,
  shortcut,
  content,
  phase,
  result,
  onPick,
}: {
  side: Side;
  shortcut: string;
  content: string;
  phase: Phase;
  result: RoundResult | null;
  onPick: (side: Side) => void;
}) {
  const picked = result?.kind === "picked" ? result : null;
  const isWinner = picked?.side === side;
  const isLoser = picked !== null && picked.side !== side;
  const change = picked?.change != null ? Math.round(picked.change) : null;

  return (
    <button
      type="button"
      onClick={() => onPick(side)}
      disabled={phase !== "choosing"}
      aria-label={`Pick this caption: ${content}`}
      className={cn(
        showdownStyles.choiceBase,
        phase === "choosing" && showdownStyles.choiceIdle,
        phase === "saving" && "border-gray-200 dark:border-white/10",
        isWinner && "scale-[1.02] border-primary shadow-lg shadow-primary/20",
        isLoser && "border-gray-200 opacity-40 dark:border-white/10"
      )}
    >
      <p className="text-lg font-medium leading-relaxed text-gray-900 dark:text-white">{content}</p>
      <div
        className={cn(
          "mt-4 flex min-h-[20px] items-center justify-between",
          "text-xs text-muted-foreground"
        )}
      >
        <span className={showdownStyles.keyHint}>{shortcut}</span>
        {isWinner && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold tabular-nums text-green-500"
          >
            Your pick{change !== null ? ` · +${change}` : ""}
          </motion.span>
        )}
        {isLoser && change !== null && (
          <span className="text-sm font-bold tabular-nums text-primary">−{change}</span>
        )}
      </div>
      {isWinner && <span className={showdownStyles.pickBadge}>Funnier</span>}
    </button>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action: ReactNode }) {
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