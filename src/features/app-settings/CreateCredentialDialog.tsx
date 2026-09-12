// A credential-creation dialog usable from anywhere a credential is
// referenced, not just the Application Settings page — e.g. inline from
// CredentialSelect's "Create new credential" entry, so a workflow author
// never has to leave the node they're configuring to set one up. When
// typeFilter narrows to exactly one credential type (the common case: a
// node's picker is already scoped to one type, like WhatsApp's
// "whatsapp_api"), the type picker is skipped entirely and the dialog
// creates that type directly — the credential's TYPE is already decided by
// which node opened it, the same way n8n's per-node "Create New Credential"
// dialog works.
//
// Layout deliberately echoes n8n's own credential editor chrome (name as a
// large heading, type as its caption, a Connection/Details tab rail) since
// that's a familiar shape for anyone coming from n8n — but only the parts
// that map to something real here. n8n's "Ask AI Assistant" and "Enterprise
// plan … external vaults" rows are n8n's own product surface, not
// something this app has, so they're not reproduced; a "Sharing" tab isn't
// either, since there is no credential-sharing feature to put behind it. A
// dead tab would be worse than no tab.
import { useEffect, useState } from 'react'
import { KeyRound, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useCredentialTypes, useUpsertCredential } from './hooks'
import { CredentialTypeFieldForm, credentialFieldsComplete } from './CredentialTypeFieldForm'
import type { CredentialTypeInfo } from './types'

interface CreateCredentialDialogProps {
  /** Restrict which types can be created — same shape and meaning as
   *  CredentialSelect's own typeFilter. Omit to let the author choose from
   *  every available type (the Application Settings "Add credential" case). */
  typeFilter?: string | string[]
  onClose: () => void
  /** Called with the new credential's name right after a successful save,
   *  before onClose — lets a caller (CredentialSelect) auto-select it. */
  onCreated?: (name: string) => void
}

type Tab = 'connection' | 'details'

export function CreateCredentialDialog({ typeFilter, onClose, onCreated }: CreateCredentialDialogProps) {
  const t = useTranslation()
  const { data } = useCredentialTypes()
  const upsertMutation = useUpsertCredential()

  const allowed = typeFilter === undefined ? undefined : Array.isArray(typeFilter) ? typeFilter : [typeFilter]
  const availableTypes = (data?.types ?? []).filter((ct) => !allowed || allowed.includes(ct.name))
  const singleType = availableTypes.length === 1 ? availableTypes[0] : undefined

  const [tab, setTab] = useState<Tab>('connection')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})

  // Pick a default once types have loaded: the single allowed type if
  // typeFilter narrowed to one, else "bearer" (the most common shape) if
  // it's in the available set, else whatever loaded first.
  useEffect(() => {
    if (type || availableTypes.length === 0) return
    setType(singleType?.name ?? availableTypes.find((ct) => ct.name === 'bearer')?.name ?? availableTypes[0].name)
  }, [type, availableTypes, singleType])

  const selected = availableTypes.find((ct) => ct.name === type)
  const canSave = name.trim() !== '' && !!selected && credentialFieldsComplete(selected.fields, values)

  const handleSave = async () => {
    if (!selected) return
    const value = Object.fromEntries(selected.fields.map((f) => [f.key, values[f.key] ?? '']))
    const trimmed = name.trim()
    await upsertMutation.mutateAsync({ name: trimmed, payload: { type, value } })
    onCreated?.(trimmed)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-2.5 space-y-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
            <KeyRound size={15} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <div className="min-w-0">
            <DialogTitle>{t('app_settings.credentials.add')}</DialogTitle>
            <DialogDescription>{t('app_settings.credentials.dialog_description')}</DialogDescription>
          </div>
        </DialogHeader>

        {/* Name (as the credential's own heading) + its type as a caption —
            mirrors n8n's "<credential name>" / "<credential type>" pair at
            the top of its own editor, since this row plays the same role:
            it's the one thing that identifies this credential everywhere
            else it's referenced from (CredentialSelect's list, config
            panels, etc). */}
        <div className="border-b border-[hsl(var(--border))] px-6 pb-4 pt-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('app_settings.credentials.name_placeholder')}
            className="w-full bg-transparent font-mono text-base font-semibold text-[hsl(var(--foreground))] outline-none placeholder:font-normal placeholder:text-[hsl(var(--muted-foreground))]"
          />
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {selected ? selected.display_name : t('app_settings.credentials.type_label')}
          </p>
        </div>

        <div className="flex">
          <div className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-[hsl(var(--border))] px-2 py-4">
            {(['connection', 'details'] as const).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                  tab === tb
                    ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/50 hover:text-[hsl(var(--foreground))]',
                )}
              >
                {tb === 'connection' ? t('app_settings.credentials.tab_connection') : t('app_settings.credentials.tab_details')}
              </button>
            ))}
          </div>

          <div className="min-h-[220px] flex-1 space-y-3 px-6 py-5">
            {tab === 'connection' ? (
              <>
                {!singleType && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                      {t('app_settings.credentials.type_label')}
                    </label>
                    <select
                      value={type}
                      onChange={(e) => { setType(e.target.value); setValues({}) }}
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))]"
                    >
                      {availableTypes.map((ct) => (
                        <option key={ct.name} value={ct.name}>{ct.display_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selected && (
                  <CredentialTypeFieldForm
                    fields={selected.fields}
                    values={values}
                    onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
                  />
                )}

                {upsertMutation.isError && (
                  <p className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />{t('app_settings.credentials.save_error')}</p>
                )}
              </>
            ) : (
              <CredentialDetailsTab selected={selected} t={t} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('app_settings.credentials.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave || upsertMutation.isPending}>
            {t('app_settings.credentials.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// CredentialDetailsTab shows real, derived information about the selected
// type — its origin (built in vs. package-provided) and its field schema —
// rather than n8n's "Sharing" tab, which has no equivalent here.
function CredentialDetailsTab({ selected, t }: { selected: CredentialTypeInfo | undefined; t: (key: string, vars?: Record<string, string | number>) => string }) {
  if (!selected) {
    return <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('app_settings.credentials.details_no_type')}</p>
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {t('app_settings.credentials.details_type_heading')}
        </label>
        <p className="text-sm text-[hsl(var(--foreground))]">{selected.display_name}</p>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          {selected.built_in ? t('app_settings.credentials.details_builtin') : t('app_settings.credentials.details_package')}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {t('app_settings.credentials.details_fields_heading')}
        </label>
        <ul className="space-y-1">
          {selected.fields.map((f) => (
            <li key={f.key} className="flex items-center gap-1.5 text-xs">
              <span className="font-mono text-[hsl(var(--foreground))]">{f.label}</span>
              {f.required && <span className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{t('app_settings.credentials.details_field_required')}</span>}
              {f.secret && <span className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{t('app_settings.credentials.details_field_secret')}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
