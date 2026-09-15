// Shared by entry/exit/merge/loop_end — the four node types with nothing to
// configure. Each is registered as a type's `form` in node-registry.ts, so
// NodeConfigPanel.tsx's dispatch stays unconditional (no special-casing for
// "this type has no config") — both accept (and ignore) the standard
// NodeFormProps so they satisfy the same ComponentType<NodeFormProps> shape
// every other node type's form does.
import { useI18n } from '@/features/i18n/I18nProvider'

function Message({ children }: { children: string }) {
  return <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">{children}</p>
}

export function NoAdditionalConfig() {
  const { t } = useI18n()
  return <Message>{t('workflows.node_forms.no_additional_config')}</Message>
}

export function LoopEndNoConfig() {
  const { t } = useI18n()
  return (
    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
      {t('workflows.node_forms.loop_end_help')}<br />{t('workflows.node_forms.no_config')}
    </p>
  )
}
