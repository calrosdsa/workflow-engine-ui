// Simplified Anthropic glyph — the brand's angular "A" notch, rendered as
// two mirrored trapezoids. currentColor.
export function AnthropicLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.4 4h-3.2L5 20h3.4l1.24-3.2h6.72L17.6 20H21L14.4 4Zm-3.6 9.8L13 8.4l2.2 5.4h-4.4Z"
        fill="currentColor"
      />
    </svg>
  )
}
