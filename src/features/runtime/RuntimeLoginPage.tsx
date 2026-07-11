import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useSearch } from '@tanstack/react-router'
import { runtimeRouter } from '@/runtime-router'
import { useLogin } from '@/features/auth/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in to continue to this application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="credential">Email</Label>
              <Input id="credential" type="email" {...register('credential')} autoComplete="email" />
              {errors.credential && <p className="text-xs text-destructive">{errors.credential.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} autoComplete="current-password" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {login.isError && <p className="text-xs text-destructive">Invalid credentials. Please try again.</p>}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
