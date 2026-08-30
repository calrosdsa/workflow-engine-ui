// Simplified Voyage glyph — a compass/paper-airplane wedge, evoking
// "voyage" without reproducing the real wordmark. currentColor.
export function VoyageLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12 20 4l-6 8 6 8-17-8Z" fill="currentColor" />
      <path d="M3 12 14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
