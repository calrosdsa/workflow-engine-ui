import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useBuilderStore } from './store'
import type { VariableDecl } from '../types'

const VAR_TYPES: VariableDecl['type'][] = ['string', 'integer', 'float', 'boolean', 'time', 'datetime']

export function VariablesPanel() {
  const { variables, setVariables, varsPanelOpen, toggleVarsPanel } = useBuilderStore()

  const add = () =>
    setVariables([...variables, { name: `var_${variables.length + 1}`, type: 'string' }])

  const remove = (i: number) => setVariables(variables.filter((_, idx) => idx !== i))

  const update = (i: number, patch: Partial<VariableDecl>) =>
    setVariables(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  return (
    <aside
      className={[
        'relative flex shrink-0 flex-col border-r bg-white transition-all duration-200',
        varsPanelOpen ? 'w-56' : 'w-9',
      ].join(' ')}
    >
      {/* Toggle button — always visible on the right edge */}
      <button
        onClick={toggleVarsPanel}
        className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
        title={varsPanelOpen ? 'Collapse variables' : 'Expand variables'}
      >
        {varsPanelOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Collapsed state — rotated label */}
      {!varsPanelOpen && (
        <div className="flex flex-1 items-center justify-center">
          <span className="rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
            Variables
          </span>
        </div>
      )}

      {/* Expanded state */}
      {varsPanelOpen && (
        <>
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Variables</span>
            <Button size="icon" variant="ghost" onClick={add} className="h-6 w-6">
              <Plus size={13} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {variables.length === 0 && (
              <p className="pt-6 text-center text-xs text-gray-400">
                No variables yet.<br />Click + to add one.
              </p>
            )}
            {variables.map((v, i) => (
              <div key={i} className="rounded-lg border bg-gray-50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-gray-400 uppercase">Var {i + 1}</span>
                  <Button
                    size="icon" variant="ghost" onClick={() => remove(i)}
                    className="h-4 w-4 text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={10} />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Name</Label>
                  <Input value={v.name} onChange={(e) => update(i, { name: e.target.value })} className="h-6 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Type</Label>
                  <Select value={v.type} onChange={(e) => update(i, { type: e.target.value as VariableDecl['type'] })} className="h-6 text-xs">
                    {VAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
