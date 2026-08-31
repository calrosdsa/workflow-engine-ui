// Sheet-native data insertion (FR-J1-006 SN-01/SN-02/SN-03).
//
// The requester's framing was "we should be able to do everything from the
// data sheet editor". Selecting cells and saying what data goes there is how
// people actually use a spreadsheet — picking a *block type* first, which is
// what the old panel grid required, is a concept nobody asked for.
import { useState } from 'react'
import { Database, Plus, TableProperties } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useForms } from '@/features/forms/hooks'
import { createDataSource } from '../data-sources'
import { useReportStore } from '../store'
import type { ReportBlockRegion } from '../types'

interface InsertDataMenuProps {
  getSelection: () => ReportBlockRegion | undefined
  onBeforeChange?: () => void
}

export function InsertDataMenu({ getSelection, onBeforeChange }: InsertDataMenuProps) {
  const definition = useReportStore((state) => state.definition)
  const addBlock = useReportStore((state) => state.addBlock)
  const addDataSource = useReportStore((state) => state.addDataSource)
  const updateBlockConfig = useReportStore((state) => state.updateBlockConfig)
  const { data: formList } = useForms()
  const [open, setOpen] = useState(false)

  const sources = definition.data_sources ?? []

  const insert = (sourceID: string) => {
    const selection = getSelection()
    if (!selection) {
      // Not silently disabled: the control stays live and says what is
      // missing, since "nothing happened" is the worst possible response.
      toast.error('Select the cells to place this data in first.')
      return
    }
    onBeforeChange?.()
    // SN-03: the anchor and span come straight from the selection. The panel's
    // coordinate inputs and "Place at selected cells" remain as the secondary
    // path for adjusting it afterwards.
    const id = addBlock('table', selection)
    updateBlockConfig(id, { source_id: sourceID })
    setOpen(false)
  }

  // SN-02: with no sources, route the author into creating one rather than
  // dead-ending. This creates the same thing the panel's own Add button does
  // (first available form, auto-named), so it is not a different or more
  // presumptuous action — just reachable from where the author already is.
  const createFirstSource = () => {
    const form = formList?.[0]
    if (!form) {
      toast.error('This app has no forms yet, so there is no data to report on.')
      return
    }
    onBeforeChange?.()
    const source = createDataSource(form.id, form.name, sources)
    addDataSource(source)
    toast.success(`Added the data source "${source.name}"`, {
      description: 'Set its filter and sort in the panel, then insert it here.',
    })
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1.5 px-2 text-xs font-semibold text-[hsl(var(--foreground))]">
          <TableProperties size={13} className="text-[hsl(var(--primary))]" />
          Insert data
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          Places the chosen data at the cells you have selected.
        </div>
        <DropdownMenuSeparator />
        {sources.length === 0 ? (
          <DropdownMenuItem onSelect={createFirstSource} className="gap-2 text-xs">
            <Plus size={12} className="text-[hsl(var(--primary))]" />
            Add a data source first
          </DropdownMenuItem>
        ) : (
          sources.map((source) => (
            <DropdownMenuItem key={source.id} onSelect={() => insert(source.id)} className="gap-2 text-xs">
              <Database size={12} className="text-[hsl(var(--primary))]" />
              <span className="truncate">{source.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
