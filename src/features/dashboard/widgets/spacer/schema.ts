export interface SpacerWidgetConfig {
  height: number
}

export function parseSpacerConfig(raw: unknown): SpacerWidgetConfig {
  if (raw && typeof raw === 'object' && typeof (raw as Partial<SpacerWidgetConfig>).height === 'number') {
    return { height: (raw as SpacerWidgetConfig).height }
  }
  return createDefaultSpacerConfig()
}

export function createDefaultSpacerConfig(): SpacerWidgetConfig {
  return { height: 24 }
}
