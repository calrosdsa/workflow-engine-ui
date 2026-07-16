import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useSearch } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { runtimeRouter } from '@/runtime-router'
import { useLogin } from '@/features/auth/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  credential: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

// A runtime-scoped sign-in form — same shared auth hooks/api as the
// builder's LoginPage, but redirects back into the RUNTIME route the user
// was trying to reach (via ?returnTo=), not the builder's dashboard.
// PermissionDeniedPage links here rather than crossing into the separate
// index.html bundle, so the runtime stays self-contained.
export function RuntimeLoginPage() {
  const { clientId, appId } = useParams({ strict: false }) as { clientId: string; appId: string }
  const search = useSearch({ strict: false }) as { returnTo?: string }
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      await login.mutateAsync(values)
      const returnTo = search.returnTo
      if (returnTo && returnTo.startsWith(`/${clientId}/${appId}`)) {
        window.location.href = returnTo
      } else {
        runtimeRouter.navigate({ to: `/${clientId}/${appId}` })
      }
    } catch {
      // error shown inline via login.isError
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      <Card className="w-full max-w-sm animate-in fade-in-0 duration-300">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in to continue to this application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="credential">Email</Label>
              <Input
                id="credential"
                type="email"
                autoFocus
                aria-invalid={!!errors.credential}
                {...register('credential')}
                autoComplete="email"
              />
              {errors.credential && (
                <p className="flex items-center gap-1 text-xs" style={{ color: 'hsl(var(--destructive))' }}>
                  <AlertCircle size={12} className="shrink-0" />
                  {errors.credential.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                aria-invalid={!!errors.password}
                {...register('password')}
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="flex items-center gap-1 text-xs" style={{ color: 'hsl(var(--destructive))' }}>
                  <AlertCircle size={12} className="shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>
            {login.isError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs"
                style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
              >
                <AlertCircle size={14} className="shrink-0" />
                Invalid credentials. Please try again.
              </div>
            )}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Spinner className="h-4 w-4 border-current" />}
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
