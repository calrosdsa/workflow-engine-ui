import { useContext, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useSearch } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { useLoadSession, useLogin } from '@/features/auth/hooks'
import { isMfaChallenge, type MfaChallenge } from '@/features/auth/mfa/api'
import { MfaChallengeCard, MfaEnrollDuringLogin } from '@/features/auth/mfa/LoginMfaSteps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { RuntimeSnapshotContext } from './snapshot-context'

// z.object is called at module scope, before any component (and its
// useTranslation()) exists — same shape as AddFormDialog.tsx's buildChoices(t)
// factory, just returning a zod schema instead of an options array.
// auth.email_required/auth.password_required reused directly: this schema
// is a structural mirror of features/auth/LoginPage.tsx's own (per this
// file's own top comment), which already seeded that exact pair.
function buildSchema(t: ReturnType<typeof useTranslation>) {
  return z.object({
    credential: z.string().min(1, t('auth.email_required')),
    password: z.string().min(1, t('auth.password_required')),
  })
}
type FormValues = z.infer<ReturnType<typeof buildSchema>>

// A runtime-scoped sign-in form — same shared auth hooks/api as the
// builder's LoginPage, but redirects back into the RUNTIME route the user
// was trying to reach (via ?returnTo=), not the builder's dashboard.
// PermissionDeniedPage links here rather than crossing into the separate
// index.html bundle, so the runtime stays self-contained.
export function RuntimeLoginPage() {
  const t = useTranslation()
  const { clientId, appId } = useParams({ strict: false }) as { clientId: string; appId: string }
  const search = useSearch({ strict: false }) as { returnTo?: string }
  const login = useLogin()
  const loadSession = useLoadSession()
  // Set when sign-in accepted the password but held the session back for a
  // second factor. This page used to navigate into the app regardless, so an
  // enrolled user arrived with no session and was bounced straight back here
  // with no explanation. Held in component state, like the builder's
  // LoginPage, so a half-finished login never outlives the page.
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  // Read without the throwing hook: the sign-in page must still render if
  // the app's snapshot did not load.
  const appName = useContext(RuntimeSnapshotContext)?.app.name

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(t)) })

  // Where a successful sign-in lands, whether it finished in one step or
  // through the MFA challenge.
  function goToApp() {
    const returnTo = search.returnTo
    if (returnTo && returnTo.startsWith(`/${clientId}/${appId}`)) {
      window.location.href = returnTo
    } else {
      runtimeRouter.navigate({ to: `/${clientId}/${appId}` })
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const result = await login.mutateAsync(values)
      if (isMfaChallenge(result)) {
        setChallenge(result)
        return
      }
      goToApp()
    } catch {
      // error shown inline via login.isError
    }
  }

  // Runs once the second factor is accepted and a session finally exists.
  async function onVerified() {
    await loadSession()
    goToApp()
  }

  if (challenge) {
    // The same two steps the builder's LoginPage renders. Enrollment is
    // included: someone the policy requires to enroll may well meet that
    // requirement here first, and turning them away would strand them.
    const Step = challenge.purpose === 'enroll' ? MfaEnrollDuringLogin : MfaChallengeCard
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
      >
        <Step
          challenge={challenge}
          onVerified={onVerified}
          onCancel={() => {
            // Back to the password form. Nothing to revoke: the engine
            // already revoked the pre-verification session, and the challenge
            // expires on its own.
            setChallenge(null)
            login.reset()
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      <div className="w-full max-w-sm animate-in fade-in-0 duration-300 motion-reduce:animate-none">
        {/* Which app this is, printed like a form's heading: a small caption
            in the app's spot colour, then its name. Without a snapshot there
            is no name to print, so it falls back to a plain sign-in title. */}
        <header className="mb-5 text-center">
          {appName ? (
            <>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink))]">{t('runtime.login.eyebrow')}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.015em]">{appName}</h1>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-[-0.015em]">{t('auth.sign_in')}</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('runtime.login.description')}</p>
            </>
          )}
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* The same ruled sheet every form in the app is printed on
              (runtime.css): two cells, email and password. */}
          <section data-slot="form-section" data-chrome="true" className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div data-slot="form-section-body">
              <div data-slot="form-columns">
                <div data-slot="form-column">
                  <div data-slot="form-field" data-component="email" data-invalid={errors.credential ? 'true' : undefined}>
                    <Label htmlFor="credential" data-slot="form-field-label">{t('auth.email')}</Label>
                    <Input
                      id="credential"
                      type="email"
                      autoFocus
                      aria-invalid={!!errors.credential}
                      {...register('credential')}
                      autoComplete="email"
                    />
                    {errors.credential && (
                      <p data-slot="form-field-error" className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]">
                        <AlertCircle size={12} className="shrink-0" />
                        {errors.credential.message}
                      </p>
                    )}
                  </div>
                  <div data-slot="form-field" data-component="password" data-invalid={errors.password ? 'true' : undefined}>
                    <Label htmlFor="password" data-slot="form-field-label">{t('auth.password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      aria-invalid={!!errors.password}
                      {...register('password')}
                      autoComplete="current-password"
                    />
                    {errors.password && (
                      <p data-slot="form-field-error" className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]">
                        <AlertCircle size={12} className="shrink-0" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
          {login.isError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-xs text-[hsl(var(--destructive))]"
            >
              <AlertCircle size={14} className="shrink-0" />
              {t('auth.invalid_credentials')}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending && <Spinner className="h-4 w-4 border-current" />}
            {login.isPending ? t('auth.signing_in') : t('auth.sign_in')}
          </Button>
        </form>
      </div>
    </div>
  )
}
