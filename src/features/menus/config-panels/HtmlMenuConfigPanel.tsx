import { useState } from 'react'
import { Plus, Trash2, Globe, Database, PencilLine, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { HtmlCodeEditor } from '@/features/dashboard/widgets/custom-html/HtmlCodeEditor'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { isAllowedHost } from '../html/srcdoc'
import { slugifyKey } from '@/features/form-builder/factory'
import type { MenuConfigPanelProps } from '../menu-registry'
import type { HtmlMenuConfig } from '../types'

const STARTER_HTML = `<div style="padding:24px">
  <h1 style="color:hsl(var(--primary))">My page</h1>
  <p>Anything you write here renders in the app's theme.</p>
  <ul id="rows"></ul>
</div>

<script>
  // Declared data sources are available as AppBuilder.query(id).
  // AppBuilder.sources lists the ids you've declared below.
  AppBuilder.query(AppBuilder.sources[0]).then(function (r) {
    document.getElementById('rows').innerHTML =
      r.rows.map(function (row) { return '<li>' + JSON.stringify(row) + '</li>' }).join('')
  }).catch(function (e) {
    document.getElementById('rows').textContent = e.message
  })
</script>`

/** Authoring surface for an HTML menu.
 *
 *  Three things, in the order they matter: the page itself, the data it may
 *  reach, and the hosts it may reach. The last two are the access-control
 *  decisions — a page can only ever query a source or write to a target
 *  declared here, and can only make outbound requests to a host listed
 *  here (see features/menus/html/srcdoc.ts). */
export function HtmlMenuConfigPanel({ menu, onChange }: MenuConfigPanelProps) {
  const config = menu.config as HtmlMenuConfig
  const patch = (p: Partial<HtmlMenuConfig>) => onChange({ ...config, ...p })

  const sources = config.data_sources ?? []
  const targets = config.write_targets ?? []
  const hosts = config.allowed_hosts ?? []
  const [newHost, setNewHost] = useState('')

  const uniqueId = (base: string, taken: string[]) => {
    const root = slugifyKey(base)
    if (!taken.includes(root)) return root
    let i = 2
    while (taken.includes(`${root}_${i}`)) i++
    return `${root}_${i}`
  }

  const addHost = () => {
    const host = newHost.trim()
    if (!host || !isAllowedHost(host) || hosts.includes(host)) return
    patch({ allowed_hosts: [...hosts, host] })
    setNewHost('')
  }

  const hostInvalid = newHost.trim().length > 0 && !isAllowedHost(newHost.trim())

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Page HTML</Label>
          {!config.html?.trim() && (
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
              onClick={() => patch({ html: STARTER_HTML })}>
              Insert starter page
            </Button>
          )}
        </div>
        <HtmlCodeEditor value={config.html ?? ''} onChange={(html) => patch({ html })} />
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          Runs in an isolated frame. Scripts work; they cannot reach the rest of the app. Use{' '}
          <code>hsl(var(--primary))</code> and the other theme variables to match the app.
        </p>
      </div>

      {/* --- Data sources ------------------------------------------------ */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            <Database size={12} /> Data sources
          </Label>
          <Button
            type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => patch({
              data_sources: [...sources, { id: uniqueId('source', sources.map((s) => s.id)), form_id: '' }],
            })}
          >
            <Plus size={11} /> Add
          </Button>
        </div>

        {sources.length === 0 ? (
          <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
            No data sources. The page can render, but has nothing to read.
          </p>
        ) : (
          <div className="space-y-2">
            {sources.map((source, i) => (
              <div key={i} className="rounded-md border border-[hsl(var(--border))] p-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={source.id}
                    onChange={(e) => patch({
                      data_sources: sources.map((s, j) => j === i ? { ...s, id: slugifyKey(e.target.value) } : s),
                    })}
                    className="h-7 flex-1 font-mono text-[11px]"
                    placeholder="source id"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ data_sources: sources.filter((_, j) => j !== i) })}
                    className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    title="Remove data source"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-1.5">
                  <FormReferenceSelect
                    value={source.form_id}
                    onChange={(formId) => patch({
                      data_sources: sources.map((s, j) => j === i ? { ...s, form_id: formId ?? '' } : s),
                    })}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <code>AppBuilder.query(&apos;{source.id}&apos;)</code>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Write targets ----------------------------------------------- */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            <PencilLine size={12} /> Write targets
          </Label>
          <Button
            type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => patch({
              write_targets: [...targets, { id: uniqueId('target', targets.map((t) => t.id)), form_id: '', allow_create: true }],
            })}
          >
            <Plus size={11} /> Add
          </Button>
        </div>

        {targets.length === 0 ? (
          <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
            No write targets. The page is read-only.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((target, i) => (
              <div key={i} className="rounded-md border border-[hsl(var(--border))] p-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={target.id}
                    onChange={(e) => patch({
                      write_targets: targets.map((t, j) => j === i ? { ...t, id: slugifyKey(e.target.value) } : t),
                    })}
                    className="h-7 flex-1 font-mono text-[11px]"
                    placeholder="target id"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ write_targets: targets.filter((_, j) => j !== i) })}
                    className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    title="Remove write target"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-1.5">
                  <FormReferenceSelect
                    value={target.form_id}
                    onChange={(formId) => patch({
                      write_targets: targets.map((t, j) => j === i ? { ...t, form_id: formId ?? '' } : t),
                    })}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-4">
                  {(['allow_create', 'allow_update'] as const).map((key) => (
                    <Label key={key} className="flex items-center gap-1.5 text-[11px] font-normal text-[hsl(var(--foreground))]">
                      <Checkbox
                        checked={target[key] === true}
                        onCheckedChange={(checked) => patch({
                          write_targets: targets.map((t, j) => j === i ? { ...t, [key]: checked === true } : t),
                        })}
                      />
                      {key === 'allow_create' ? 'Create' : 'Update'}
                    </Label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Writes run as the person viewing the page — they can never do more than that viewer could by hand.
            </p>
          </div>
        )}
      </div>

      {/* --- Allowed hosts ----------------------------------------------- */}
      <div>
        <Label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          <Globe size={12} /> Allowed hosts
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHost() } }}
            placeholder="cdn.example.com"
            className="h-7 flex-1 font-mono text-[11px]"
          />
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]"
            onClick={addHost} disabled={!newHost.trim() || hostInvalid}>
            Add
          </Button>
        </div>
        {hostInvalid && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[hsl(var(--destructive))]">
            <AlertCircle size={11} /> Use a hostname like <code>cdn.example.com</code> or <code>*.example.com</code> — no paths or spaces.
          </p>
        )}
        {hosts.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hosts.map((host) => (
              <span key={host} className="inline-flex items-center gap-1 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[11px]">
                {host}
                <button
                  type="button"
                  onClick={() => patch({ allowed_hosts: hosts.filter((h) => h !== host) })}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                  aria-label={`Remove ${host}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          {hosts.length === 0
            ? 'The page cannot make any outbound requests. Add a host to allow one.'
            : 'The page may only reach the hosts listed here.'}
        </p>
      </div>
    </div>
  )
}
