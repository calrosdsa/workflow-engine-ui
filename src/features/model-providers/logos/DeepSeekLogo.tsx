// Simplified DeepSeek glyph — a stylized whale silhouette (the real brand
// mark), simplified to a rounded body + tail fin. Fixed brand-blue fill,
// not currentColor — DeepSeek's mark is always rendered in its own blue.
export function DeepSeekLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.5 9.5c-.6-1.8-2.1-3.1-3.9-3.6.3-.7.3-1.5 0-2.3-.2.5-.6.9-1.1 1.1-.6.3-1.3.3-1.9 0a4.9 4.9 0 0 0-3.9-.4C7.7 4.9 6.2 6.6 6 8.6c-1.7.3-3.1 1.5-3.6 3.2-.6 1.9.1 3.9 1.6 5.1.3 1.4 1.2 2.6 2.5 3.3 1.6.9 3.6.8 5.1-.2.9.5 2 .7 3 .5 1.9-.4 3.4-1.9 3.8-3.8.2-.1.5-.2.7-.4 1.4-1 2-2.8 1.4-4.4-.2-.6-.6-1.1-1-1.5.2-.3.3-.6.4-.9.3-.6.3-1.2.1-1.8-.2-.7-.7-1.3-1.4-1.7-.2-.1-.5-.2-.7-.2Z"
        fill="#4D6BFE"
      />
      <circle cx="9.5" cy="10.5" r="1" fill="white" />
    </svg>
  )
}
