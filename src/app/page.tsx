import PopularCaptionsPage from '@/components/popular-captions-page'

// The homepage switches the time filter in place (no filter links), so the
// intro stays on screen when you pick Past Month, Past Year or All Time.
export default function Home() {
  return <PopularCaptionsPage showIntro />
}
