import { ipcRenderer } from 'electron'

// Preload injected into every embedded <webview>. Implements Feature 3's
// "Inspect Mode": highlight elements on hover, and on click extract the element
// as clean Markdown and send it back to the host renderer.

// ---------- HTML → Markdown ----------

function cleanInline(el: Element): string {
  // Render anchors as markdown links; otherwise fall back to text.
  let out = ''
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
    } else if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase()
      if (tag === 'a' && node.getAttribute('href')) {
        out += `[${node.textContent?.trim() ?? ''}](${node.getAttribute('href')})`
      } else if (tag === 'br') {
        out += '\n'
      } else if (tag === 'strong' || tag === 'b') {
        out += `**${node.textContent?.trim() ?? ''}**`
      } else if (tag === 'em' || tag === 'i') {
        out += `*${node.textContent?.trim() ?? ''}*`
      } else if (tag === 'code') {
        out += `\`${node.textContent?.trim() ?? ''}\``
      } else {
        out += cleanInline(node)
      }
    }
  })
  return out.replace(/[ \t]+/g, ' ').trim()
}

function tableToMd(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const matrix = rows.map((r) =>
    Array.from(r.querySelectorAll('th,td')).map((c) =>
      (c.textContent ?? '').replace(/\s+/g, ' ').trim()
    )
  )
  const cols = Math.max(...matrix.map((r) => r.length))
  const pad = (r: string[]): string[] =>
    Array.from({ length: cols }, (_, i) => r[i] ?? '')
  const header = pad(matrix[0])
  const sep = Array.from({ length: cols }, () => '---')
  const bodyRows = matrix.slice(1).map(pad)
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`
  return [line(header), line(sep), ...bodyRows.map(line)].join('\n')
}

function listToMd(list: HTMLElement, depth = 0): string {
  const ordered = list.tagName.toLowerCase() === 'ol'
  const indent = '  '.repeat(depth)
  const items = Array.from(list.children).filter(
    (c) => c.tagName.toLowerCase() === 'li'
  )
  return items
    .map((li, i) => {
      const nested = li.querySelector(':scope > ul, :scope > ol') as HTMLElement | null
      // Text of the li excluding any nested list.
      const clone = li.cloneNode(true) as HTMLElement
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove())
      const marker = ordered ? `${i + 1}.` : '-'
      let out = `${indent}${marker} ${cleanInline(clone)}`
      if (nested) out += '\n' + listToMd(nested, depth + 1)
      return out
    })
    .join('\n')
}

function elementToMarkdown(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'table') return tableToMd(el as HTMLTableElement)
  if (tag === 'ul' || tag === 'ol') return listToMd(el)
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1])
    return `${'#'.repeat(level)} ${el.textContent?.trim() ?? ''}`
  }
  if (tag === 'pre' || tag === 'code') {
    return '```\n' + (el.textContent ?? '').replace(/\s+$/, '') + '\n```'
  }
  // A container with a single table/list inside: extract that.
  const inner = el.querySelector('table, ul, ol')
  if (inner && el.children.length <= 2) return elementToMarkdown(inner as HTMLElement)

  // Generic block: split visible text into paragraphs.
  const text = (el as HTMLElement).innerText ?? el.textContent ?? ''
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n')
}

// ---------- Inspect mode ----------

let active = false
let overlay: HTMLDivElement | null = null
let hovered: HTMLElement | null = null

function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay
  overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #5b8cff;' +
    'background:rgba(91,140,255,.12);border-radius:3px;transition:all .04s ease;display:none;'
  const label = document.createElement('div')
  label.style.cssText =
    'position:absolute;top:-20px;left:-2px;font:600 11px system-ui,sans-serif;' +
    'background:#5b8cff;color:#fff;padding:1px 6px;border-radius:3px;white-space:nowrap;'
  label.className = 'scout-inspect-label'
  overlay.appendChild(label)
  document.documentElement.appendChild(overlay)
  return overlay
}

function moveOverlay(el: HTMLElement): void {
  const o = ensureOverlay()
  const r = el.getBoundingClientRect()
  o.style.display = 'block'
  o.style.left = `${r.left}px`
  o.style.top = `${r.top}px`
  o.style.width = `${r.width}px`
  o.style.height = `${r.height}px`
  const label = o.querySelector('.scout-inspect-label') as HTMLElement
  label.textContent = `<${el.tagName.toLowerCase()}> — click to extract`
}

function onMove(e: MouseEvent): void {
  if (!active) return
  const el = e.target as HTMLElement
  if (!el || el === overlay) return
  hovered = el
  moveOverlay(el)
}

function onClick(e: MouseEvent): void {
  if (!active) return
  e.preventDefault()
  e.stopPropagation()
  const el = (hovered ?? (e.target as HTMLElement)) as HTMLElement
  const md = elementToMarkdown(el).trim()
  if (md) ipcRenderer.sendToHost('scout:scraped', md)
  setActive(false)
}

function onKey(e: KeyboardEvent): void {
  if (active && e.key === 'Escape') setActive(false)
}

function setActive(value: boolean): void {
  active = value
  if (value) {
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)
    document.body && (document.body.style.cursor = 'crosshair')
  } else {
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKey, true)
    if (overlay) overlay.style.display = 'none'
    if (document.body) document.body.style.cursor = ''
    hovered = null
  }
  ipcRenderer.sendToHost('scout:inspect-state', active)
}

// Host renderer toggles inspect mode via webview.send('scout:inspect', bool).
ipcRenderer.on('scout:inspect', (_e, enabled: boolean) => setActive(!!enabled))

// Relay mic/camera capture state to the host (a host-injected main-world hook
// dispatches these DOM events; distinct names avoid passing data across isolated
// worlds). Lets the Hub keep call/recording panels alive even in silence.
document.addEventListener('scout:capture-on', () => ipcRenderer.sendToHost('scout:capture', true))
document.addEventListener('scout:capture-off', () => ipcRenderer.sendToHost('scout:capture', false))
