import { useState } from 'react'
import { Users, Shield } from 'lucide-react'
import { UsersSection } from './sections/UsersSection'
import { RolesSection } from './sections/RolesSection'

type SectionId = 'users' | 'roles'

const SECTIONS: { id: SectionId; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
]

export function TeamPage() {
  const [section, setSection] = useState<SectionId>('users')

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b bg-white px-4">
        <h1 className="mr-4 text-sm font-semibold text-slate-800">Team</h1>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              section === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === 'users' && <UsersSection />}
        {section === 'roles' && <RolesSection />}
      </div>
    </div>
  )
}
