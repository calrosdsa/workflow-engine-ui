import { FileQuestion } from 'lucide-react'

interface NotFoundPageProps {
  message?: string
}

export function NotFoundPage({ message }: NotFoundPageProps) {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      <FileQuestion size={40} style={{ color: 'hsl(var(--muted-foreground))' }} className="opacity-60" />
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {message ?? "The page you're looking for doesn't exist, or this application hasn't been published yet."}
      </p>
    </div>
  )
}
