// Tiered human-readable duration formatting (FR-C5-007, DUR-01): milliseconds
// under a second, seconds under a minute, minutes (and hours) beyond that.
// Shared by the Executions sidebar list and the canvas overlay so the same
// input always renders identically in both places.
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`

  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${seconds}s`
}

// Duration between two ISO timestamps, or between start and "now" if the run
// hasn't finished yet. Returns null when there's nothing to compute from.
export function computeDurationMs(startedAt?: string, finishedAt?: string): number | null {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return end - start
}
