import { LogOut, Sun, Moon, Monitor } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks'
import { useThemeMode } from '@/features/theme/ThemeProvider'
import { useI18n } from '@/features/i18n/I18nProvider'
import type { I18nContextValue } from '@/features/i18n/I18nProvider'
import { LOCALE_LABELS } from '@/features/i18n/dictionaries'
import type { ThemeMode } from '@/features/theme/types'
import type { Me } from '@/features/auth/types'

interface ProfileMenuProps {
  session: Me
  /** Renders a light/dark/system toggle alongside the language switcher.
   *  Only RuntimeAppShell may pass this — it wraps in a per-app
   *  ThemeProvider (see runtime-router.tsx), which useThemeMode() requires.
   *  The builder's own AppShell.tsx reuses this same component but has no
   *  ThemeProvider ancestor (it runs the separate, simpler
   *  features/theme/useBuilderTheme.ts light/dark switch instead), so
   *  useThemeMode() would throw there — hence a dedicated child component
   *  below that's simply never mounted on that path, rather than calling
   *  the hook unconditionally in this one. */
  showThemeToggle?: boolean
}

function displayName(session: Me): string {
  const full = [session.first_name, session.last_name].filter(Boolean).join(' ')
  return full || session.email
}

const MODE_OPTIONS: readonly [ThemeMode, typeof Sun][] = [['light', Sun], ['dark', Moon], ['system', Monitor]]

function ThemeTogglePreference({ t }: { t: I18nContextValue['t'] }) {
  const { mode, setMode } = useThemeMode()
  return (
    <div className="px-2 py-1.5">
      <p className="mb-1 text-[11px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('profile.theme')}</p>
      <div className="flex gap-1 rounded-md border p-0.5" style={{ borderColor: 'hsl(var(--border))', width: 'fit-content' }}>
        {MODE_OPTIONS.map(([m, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-label={t(`common.${m}`)}
            aria-pressed={mode === m}
            title={t(`common.${m}`)}
            className="flex h-6 w-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            style={mode === m ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : undefined}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProfileMenu({ session, showThemeToggle }: ProfileMenuProps) {
  const logout = useLogout()
  const name = displayName(session)
  const { locale, setLocale, supportedLocales, t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('profile.account_menu')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <Avatar name={name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))]"
        container={document.getElementById('runtime-root') ?? document.body}
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium">{name}</p>
          <p className="truncate text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{session.email}</p>
        </div>
        <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
        {/* Preferences — a small block rather than two bespoke dropdown
            items, since "language" and "theme" are the same kind of thing
            (a per-viewer runtime preference) and "and so on" (the request
            this came from) names more of the same, not a reason to build a
            whole preferences page for two toggles. Plain buttons, not
            DropdownMenuItem — Radix closes the menu on an Item's select,
            which would defeat picking between three theme options or
            several locales in one visit. */}
        {supportedLocales.length > 1 && (
          <div className="px-2 py-1.5">
            <p className="mb-1 text-[11px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('profile.language')}</p>
            <div className="flex flex-wrap gap-1">
              {supportedLocales.map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className="rounded-md border px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                  style={{
                    borderColor: 'hsl(var(--border))',
                    backgroundColor: locale === l ? 'hsl(var(--accent))' : 'transparent',
                    color: locale === l ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
                  }}
                >
                  {LOCALE_LABELS[l] ?? l}
                </button>
              ))}
            </div>
          </div>
        )}
        {showThemeToggle && <ThemeTogglePreference t={t} />}
        <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
        <DropdownMenuItem destructive onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={13} />
          {t('profile.log_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
