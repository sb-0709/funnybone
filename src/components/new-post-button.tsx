'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Floating "New Post" button. It hides while the homepage intro (which has its
 * own "Caption a photo" button) or the site footer is on screen, so it never
 * covers the footer links.
 */
export function NewPostButton() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const targets = [
      document.getElementById('home-intro'),
      document.querySelector('footer'),
    ].filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      })
      setHidden(visible.size > 0)
    })
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transition-all duration-300
                  sm:bottom-8 ${hidden ? 'pointer-events-none translate-y-6 opacity-0' : ''}`}
      aria-hidden={hidden}
    >
      <a
        href="/new"
        tabIndex={hidden ? -1 : 0}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6
                   text-lg font-bold text-primary-foreground shadow-lg transition-colors
                   duration-200 select-none hover:bg-primary/90"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        New Post
      </a>
    </div>
  )
}
