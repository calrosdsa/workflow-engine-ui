// A searchable multi-select combobox for picking specific people (users),
// scoped to the active app's membership. Built on the same shadcn Popover +
// cmdk Command pattern as FormReferenceSelect.tsx, but toggles membership in
// an array instead of replacing a single value.

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useTeamUsers } from '@/features/users/hooks'
import type { TeamUser } from '@/features/users/types'

function userLabel(u: TeamUser): string {
  const name = `${u.first_name} ${u.last_name}`.trim()
  return name || u.email
}

interface UserMultiSelectProps {
  /** Selected user ids. */
  value: string[]
  onChange: (userIds: string[]) => void
  /** Which app's members to list. Defaults to the active membership's app. */
  appId?: string
}

export function UserMultiSelect({ value, onChange, appId: appIdProp }: UserMultiSelectProps) {
  const activeAppId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const appId = appIdProp ?? activeAppId
  const { data: users, isLoading } = useTeamUsers()
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => (users ?? []).filter((u) => !appId || u.memberships.some((m) => m.app_id === appId)),
    [users, appId],
  )

  const selected = useMemo(
    () => options.filter((u) => value.includes(u.id)),
    [options, value],
  )

  const toggle = (userId: string) => {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId])
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
              <User size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {isLoading
                  ? 'Loading users…'
                  : selected.length === 0
                    ? 'Select User'
                    : `${selected.length} selected`}
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
            <CommandInput placeholder="Search people…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <Loader2 size={13} className="animate-spin" /> Loading users…
                </div>
              ) : (
                <>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((u) => {
                      const isSelected = value.includes(u.id)
                      return (
                        <CommandItem
                          key={u.id}
                          value={`${userLabel(u)} ${u.email}`}
                          onSelect={() => toggle(u.id)}
                        >
                          <Check size={14} className={cn('shrink-0', isSelected ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{userLabel(u)}</span>
                            <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{u.email}</span>
                          </span>
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
          {selected.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-1 pl-2 pr-1 text-[11px] text-[hsl(var(--muted-foreground))]"
            >
              {userLabel(u)}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                title="Remove"
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
