// Simplified Gemini "sparkle" glyph — a four-pointed star built from two
// overlapping teardrops, filled with the brand's blue-to-red gradient
// (fixed, not currentColor — this mark's gradient IS its identity).
export function GeminiLogo({ size = 20 }: { size?: number }) {
  const gradId = 'gemini-grad'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4C8DF6" />
          <stop offset="50%" stopColor="#B15CF6" />
          <stop offset="100%" stopColor="#F65C5C" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c0 5.52-4.48 10-10 10 5.52 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  )
}
