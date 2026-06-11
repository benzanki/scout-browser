import { app, shell } from 'electron'
import { execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { cpus, totalmem, freemem } from 'os'
import type { SystemStats } from '../shared/types'

/** Whether Scout is set to launch when the user signs in. */
export function getOpenAtLogin(): boolean {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
}

/** Toggle launch-on-startup. */
export function setOpenAtLogin(enabled: boolean): void {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled })
  } catch {
    /* unsupported platform */
  }
}

/** Open a protocol URL (steam://, etc.) or external resource. */
export function launchExternal(target: string): void {
  void shell.openExternal(target)
}

/** Launch the native Discord desktop app (for Krisp / global hotkeys). */
export function launchDiscord(): boolean {
  const base = join(process.env.LOCALAPPDATA ?? '', 'Discord')
  try {
    if (!existsSync(base)) return false
    // Discord installs into versioned app-<ver> folders; Update.exe is the launcher.
    const updater = join(base, 'Update.exe')
    if (existsSync(updater)) {
      execFile(updater, ['--processStart', 'Discord.exe'], { windowsHide: true })
      return true
    }
    // Fall back to the newest app-* folder's Discord.exe.
    const appDir = readdirSync(base)
      .filter((d) => d.startsWith('app-'))
      .sort()
      .pop()
    if (appDir) {
      const exe = join(base, appDir, 'Discord.exe')
      if (existsSync(exe)) {
        execFile(exe, { windowsHide: true })
        return true
      }
    }
  } catch {
    /* ignore */
  }
  return false
}

// CPU usage needs two samples to diff; remember the previous one.
let prevCpu: { idle: number; total: number } | null = null

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    for (const t of Object.values(cpu.times)) total += t
    idle += cpu.times.idle
  }
  return { idle, total }
}

/** Sample CPU + memory for the dashboard widget. */
export function getSystemStats(): SystemStats {
  const snap = cpuSnapshot()
  let cpu = 0
  if (prevCpu) {
    const idleDelta = snap.idle - prevCpu.idle
    const totalDelta = snap.total - prevCpu.total
    cpu = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0
  }
  prevCpu = snap
  const memTotal = totalmem()
  const memUsed = memTotal - freemem()
  return {
    cpu: Math.round(cpu),
    memUsed,
    memTotal,
    memPercent: Math.round((memUsed / memTotal) * 100)
  }
}
