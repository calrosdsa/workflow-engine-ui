// Keeps one widget's render failure inside its own tile.
//
// Without it, a throw anywhere in a widget unwinds to the ROUTE's error
// boundary, and the whole page — navigation included — is replaced by
// "Something went wrong!". That is what a chart reading an aggregate group
// key that was not there did to every dashboard holding a stat tile: the
// stat tiles' bug took every other tile on the page down with them.
//
// The same stance the registry already takes for a widget type that no
// longer exists (WidgetTile's UnavailableWidget, RuntimeGrid's
// runtime_unavailable message): the dashboard keeps rendering, and only the
// broken tile says it cannot. It contains the failure without hiding it —
// the error still reaches the console, naming the widget it came from.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetDefinition, WidgetRendererProps } from './widget-contract'

interface WidgetErrorBoundaryProps {
  /** A caught failure is cleared when this changes. Callers pass what the
   *  widget renders from, serialized — its config, plus the dashboard
   *  parameter filter at runtime. An edited config is a different widget as
   *  far as an earlier failure is concerned, so an author who fixes one in
   *  the builder sees the tile render again without reloading. A string
   *  rather than the objects themselves, whose identity may change on every
   *  render and would retry the failing render each time. */
  resetKey: string
  /** Named in the console report, so the failure can be traced to a tile. */
  widgetId: string
  widgetType: string
  children: ReactNode
}

interface WidgetErrorBoundaryState {
  failed: boolean
  resetKey: string
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<WidgetErrorBoundaryState> {
    return { failed: true }
  }

  static getDerivedStateFromProps(
    props: WidgetErrorBoundaryProps,
    state: WidgetErrorBoundaryState,
  ): Partial<WidgetErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(
      `Dashboard widget "${this.props.widgetId}" (${this.props.widgetType}) failed to render:`,
      error,
      info.componentStack,
    )
  }

  render() {
    return this.state.failed ? <WidgetRenderError /> : this.props.children
  }
}

// Same icon and tone as a chart's own load_error, so a tile that failed to
// render and one whose data failed to load read as the same kind of problem.
function WidgetRenderError() {
  const t = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
      <AlertCircle size={18} style={{ color: 'hsl(var(--destructive))' }} />
      <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{t('builder.dashboard.widget_error')}</p>
    </div>
  )
}

/** A widget's Renderer with its config parsed in THIS component's render.
 *
 *  Written inline as `<def.Renderer config={def.parseConfig(...)} />`, the
 *  parse would run in the TILE's render — the one that places the boundary —
 *  and a throw there escapes the boundary entirely. parseConfig is contracted
 *  never to throw; this keeps a broken one from taking the page down anyway. */
export function WidgetBody({ def, instance, ...props }: { def: WidgetDefinition } & Omit<WidgetRendererProps<unknown>, 'config'>) {
  return <def.Renderer config={def.parseConfig(instance.config)} instance={instance} {...props} />
}
