import Link from 'next/link'
import { ArrowDown, ArrowRight, ImagePlus, Sparkles, ThumbsUp } from 'lucide-react'

import { Top100CaptionImage } from '@/components/top-100-caption-image'

type FeaturedCaption = {
  id: string
  content: string
  image_url: string
  like_count: number
}

interface HomeIntroProps {
  /** The current #1 caption, shown as a live example. */
  featured: FeaturedCaption | null
  featuredLabel: string
  isAuthenticated: boolean
}

const STEPS = [
  {
    icon: ImagePlus,
    title: 'Pick a photo',
    body: 'Upload your own or choose one from the shared library.',
  },
  {
    icon: Sparkles,
    title: 'Get captions',
    body: 'Crackd writes captions for it in different humor styles.',
  },
  {
    icon: ThumbsUp,
    title: 'Vote for the funniest',
    body: 'Upvote, save and share. The best rise to the Top 100.',
  },
]

/**
 * Landing intro for the homepage: says what Crackd is, how it works, and
 * shows the current #1 caption as a real example. Uses existing pages only.
 */
export function HomeIntro({ featured, featuredLabel, isAuthenticated }: HomeIntroProps) {
  return (
    <section
      id="home-intro"
      aria-labelledby="home-intro-title"
      className={`mb-10 grid gap-8 rounded-2xl bg-gray-50 p-6 dark:bg-neutral-900/70 sm:p-10
                  lg:items-center ${
                    featured ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : ''
                  }`}
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          AI captions for your photos
        </p>
        <h1
          id="home-intro-title"
          className="mt-3 text-4xl font-bold leading-tight text-gray-900 dark:text-white
                     sm:text-5xl"
        >
          Where your pictures get a sense of humor.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Give Crackd a photo and it writes funny captions for it. Everyone votes, and the funniest
          captions make the Top 100.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3
                       text-base font-bold text-primary-foreground shadow-sm
                       transition-colors hover:bg-primary/90"
          >
            Caption a photo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#top-captions"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300
                       px-6 py-3 text-base font-semibold text-gray-900 transition-colors
                       hover:border-primary hover:text-primary dark:border-white/20
                       dark:text-white"
          >
            See the funniest
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link
            href="/about"
            className="px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            About Crackd
          </Link>
        </div>
        {!isAuthenticated && (
          <p className="mt-3 text-sm text-muted-foreground">
            Free to use.{' '}
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>{' '}
            to vote and save favorites.
          </p>
        )}

        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                           bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {index + 1}. {title}
                </p>
                <p className="text-sm leading-snug text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {featured && (
        <figure
          className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg
                     ring-1 ring-gray-200 dark:bg-[#1a1a1a] dark:ring-white/10"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {featuredLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              <ThumbsUp className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {featured.like_count}
            </span>
          </div>
          <figcaption
            className="px-4 pb-3 text-lg font-medium leading-snug text-gray-900
                       dark:text-white"
          >
            {featured.content}
          </figcaption>
          <div className="relative h-56">
            <Top100CaptionImage src={featured.image_url} captionId={featured.id} />
          </div>
        </figure>
      )}
    </section>
  )
}
