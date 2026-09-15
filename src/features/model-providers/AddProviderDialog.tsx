import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateInstance, useVerifyProvider } from './hooks'
import { PROVIDER_LOGOS, PROVIDER_LABELS } from './logos'
import type { ProviderType } from './types'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface AddProviderDialogProps {
  providerType: ProviderType | null
  onOpenChange: (open: boolean) => void
}

// Opened with a fixed providerType from whichever "Available models" card
// was clicked — Instance name + API key only, matching the RAGFlow
// reference's exact shape. No model-selection step: on save, the server
// seeds every catalog model for this vendor automatically (see
// api/providers.Handler.Create).
export function AddProviderDialog({ providerType, onOpenChange }: AddProviderDialogProps) {
  const t = useTranslation()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const verifyMutation = useVerifyProvider()
  const createMutation = useCreateInstance()

  const open = providerType !== null
  const Logo = providerType ? PROVIDER_LOGOS[providerType] : null
  const label = providerType ? PROVIDER_LABELS[providerType] : ''
  const canSubmit = name.trim() !== '' && apiKey.trim() !== ''

  const reset = () => {
    setName('')
    setApiKey('')
    setVerifyResult(null)
    verifyMutation.reset()
    createMutation.reset()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleVerify = () => {
    if (!providerType || apiKey.trim() === '') return
    verifyMutation.mutate(
      { provider_type: providerType, api_key: apiKey.trim() },
      {
        onSuccess: (result) => setVerifyResult(result),
        onError: () => setVerifyResult({ ok: false, error: 'Could not reach the verification service.' }),
      },
    )
  }

  const handleSubmit = () => {
    if (!providerType || !canSubmit) return
    createMutation.mutate(
      { name: name.trim(), provider_type: providerType, api_key: apiKey.trim() },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} — ${t('common.add')}`)
          handleOpenChange(false)
        },
        onError: (e) => {
          toast.error(t('model_providers.add_failed'), { description: e instanceof Error ? e.message : undefined })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Logo && <Logo size={18} />}
            {label}
          </DialogTitle>
          <DialogDescription>
            {t('model_providers.add_connection', { provider: label })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t('model_providers.instance_name')}<span className="text-[hsl(var(--destructive))]"> *</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('model_providers.instance_placeholder')}
              autoFocus
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t('model_providers.api_key')}<span className="text-[hsl(var(--destructive))]"> *</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setVerifyResult(null) }}
              placeholder={t('model_providers.api_key_placeholder')}
            />
            {providerType === 'voyage' && (
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('model_providers.voyage_hint')}
              </p>
            )}
            {verifyResult && (
              <p className={`mt-1.5 flex items-center gap-1 text-[11px] ${verifyResult.ok ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                {verifyResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {verifyResult.ok ? t('model_providers.key_verified') : verifyResult.error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleVerify}
            disabled={apiKey.trim() === '' || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            {t('model_providers.verify')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={createMutation.isPending}>
              {t('common.close')}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              {t('model_providers.ok')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
