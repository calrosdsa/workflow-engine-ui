import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, ChevronLeft, ChevronRight, Bell, Bot, Box, Database, FileBarChart, GitBranch, Globe, Pencil } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES, fallbackCategory } from './node-registry'
import { useNodeTaxonomy, groupByPaletteCategory, groupBySource, type PaletteEntry } from './node-taxonomy'
import { iconFor, iconForHint } from './icon-hints'
import { AppPickerPanel, type PickerSelection } from './AppPickerPanel'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'
import { useTranslation } from '@/features/i18n/I18nProvider'

const CATEGORY_LABEL_IDS = new Set(['ai', 'core', 'data', 'flow', 'integration', 'notify', 'output', 'structure', 'utility', 'logic'])

interface NodePickerModalProps {
  onSelect: (selection: PickerSelection) => void
  onClose:  () => void
}

type PickerView = number | 'home' | 'apps'

function actionLabel(entry: PaletteEntry) {
  if (entry.kind !== 'package' || !entry.appLabel) return entry.label
  const prefix = `${entry.appLabel} — `
  return entry.label.startsWith(prefix) ? entry.label.slice(prefix.length) : entry.label
}

function categoryIcon(id: string) {
  switch (id) {
    case 'ai': return Bot
    case 'core': return Box
    case 'data': return Database
    case 'flow': return GitBranch
    case 'integration': return Globe
    case 'notify': return Bell
    case 'output': return FileBarChart
    case 'structure': return GitBranch
    case 'utility': return Pencil
    default: return Globe
  }
}

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const t = useTranslation()
  const [search,    setSearch]    = useState('')
  // The landing view asks for intent first. Numeric views still preserve the
  // served functional taxonomy, while the app view remains a separate
  // cross-category browse path. A package action is therefore discoverable
  // both by what it does and by the provider that owns it.
  const [activeTab, setActiveTab] = useState<PickerView>('home')
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: taxonomy } = useNodeTaxonomy()

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Every addable node type, whatever its provenance, in ONE list — built-in
  // and package alike. Functional grouping happens downstream on `category`,
  // then each visible category is subdivided by source/app for quick scanning.
  //
  // A core entry's category comes from the served taxonomy when it has
  // arrived, falling back to the compiled-in one — that is what lets the
  // backend re-group a node, or introduce a category this bundle predates,
  // without a frontend release. A package entry has no compiled-in fallback
  // at all; it exists here only because the taxonomy served it.
  const entries: PaletteEntry[] = useMemo(() => {
    const servedCategory = new Map((taxonomy?.nodes ?? []).map((n) => [n.type, n.category]))
    const appsByName = new Map((taxonomy?.apps ?? []).map((app) => [app.name, app]))
    const builtins: PaletteEntry[] = PALETTE_NODES.map((type) => ({
      type,
      kind: 'core',
      category: servedCategory.get(type) ?? fallbackCategory(type),
      label: t(`workflows.node.${type}.label`) === `workflows.node.${type}.label` ? NODE_REGISTRY[type].label : t(`workflows.node.${type}.label`),
      description: t(`workflows.node.${type}.description`) === `workflows.node.${type}.description` ? NODE_REGISTRY[type].description : t(`workflows.node.${type}.description`),
    }))
    const runtime: PaletteEntry[] = (taxonomy?.nodes ?? [])
      .filter((n) => n.kind === 'package')
      .map((n) => ({
        ...(() => {
          const app = n.package ? appsByName.get(n.package) : undefined
          return {
            appName: n.package,
            appLabel: app?.display_name,
            appIconHint: app?.icon_hint,
          }
        })(),
        type: n.type,
        kind: 'package' as const,
        category: n.category,
        label: n.display_name || n.type,
        description: n.summary ?? '',
        iconHint: n.icon_hint,
      }))
    return [...builtins, ...runtime]
  }, [taxonomy])

  // Keep "All" internally so search and category indexing share one stable
  // structure, then expose only the occupied category choices on the landing
  // view. A category with no members never renders.
  const tabs = useMemo(() => {
    const groups = groupByPaletteCategory(entries, taxonomy?.categories ?? [])
    return [{ id: 'all', label: t('common.all'), entries }, ...groups.map((group) => ({
      ...group,
      label: CATEGORY_LABEL_IDS.has(group.id) ? t(`workflows.category.${group.id}`) : group.label,
    }))]
  }, [entries, taxonomy, t])
  const categoryTabs = tabs.slice(1)
  const selectedCategory = typeof activeTab === 'number' ? tabs[activeTab] : undefined

  const candidates = search
    ? entries.filter((c) => {
        const needle = search.toLowerCase()
        return c.label.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle) ||
          (c.appLabel ?? c.appName ?? '').toLowerCase().includes(needle)
      })
    : (selectedCategory?.entries ?? [])
  const sourceGroups = groupBySource(candidates)

  return (
    // Backdrop. Click-to-close is a supplementary pointer gesture — Escape
    // (wired above) is the real keyboard equivalent, matching a standard
    // dialog-overlay convention. A fake role/tabIndex on a full-viewport div
    // would just be a purposeless tab stop ahead of the modal's real content.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="absolute inset-0 z-50 flex justify-end bg-[hsl(var(--background))]/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex h-full max-h-none w-[min(32rem,100vw)] flex-col overflow-hidden border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl shadow-black/30">

        {/* Header */}
        <div className="border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('workflows.node_picker.what_next')}</p>
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{t('workflows.node_picker.choose_category')}</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1" title={t('workflows.node_picker.close')}>
              <X size={15} />
            </button>
          </div>
          {/* Own search box, hidden in Apps mode — AppPickerPanel renders
              its own (scoped to app names, not node labels/descriptions),
              and showing both at once would be confusing about which one
              a keystroke is filtering. */}
          {activeTab !== 'apps' && (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 focus-within:border-[hsl(var(--primary))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]/30">
            <Search size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Enter picks the top match — type a few letters and hit Enter.
                if (e.key === 'Enter' && candidates.length > 0) {
                  e.preventDefault()
                  onSelect({ kind: 'node', type: candidates[0].type })
                }
              }}
              placeholder={t('workflows.node_picker.search')}
              className="h-9 flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
            {search && candidates.length > 0 && (
              <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">↵</kbd>
            )}
          </div>
          )}
        </div>

        {/* Body: the landing view makes the user's intent the first decision.
            Selecting a category opens its action list; Apps is a separate
            browse-by-provider path with its own trigger/action split. */}
        {!search && activeTab === 'home' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-1.5">
              {categoryTabs.map((tab, index) => {
                const Icon = categoryIcon(tab.id)
                const description = tab.description ?? taxonomy?.categories.find((category) => category.id === tab.id)?.description
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(index + 1)}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left',
                      'transition-[border-color,background-color,box-shadow,transform] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:shadow-sm hover:-translate-y-0.5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors group-hover:bg-[hsl(var(--primary))]/15 group-hover:text-[hsl(var(--primary))]">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))]">{tab.label}</span>
                      {description && (
                        <span className="mt-0.5 block text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">{description}</span>
                      )}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5" />
                  </button>
                )
              })}
            </div>

            <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('apps')}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left',
                  'transition-[border-color,background-color,box-shadow,transform] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:shadow-sm hover:-translate-y-0.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors group-hover:bg-[hsl(var(--primary))]/15 group-hover:text-[hsl(var(--primary))]">
                  <Globe size={18} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))]">Action in an app</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">Do something in Slack, WhatsApp, or another connected app.</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        ) : !search && activeTab === 'apps' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[hsl(var(--border))] px-5 py-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              >
                <ChevronLeft size={14} />
                {t('workflows.node_picker.categories')}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AppPickerPanel scope="triggers-and-actions" onSelect={onSelect} />
            </div>
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!search && typeof activeTab === 'number' && selectedCategory && (
            <div className="mb-3 flex items-center gap-2 border-b border-[hsl(var(--border))] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
                aria-label={t('workflows.node_picker.back_categories')}
                title={t('workflows.node_picker.back_categories')}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{selectedCategory.label}</p>
                <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {selectedCategory.description ?? t('workflows.node_picker.available_steps', { count: selectedCategory.entries.length })}
                </p>
              </div>
            </div>
          )}
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search size={24} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('workflows.node_picker.no_match', { query: search })}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
            {sourceGroups.map((group) => {
              const SectionIcon = group.iconHint ? iconForHint(group.iconHint) : undefined
              return (
                <section key={group.id} className="space-y-1.5">
                  <h3 className="flex items-center gap-2 px-1 pb-0.5 pt-3 first:pt-0">
                    {SectionIcon && <SectionIcon size={12} className="text-[hsl(var(--muted-foreground))]" />}
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                      {group.label} {t('workflows.node_picker.actions')}
                    </span>
                    <span className="h-px flex-1 bg-[hsl(var(--border))]" />
                  </h3>
                  {group.entries.map((c) => {
                    const builtin = c.kind === 'core' ? NODE_REGISTRY[c.type as NodeType] : undefined
                    const Icon = iconFor(c.type, c.iconHint)
                    const gradient = builtin?.gradient ?? 'bg-[hsl(var(--foreground))]/70'
                    return (
                      <button
                        key={c.type}
                        onClick={() => onSelect({ kind: 'node', type: c.type })}
                        className={cn(
                          'group flex w-full min-w-0 items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left',
                          'transition-[border-color,background-color,box-shadow,transform] hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))] hover:shadow-md hover:-translate-y-0.5',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                        )}
                      >
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-105',
                          gradient,
                        )}>
                          <Icon size={18} strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{actionLabel(c)}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">{c.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </section>
              )
            })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
