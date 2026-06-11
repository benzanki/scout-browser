import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

// A compact dark theme tuned to Scout's palette, plus markdown-aware syntax
// highlighting so notes read like a proper editor rather than a textarea.
const base = EditorView.theme(
  {
    '&': {
      color: '#e6e9ef',
      backgroundColor: 'transparent',
      fontSize: '13px',
      height: '100%'
    },
    '.cm-content': {
      fontFamily:
        "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      padding: '14px 16px',
      lineHeight: '1.65',
      caretColor: '#5b8cff'
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#5b8cff' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: '#1c2740' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-placeholder': { color: '#5b647a' },
    '.cm-scroller': { overflow: 'auto' }
  },
  { dark: true }
)

const highlight = HighlightStyle.define([
  { tag: t.heading, color: '#e6e9ef', fontWeight: '700' },
  { tag: t.heading1, color: '#ffffff', fontWeight: '700', fontSize: '1.25em' },
  { tag: t.heading2, color: '#f0f2f6', fontWeight: '700', fontSize: '1.12em' },
  { tag: t.strong, color: '#e6e9ef', fontWeight: '700' },
  { tag: t.emphasis, color: '#c7ccd6', fontStyle: 'italic' },
  { tag: t.link, color: '#5b8cff', textDecoration: 'underline' },
  { tag: t.url, color: '#43c59e' },
  { tag: [t.monospace], color: '#e0a458' },
  { tag: t.list, color: '#9d7bea' },
  { tag: t.quote, color: '#8b94a7', fontStyle: 'italic' },
  { tag: [t.contentSeparator, t.processingInstruction], color: '#5b647a' },
  { tag: t.strikethrough, color: '#8b94a7', textDecoration: 'line-through' }
])

export const scoutCmTheme: Extension = [base, syntaxHighlighting(highlight)]
