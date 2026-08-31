// Report block plugin contract (3.3 §J, FR-J1-001/002) — structural clone of
// features/dashboard/widget-contract.ts's WidgetDefinition<TConfig>, adapted
// for design-time-only editing (a report block has no runtime/live-render
// mode the way a dashboard widget does — generation happens server-side,
// internal/reports, not by re-running this component against live data).
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ReportBlock } from './types'

export interface ReportBlockRendererProps<TConfig> {
  config: TConfig
  instance: ReportBlock
}

export interface ReportBlockConfigPanelProps<TConfig> {
  config: TConfig
  onChange: (config: TConfig) => void
}

export interface ReportBlockDefinition<TConfig = unknown> {
  type: string
  label: string
  icon: LucideIcon
  description: string
  /** Parses/heals a possibly-stale or malformed config blob — must never throw. */
  parseConfig: (raw: unknown) => TConfig
  createDefaultConfig: () => TConfig
  defaultLayout: { col_span: number; row_span: number }
  /** A lightweight canvas preview — report blocks resolve real data only at
   *  generation time (server-side), so there is no live Renderer the way a
   *  dashboard widget has; this is the block's only visual form in the
   *  builder. */
  Preview: ComponentType<ReportBlockRendererProps<TConfig>>
  ConfigPanel: ComponentType<ReportBlockConfigPanelProps<TConfig>>
}
