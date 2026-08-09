import type { WidgetRendererProps } from '../../widget-contract'
import type { SpacerWidgetConfig } from './schema'

export function SpacerRenderer({ config, mode }: WidgetRendererProps<SpacerWidgetConfig>) {
  // In the builder, an invisible spacer is impossible to select/resize — show
  // a faint placeholder outline so it stays clickable, matching how an empty
  // canvas droppable gets a dashed border rather than truly disappearing.
  return (
    <div
      style={{ height: config.height }}
      className={mode === 'builder' ? 'w-full rounded border border-dashed border-slate-200' : 'w-full'}
      aria-hidden
    />
  )
}
