import { FileQuestion } from 'lucide-react'

interface NotFoundPageProps {
  message?: string
}

export function NotFoundPage({ message }: NotFoundPageProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white text-center">
      <FileQuestion size={40} className="text-gray-300" />
      <h1 className="text-lg font-semibold text-gray-800">Page not found</h1>
      <p className="max-w-sm text-sm text-gray-500">
        {message ?? "The page you're looking for doesn't exist, or this application hasn't been published yet."}
      </p>
    </div>
  )
}
