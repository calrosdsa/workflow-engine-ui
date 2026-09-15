import { useTranslation } from '@/features/i18n/I18nProvider'

export function DividerConfigPanel() {
  const t = useTranslation()
  return <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_divider.no_config')}</p>
}
