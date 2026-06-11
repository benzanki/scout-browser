import type { SearchEngine } from '../../../shared/types'

export const HOME_URL = 'https://www.google.com'

// Internal sentinel for a tab showing Scout's dashboard (the new-tab page)
// rather than a live web page.
export const NEWTAB_URL = 'scout://newtab'

export const SEARCH_PREFIX: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q='
}

// Decide whether an omnibox input is a URL to visit or a query to search.
// Mirrors the behaviour of mainstream browsers' address bars.
export function normalizeInput(input: string, engine: SearchEngine = 'google'): string {
  const t = input.trim()
  if (!t) return ''

  // Explicit schemes pass straight through.
  if (/^(https?|file|about|data|chrome):/i.test(t)) return t

  // localhost (optionally with port/path).
  if (/^localhost([:/]|$)/i.test(t)) return 'http://' + t

  // Bare IPv4, optionally with port/path.
  if (/^\d{1,3}(\.\d{1,3}){3}([:/]|$)/.test(t)) return 'http://' + t

  // Looks like a domain: has a dot, no spaces, and a plausible TLD-ish tail.
  const looksLikeDomain = !/\s/.test(t) && /^[^\s]+\.[^\s.]{2,}/.test(t)
  if (looksLikeDomain) return 'https://' + t

  // Otherwise treat it as a search query.
  return SEARCH_PREFIX[engine] + encodeURIComponent(t)
}

/** Strip scheme/www for a compact display in the address bar. */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

/** Best-effort hostname for grouping/labels. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
