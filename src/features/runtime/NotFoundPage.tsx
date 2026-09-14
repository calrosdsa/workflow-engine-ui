import { FileQuestion } from 'lucide-react'
import { useTranslationSafe } from '@/features/i18n/I18nProvider'

interface NotFoundPageProps {
  message?: string
}

export function NotFoundPage({ message }: NotFoundPageProps) {
  const t = useTranslationSafe()
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      <FileQuestion size={40} style={{ color: 'hsl(var(--muted-foreground))' }} className="opacity-60" />
      <h1 className="text-lg font-semibold">{t('runtime.not_found.title')}</h1>
      <p className="max-w-sm text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {message ?? t('runtime.not_found.default_message')}
      </p>
    </div>
  )
}
