// A searchable single-user combobox — the single-select counterpart to
// UserMultiSelect.tsx, built on the same shadcn Popover + cmdk Command
// pattern, and mirroring FormReferenceSelect.tsx's stale/broken-value
// handling (a stored user id whose user no longer exists — left, revoked,
// or simply not visible to this app's membership list — is preserved, not
// silently dropped, with a warning shown instead of a confusing blank).

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, AlertTriangle, Loader2, User } from 'lucide-react'
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
import { useTeamUsers } from '@/features/users/hooks'
import type { TeamUser } from '@/features/users/types'

function userLabel(u: TeamUser): string {
  const name = `${u.first_name} ${u.last_name}`.trim()
  return name || u.email
}

interface UserSelectProps {
  /** The currently selected user id (or empty string when none). */
  value: string
  /** Emits the selected user id, or '' when cleared. */
  onChange: (userId: string) => void
  /** Which app's members to list. Defaults to the active membership's app. */
  appId?: string
}

export function UserSelect({ value, onChange, appId: appIdProp }: UserSelectProps) {
  const t = useTranslation()
  const activeAppId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const appId = appIdProp ?? activeAppId
  const { data: users, isLoading } = useTeamUsers()
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => (users ?? []).filter((u) => !appId || u.memberships.some((m) => m.app_id === appId)),
    [users, appId],
  )

  // Selected user may not be in `options` (a different app's member, or a
  // stale/revoked id) — look it up against the full user list first so a
  // valid-but-out-of-scope id still displays a name, not just an id.
  const selected = useMemo(
    () => (users ?? []).find((u) => u.id === value),
    [users, value],
  )

  const isBroken = !!value && !isLoading && !selected

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-8 w-full justify-between gap-2 px-2.5 text-[13px] font-normal',
              !value && 'text-[hsl(var(--muted-foreground))]',
              isBroken && 'border-[hsl(var(--warning))]/40',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <User size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {isLoading && !selected
                  ? t('form_config.loading_users')
                  : selected
                    ? userLabel(selected)
                    : isBroken
                      ? t('form_config.unavailable_user')
                      : t('form_config.select_user')}
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
            <CommandInput placeholder={t('form_config.search_people_placeholder')} />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <Loader2 size={13} className="animate-spin" /> {t('form_config.loading_users')}
                </div>
              ) : (
                <>
                  <CommandEmpty>{t('form_config.no_users_found')}</CommandEmpty>
                  <CommandGroup>
                    {options.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`${userLabel(u)} ${u.email}`}
                        onSelect={() => {
                          onChange(u.id === value ? '' : u.id)
                          setOpen(false)
                        }}
                      >
                        <Check size={14} className={cn('shrink-0', u.id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{userLabel(u)}</span>
                          <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{u.email}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isBroken && (
        <p className="text-[10px] text-[hsl(var(--warning))] flex items-center gap-1">
          <AlertTriangle size={11} className="shrink-0" />
          {t('form_config.stale_user_notice_prefix')}<span className="font-mono">{value}</span>{t('form_config.stale_user_notice_suffix')}
        </p>
      )}
      {value && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={10} /> {t('common.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
