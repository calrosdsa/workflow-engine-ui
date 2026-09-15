import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { useLogin } from './hooks'
import { authApi } from './api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/features/i18n/I18nProvider'

type FormValues = { credential: string; password: string }

export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const t = useTranslation()
  const schema = z.object({
    credential: z.string().min(1, t('auth.email_required')),
    password: z.string().min(1, t('auth.password_required')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      await login.mutateAsync(values)
      navigate({ to: '/' })
    } catch {
      // error shown inline via login.isError
    }
  }

  function signInWithGoogle() {
    window.location.href = authApi.googleAuthorizeUrl()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('auth.sign_in')}</CardTitle>
          <CardDescription>{t('auth.sign_in_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="credential">{t('auth.email')}</Label>
              <Input id="credential" type="email" {...register('credential')} autoComplete="email" />
              {errors.credential && <p className="text-xs text-destructive">{errors.credential.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" {...register('password')} autoComplete="current-password" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {login.isError && (
              <p className="text-xs text-destructive">{t('auth.invalid_credentials')}</p>
            )}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? t('auth.signing_in') : t('auth.sign_in')}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
            </div>
          </div>
          <Button variant="outline" type="button" className="w-full" onClick={signInWithGoogle}>
            {t('auth.sign_in_google')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
