import { useState } from 'react'
import { hostnameOf } from '../lib/url'

interface Props {
  label: string
  url: string
  color?: string
  /** Rendered width/height in px. */
  size?: number
}

// Real, full-colour site favicon for an app / saved link. icon.horse returns the
// true site icon (e.g. Gmail's multicolour "M"); Google/DuckDuckGo normalise
// *.google.com to the grey "G", so they're only fallbacks. Last resort is a
// coloured letter avatar.
export default function AppIcon({ label, url, color, size = 28 }: Props): JSX.Element {
  const host = hostnameOf(url).replace(/^www\./, '')
  const sources = [
    `https://icon.horse/icon/${host}`,
    `https://www.google.com/s2/favicons?sz=128&domain=${host}`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`
  ]
  const [idx, setIdx] = useState(0)
  const dim = { width: size, height: size }

  if (idx >= sources.length) {
    return (
      <span
        style={{ ...dim, fontSize: Math.round(size * 0.42), backgroundColor: color ?? '#3a4256' }}
        className="flex shrink-0 items-center justify-center rounded-lg font-semibold text-white"
      >
        {label.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={sources[idx]}
      alt={label}
      onError={() => setIdx((i) => i + 1)}
      draggable={false}
      style={dim}
      className="shrink-0 rounded-md object-contain"
    />
  )
}
