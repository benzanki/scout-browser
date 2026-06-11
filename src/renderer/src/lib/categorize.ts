import type { LibraryCategory } from '../../../shared/types'
import { hostnameOf } from './url'

interface Rule {
  category: LibraryCategory
  hosts: string[]
  keywords: string[]
}

// Smart auto-tagging for the Visual Canvas, geared to everyday browsing. Host
// matches win over keyword matches; first matching rule decides the category.
const RULES: Rule[] = [
  {
    category: 'Social',
    hosts: ['facebook', 'instagram', 'twitter', 'x.com', 'tiktok', 'reddit', 'linkedin', 'pinterest', 'snapchat', 'threads', 'bsky', 'bluesky', 'tumblr', 'whatsapp', 'discord'],
    keywords: ['social', 'profile', 'feed', 'follow', 'friends']
  },
  {
    category: 'Shopping',
    hosts: ['amazon', 'ebay', 'etsy', 'walmart', 'target', 'aliexpress', 'bestbuy', 'ikea', 'asos', 'wayfair', 'shopify', 'costco', 'alibaba', 'argos'],
    keywords: ['shop', 'store', 'cart', 'buy', 'price', 'checkout', 'deal', 'order', 'product']
  },
  {
    category: 'Entertainment',
    hosts: ['youtube', 'youtu.be', 'netflix', 'spotify', 'disney', 'hulu', 'twitch', 'primevideo', 'hbomax', 'max.com', 'soundcloud', 'vimeo', 'imdb', 'crunchyroll', 'steam', 'epicgames'],
    keywords: ['video', 'watch', 'music', 'stream', 'movie', 'episode', 'podcast', 'game', 'play', 'tv']
  },
  {
    category: 'News',
    hosts: ['bbc', 'cnn', 'nytimes', 'theguardian', 'reuters', 'news.google', 'washingtonpost', 'foxnews', 'apnews', 'npr', 'aljazeera', 'bloomberg', 'news.yahoo', 'dailymail', 'telegraph', 'sky.com/news'],
    keywords: ['news', 'breaking', 'headlines', 'politics', 'weather']
  },
  {
    category: 'Email',
    hosts: ['mail.google', 'gmail', 'outlook', 'mail.yahoo', 'proton', 'protonmail', 'icloud.com/mail', 'mail.com'],
    keywords: ['mail', 'inbox', 'email', 'webmail']
  },
  {
    category: 'Work',
    hosts: ['docs.google', 'drive.google', 'sheets.google', 'slides.google', 'calendar.google', 'office', 'microsoft365', 'office365', 'onedrive', 'notion', 'slack', 'zoom', 'trello', 'asana', 'dropbox', 'teams.microsoft', 'monday.com', 'clickup', 'atlassian'],
    keywords: ['docs', 'sheets', 'slides', 'calendar', 'meeting', 'project', 'workspace', 'dashboard', 'drive']
  },
  {
    category: 'Travel',
    hosts: ['booking', 'airbnb', 'expedia', 'tripadvisor', 'kayak', 'skyscanner', 'hotels.com', 'agoda', 'trivago', 'ryanair', 'easyjet', 'britishairways', 'united.com', 'airline'],
    keywords: ['travel', 'flight', 'hotel', 'booking', 'trip', 'vacation', 'flights', 'holiday']
  },
  {
    category: 'Finance',
    hosts: ['paypal', 'chase', 'wellsfargo', 'bankofamerica', 'coinbase', 'venmo', 'fidelity', 'robinhood', 'hsbc', 'barclays', 'monzo', 'revolut', 'stripe', 'natwest', 'lloyds'],
    keywords: ['bank', 'banking', 'finance', 'pay', 'invoice', 'invest', 'wallet', 'billing', 'crypto']
  }
]

export function categorize(
  url: string,
  title = '',
  description = ''
): { category: LibraryCategory; tags: string[] } {
  const host = hostnameOf(url)
  const haystack = `${url} ${title} ${description}`.toLowerCase()

  for (const rule of RULES) {
    if (rule.hosts.some((h) => host.includes(h))) {
      return { category: rule.category, tags: [rule.category, host] }
    }
  }
  for (const rule of RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) {
      return { category: rule.category, tags: [rule.category, host] }
    }
  }
  return { category: 'Other', tags: ['Other', host] }
}

interface CatStyle {
  text: string
  bg: string
  dot: string
}

// Built-in categories, in the order they appear as filter chips.
export const PRESET_CATEGORIES: LibraryCategory[] = [
  'Social',
  'Shopping',
  'Entertainment',
  'News',
  'Email',
  'Work',
  'Travel',
  'Finance',
  'Other'
]

// Tailwind classes per built-in category, reused by the grid cards and chips.
const CATEGORY_STYLES: Record<LibraryCategory, CatStyle> = {
  Social: { text: 'text-scout-accent', bg: 'bg-scout-accent-soft', dot: 'bg-scout-accent' },
  Shopping: { text: 'text-scout-green', bg: 'bg-scout-green/10', dot: 'bg-scout-green' },
  Entertainment: { text: 'text-scout-pink', bg: 'bg-scout-pink/10', dot: 'bg-scout-pink' },
  News: { text: 'text-scout-red', bg: 'bg-scout-red/10', dot: 'bg-scout-red' },
  Email: { text: 'text-scout-orange', bg: 'bg-scout-orange/10', dot: 'bg-scout-orange' },
  Work: { text: 'text-scout-purple', bg: 'bg-scout-purple/10', dot: 'bg-scout-purple' },
  Travel: { text: 'text-scout-teal', bg: 'bg-scout-teal/10', dot: 'bg-scout-teal' },
  Finance: { text: 'text-scout-amber', bg: 'bg-scout-amber/10', dot: 'bg-scout-amber' },
  Other: { text: 'text-scout-muted', bg: 'bg-scout-surface-2', dot: 'bg-scout-faint' }
}

// Deterministic palette for user-defined categories (cycled by name hash).
const CUSTOM_PALETTE: CatStyle[] = [
  { text: 'text-scout-green', bg: 'bg-scout-green/10', dot: 'bg-scout-green' },
  { text: 'text-scout-pink', bg: 'bg-scout-pink/10', dot: 'bg-scout-pink' },
  { text: 'text-scout-amber', bg: 'bg-scout-amber/10', dot: 'bg-scout-amber' },
  { text: 'text-scout-purple', bg: 'bg-scout-purple/10', dot: 'bg-scout-purple' },
  { text: 'text-scout-accent', bg: 'bg-scout-accent-soft', dot: 'bg-scout-accent' }
]

/** Resolve a style for any category name — built-in or custom. */
export function categoryStyle(category: string): CatStyle {
  if (category in CATEGORY_STYLES) return CATEGORY_STYLES[category as LibraryCategory]
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0
  return CUSTOM_PALETTE[Math.abs(hash) % CUSTOM_PALETTE.length]
}
