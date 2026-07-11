import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { useAcceptInvitation } from '@/features/invitations/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Matches the backend's minPasswordLength (api/invitations/handler.go),
// itself matching credentialpassword's defaultMinPasswordLength.
const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export function AcceptInvitePage() {
  const navigate = useNavigate()
  const acceptInvitation = useAcceptInvitation()
  const [submitted, setSubmitted] = useState(false)

  // This route lives outside the authenticated shell (no session yet), so
  // it reads the token directly from the URL rather than the router's
  // typed search-param machinery, which is only wired up under shellRoute.
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      await acceptInvitation.mutateAsync({ token, ...values })
      setSubmitted(true)
      setTimeout(() => navigate({ to: '/login' }), 1500)
    } catch {
      // error shown inline via acceptInvitation.isError
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid invitation link</CardTitle>
            <CardDescription>This link is missing its invitation token.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accept invitation</CardTitle>
          <CardDescription>Set your name and password to create your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <p className="text-sm text-emerald-700">Account created — redirecting to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" {...register('first_name')} autoComplete="given-name" />
                {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" {...register('last_name')} autoComplete="family-name" />
                {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} autoComplete="new-password" />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              {acceptInvitation.isError && (
                <p className="text-xs text-destructive">This invitation could not be accepted — it may be invalid or expired.</p>
              )}
              <Button type="submit" className="w-full" disabled={acceptInvitation.isPending}>
                {acceptInvitation.isPending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
