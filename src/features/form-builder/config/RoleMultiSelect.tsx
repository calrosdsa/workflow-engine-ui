// A searchable multi-select combobox for picking specific roles, scoped to
// the active app. Same shadcn Popover + cmdk Command pattern as
// UserMultiSelect.tsx, backed by useRoles instead of useTeamUsers.

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useAuthStore } from '@/stores/auth'
import { useRoles } from '@/features/roles/hooks'

interface RoleMultiSelectProps {
  /** Selected role ids. */
  value: string[]
  onChange: (roleIds: string[]) => void
  /** Which app's roles to list. Defaults to the active membership's app. */
  appId?: string
}

export function RoleMultiSelect({ value, onChange, appId: appIdProp }: RoleMultiSelectProps) {
  const t = useTranslation()
  const activeAppId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const appId = appIdProp ?? activeAppId
  const { data: roles, isLoading } = useRoles(appId)
  const [open, setOpen] = useState(false)

  const options = useMemo(() => roles ?? [], [roles])

  const selected = useMemo(
    () => options.filter((r) => value.includes(r.id)),
    [options, value],
  )

  const toggle = (roleId: string) => {
    onChange(value.includes(roleId) ? value.filter((id) => id !== roleId) : [...value, roleId])
  }

  if (!appId) {
    return (
      <Button variant="outline" disabled className="h-8 w-full justify-between gap-2 px-2.5 text-[13px] font-normal text-[hsl(var(--muted-foreground))]">
        {t('form_config.no_active_app')}
      </Button>
    )
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('h-8 w-full justify-between gap-2 px-2.5 text-[13px] font-normal', selected.length === 0 && 'text-[hsl(var(--muted-foreground))]')}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <ShieldCheck size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {isLoading
                  ? t('form_config.loading_roles')
                  : selected.length === 0
                    ? t('form_config.select_role')
                    : t('form_config.n_selected', { count: selected.length })}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder={t('form_config.search_roles_placeholder')} />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <Loader2 size={13} className="animate-spin" /> {t('form_config.loading_roles')}
                </div>
              ) : (
                <>
                  <CommandEmpty>{t('form_config.no_roles_found')}</CommandEmpty>
                  <CommandGroup>
                    {options.map((r) => {
                      const isSelected = value.includes(r.id)
                      return (
                        <CommandItem
                          key={r.id}
                          value={r.name}
                          onSelect={() => toggle(r.id)}
                        >
                          <Check size={14} className={cn('shrink-0', isSelected ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                          <span className="truncate">{r.name}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-1 pl-2 pr-1 text-[11px] text-[hsl(var(--muted-foreground))]"
            >
              {r.name}
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                title={t('common.remove')}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
