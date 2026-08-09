// A <select> populated from the provider's model catalog, with a trailing
// "Custom…" option that reveals a free-text input. Providers retire/rename
// model ids faster than the catalog can track (see api/knowledgebases's
// providers.go doc comments), so the backend accepts any non-empty LLM
// model id — this lets the UI offer the curated list as a convenience
// without blocking a model the catalog hasn't caught up to yet.
import { useState } from 'react'
import { Input } from '@/components/ui/input'

const CUSTOM = '__custom__'

interface ModelSelectProps {
  value: string
  onChange: (model: string) => void
  options: string[]
  disabled?: boolean
  placeholder?: string
}

export function ModelSelect({ value, onChange, options, disabled, placeholder = 'model-id' }: ModelSelectProps) {
  // Whether "Custom…" is the active select option — tracked separately from
  // `value` because the custom text field starts empty (value === ''),
  // which would otherwise be indistinguishable from no selection at all and
  // make the select snap back to the first catalog option as soon as the
  // user starts typing.
  const [customPicked, setCustomPicked] = useState(() => value !== '' && !options.includes(value))
  const showCustomInput = customPicked || (value !== '' && !options.includes(value))

  return (
    <div className="space-y-1.5">
      <select
        value={showCustomInput ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustomPicked(true)
            onChange('')
          } else {
            setCustomPicked(false)
            onChange(e.target.value)
          }
        }}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 disabled:opacity-50"
      >
        {options.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {showCustomInput && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-[13px]"
          autoFocus
        />
      )}
    </div>
  )
}
