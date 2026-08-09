import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { WidgetRendererProps } from '../../widget-contract'
import type { ImageWidgetConfig } from './schema'

// Adapts the 'image' case of CustomMenuRuntime.tsx's RuntimeComponent — same
// width class map, same "no src yet" gap the page-builder's own image
// component documents (URL-entry fallback, no upload backend).
const WIDTH_CLASSES: Record<ImageWidgetConfig['width'], string> = {
  full: 'w-full', half: 'w-1/2', third: 'w-1/3', auto: 'w-auto',
}

export function ImageRenderer({ config }: WidgetRendererProps<ImageWidgetConfig>) {
  // Tracks the src that actually failed, not just "did any error ever
  // happen" — so correcting the URL in the config panel and having it
  // load successfully clears the broken state instead of it sticking
  // forever from a stale failure on a previous URL.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!config.src) {
    return <div className="flex h-full items-center justify-center p-3 text-xs text-slate-400">No image URL set yet.</div>
  }
  if (failedSrc === config.src) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <ImageOff size={18} className="text-slate-300" />
        <p className="text-xs text-slate-400">Couldn't load this image.</p>
      </div>
    )
  }
  return (
    <div className="p-3">
      <img
        src={config.src}
        alt={config.alt}
        className={WIDTH_CLASSES[config.width]}
        onError={() => setFailedSrc(config.src)}
      />
    </div>
  )
}
