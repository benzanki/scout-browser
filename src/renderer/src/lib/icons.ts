import {
  Code2,
  FlaskConical,
  Palette,
  Coffee,
  Layers,
  Briefcase,
  BookOpen,
  Globe,
  type LucideIcon
} from 'lucide-react'

// Workspaces persist their icon as a string name; resolve it to a component.
const MAP: Record<string, LucideIcon> = {
  Code2,
  FlaskConical,
  Palette,
  Coffee,
  Layers,
  Briefcase,
  BookOpen,
  Globe
}

export function workspaceIcon(name: string): LucideIcon {
  return MAP[name] ?? Layers
}

/** Cyclable accent colors for newly created workspaces. */
export const WORKSPACE_COLORS = [
  'text-scout-accent',
  'text-scout-green',
  'text-scout-pink',
  'text-scout-amber',
  'text-scout-purple'
]

// Map a workspace's stored text-color class to the matching dot/ring classes.
// Listed literally so Tailwind generates them.
const DOT: Record<string, string> = {
  'text-scout-accent': 'bg-scout-accent',
  'text-scout-green': 'bg-scout-green',
  'text-scout-pink': 'bg-scout-pink',
  'text-scout-amber': 'bg-scout-amber',
  'text-scout-purple': 'bg-scout-purple'
}
export function dotClass(color: string): string {
  return DOT[color] ?? 'bg-scout-faint'
}
