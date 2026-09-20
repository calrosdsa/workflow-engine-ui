import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  codes: string[]
  onDone: () => void
}

/** Shows a freshly generated recovery-code set. This is the only time these are
 *  ever readable: the server stores only salted hashes, so there is no endpoint
 *  that can show them again — a user who loses them has to generate a new set,
 *  which invalidates these. The copy says so plainly rather than letting someone
 *  assume they can come back for them. */
export function RecoveryCodesPanel({ codes, onDone }: Props) {
  const t = useTranslation()
  const asText = codes.join('\n')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mfa.save_recovery_codes')}</CardTitle>
        <CardDescription>{t('mfa.save_recovery_codes_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(asText).catch(() => {})
            }}
          >
            {t('mfa.copy_all')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // A plain text file the user can put in a password manager. Built
              // client-side from data already on screen, so nothing extra is
              // sent anywhere.
              const blob = new Blob([`${asText}\n`], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = 'recovery-codes.txt'
              link.click()
              URL.revokeObjectURL(url)
            }}
          >
            {t('mfa.download')}
          </Button>
          <Button type="button" onClick={onDone}>
            {t('mfa.saved_them')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
