import { HTTPError } from 'ky'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  error: unknown
  onBack: () => void
}

/** What the design shell shows when it cannot load the application it edits,
 *  instead of the blank page it used to render.
 *
 *  A 403 is the case this exists for: a role with "App design permissions" but
 *  without "View application settings" reaches the shell (the Edit design
 *  button only checks application:design) and is then refused the application
 *  itself (GET /application needs application:read). The role editor no longer
 *  lets anyone save that combination, but roles saved before it did, or made
 *  over the API, still can. The message names the permission as the role
 *  editor shows it, so whoever fixes the role can find it. Any other failure
 *  gets a plain "could not load" -- a 500 is not a permissions problem. */
export function DesignShellError({ error, onBack }: Props) {
  const t = useTranslation()
  const forbidden = error instanceof HTTPError && error.response.status === 403

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
      <div role="alert" className="max-w-md space-y-3 text-center">
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          {forbidden ? t('app_design.no_access_title') : t('app_design.load_failed_title')}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {forbidden ? t('app_design.no_access_description') : t('app_design.load_failed_description')}
        </p>
        <Button onClick={onBack}>{t('app_design.back_to_apps')}</Button>
      </div>
    </div>
  )
}
