import { MapPin, Camera, Bell, Shield, type LucideIcon } from 'lucide-react'

// The sensitive permissions Scout prompts for, in display order.
export const MANAGED_PERMISSIONS = ['geolocation', 'media', 'notifications'] as const

export function permLabel(permission: string, mediaTypes?: string[]): string {
  if (permission === 'geolocation') return 'location'
  if (permission === 'notifications') return 'notifications'
  if (permission === 'media') {
    const t = mediaTypes ?? []
    if (t.includes('video') && t.includes('audio')) return 'camera and microphone'
    if (t.includes('video')) return 'camera'
    if (t.includes('audio')) return 'microphone'
    return 'camera & microphone'
  }
  return permission
}

/** Title-case label for the site-permissions menu (no media-type nuance). */
export function permTitle(permission: string): string {
  if (permission === 'geolocation') return 'Location'
  if (permission === 'notifications') return 'Notifications'
  if (permission === 'media') return 'Camera & microphone'
  return permission
}

export function permIcon(permission: string): LucideIcon {
  if (permission === 'geolocation') return MapPin
  if (permission === 'notifications') return Bell
  if (permission === 'media') return Camera
  return Shield
}
