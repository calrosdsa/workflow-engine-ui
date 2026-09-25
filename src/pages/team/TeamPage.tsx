import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UsersSection } from './sections/UsersSection'
import { RolesSection } from './sections/RolesSection'
import { SecuritySection } from './sections/SecuritySection'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@/features/i18n/I18nProvider'

type SectionId = 'users' | 'roles' | 'security'

export function TeamPage() {
  const t = useTranslation()
  const navigate = useNavigate()
  const [section, setSection] = useState<SectionId>('users')

  return (
    <div className="flex h-full flex-col">
      <Tabs value={section} onValueChange={(v) => setSection(v as SectionId)} className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
          <h1 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('team.users_access')}</h1>
          <TabsList>
            <TabsTrigger value="users">{t('team.users')}</TabsTrigger>
            <TabsTrigger value="roles">{t('team.roles')}</TabsTrigger>
            <TabsTrigger value="security">{t('team.security')}</TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="users" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <UsersSection />
        </TabsContent>
        <TabsContent value="roles" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <RolesSection />
        </TabsContent>
        <TabsContent value="security" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <SecuritySection onSetUpOwn={() => void navigate({ to: '/account/security' })} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
