import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  secret: string
  otpauthUri: string
}

/** Groups a base32 secret into fours so a user can read it off the screen
 *  without losing their place. Authenticator apps ignore the spaces. */
function grouped(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(' ')
}

/** The enrollment payload: a QR code to scan, with the key in text as the
 *  fallback every authenticator app supports for when a camera is not an
 *  option (desktop authenticators, a locked-down phone camera, screen readers).
 *
 *  The QR is rendered here from the otpauth:// URI rather than fetched as an
 *  image, so the shared secret never travels through an image-rendering service
 *  and never lands in a browser image cache. */
export function SecretKeyBlock({ secret, otpauthUri }: Props) {
  const t = useTranslation()

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('mfa.scan_instructions')}</p>

      <div className="flex justify-center rounded-md border bg-white p-4">
        <QRCodeSVG value={otpauthUri} size={168} level="M" marginSize={0} />
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t('mfa.or_enter_key_manually')}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
            {grouped(secret)}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Clipboard access can be refused (insecure context, denied
              // permission). The key is on screen either way, so a failure here
              // is not worth an error state.
              void navigator.clipboard?.writeText(secret).catch(() => {})
            }}
          >
            {t('mfa.copy')}
          </Button>
        </div>
      </div>
    </div>
  )
}
