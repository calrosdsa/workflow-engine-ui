import type { WidgetRendererProps } from '../../widget-contract'

export function DividerRenderer(_props: WidgetRendererProps<Record<string, never>>) {
  return (
    <div className="flex h-full items-center p-3">
      <hr className="w-full" style={{ borderColor: 'hsl(var(--border))' }} />
    </div>
  )
}
