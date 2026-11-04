// Shared Tailwind class lists for Caption Showdown (kept here to keep JSX lines short).
const join = (...parts: string[]) => parts.join(" ");

export const showdownStyles = {
  pageHeader: join(
    "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"
  ),
  pageTitle: join(
    "flex items-center gap-3 text-3xl font-bold text-gray-900",
    "dark:text-white sm:text-4xl"
  ),
  panel: join(
    "rounded-xl border border-gray-200 bg-white",
    "dark:border-white/10 dark:bg-[#1a1a1a]"
  ),
  statBox: join(
    "rounded-lg border border-gray-200 bg-white px-4 py-2 text-center",
    "dark:border-white/10 dark:bg-[#1a1a1a]"
  ),
  primaryButton: join(
    "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5",
    "font-semibold text-primary-foreground hover:bg-primary/90"
  ),
  secondaryButton: join(
    "flex h-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/10",
    "px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
  ),
  skipButton: join(
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground",
    "transition-colors hover:bg-white/5 hover:text-gray-900 disabled:opacity-50",
    "dark:hover:text-white"
  ),
  imageFrame: "relative mx-auto h-[260px] w-full overflow-hidden rounded-xl sm:h-[380px]",
  choicesGrid: "mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch",
  choiceBase: join(
    "group relative flex min-h-[100px] w-full flex-col justify-between sm:min-h-[140px]",
    "rounded-xl border-2 p-5 text-left transition-all bg-white dark:bg-[#1a1a1a]"
  ),
  choiceIdle: join(
    "border-gray-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg",
    "dark:border-white/10 dark:hover:border-primary"
  ),
  eyebrow: join(
    "flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary"
  ),
  label: join(
    "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
  ),
  championText: join(
    "text-2xl font-bold leading-snug text-gray-900 dark:text-white sm:text-3xl"
  ),
  ratingSmall: "shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white",
  subtleLink: "mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline",
  placeNumber: "w-8 shrink-0 text-center text-lg font-bold tabular-nums text-muted-foreground",
  roundNumber: "w-5 shrink-0 text-center font-bold tabular-nums text-muted-foreground",
  versus: join(
    "flex items-center justify-center text-sm font-bold uppercase tracking-widest",
    "text-muted-foreground"
  ),
  keyHint: join(
    "hidden rounded border border-gray-300 px-1.5 py-0.5 font-mono",
    "dark:border-white/20 sm:inline-block"
  ),
  pickBadge: join(
    "absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5",
    "text-xs font-bold text-primary-foreground"
  ),
} as const;