import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import {
  Search, X, Check, Braces, FunctionSquare, ChevronRight, ChevronDown,
  Loader2, CircleAlert, CircleCheck, Eye, Variable as VariableIcon, Database, Workflow,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { validateExpression, type ExpressionValidateResult } from '@/lib/api'
import { exprAssist } from './expr-autocomplete'
import {
  EXPR_FUNCTIONS, FUNCTION_CATEGORIES, EXPR_ROOTS, CONTEXT_ENTRIES, CURRENT_USER_ENTRIES, type ExprFunction,
} from './expr-meta'
import { outputFieldPath, type NodeOutputSchema, type OutputField } from './node-output-schema'
import type { VariableDecl } from '../types'

// ---------------------------------------------------------------------------
// Debounced backend validation hook
// ---------------------------------------------------------------------------

interface ValidationState {
  status: 'idle' | 'checking' | 'valid' | 'invalid'
  result: ExpressionValidateResult | null
}

function useExpressionValidation(expression: string, variables: VariableDecl[], enabled: boolean): ValidationState {
  const [state, setState] = useState<ValidationState>({ status: 'idle', result: null })
  // Stabilise the variable dependency: only the name+type pairs affect validation.
  const varsKey = useMemo(() => variables.map((v) => `${v.name}:${v.type}`).join(','), [variables])

  useEffect(() => {
    if (!enabled) return
    if (!expression.trim()) {
      setState({ status: 'idle', result: null })
      return
    }

    setState((s) => ({ ...s, status: 'checking' }))
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const result = await validateExpression(
          { expression, variables, evaluate: true },
          controller.signal,
        )
        setState({ status: result.valid ? 'valid' : 'invalid', result })
      } catch {
        if (controller.signal.aborted) return
        // Network/server error — don't block the user, just clear the indicator.
        setState({ status: 'idle', result: null })
      }
    }, 400)

    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [expression, varsKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

// ---------------------------------------------------------------------------
// CodeMirror editor with autocomplete + lint diagnostics
// ---------------------------------------------------------------------------

interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  diagnostic: Diagnostic | null
  editorRef?: React.MutableRefObject<EditorView | null>
}

function CodeEditor({ value, onChange, variables, nodeContext, diagnostic, editorRef }: CodeEditorProps) {
  const domRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lintCompartment = useRef(new Compartment())
  const diagnosticRef = useRef<Diagnostic | null>(diagnostic)
  diagnosticRef.current = diagnostic

  // A linter that reports whatever the latest backend diagnostic says.
  const makeLinter = useCallback(() =>
    linter(() => {
      const d = diagnosticRef.current
      return d ? [d] : []
    }), [])

  useEffect(() => {
    if (!domRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          lineNumbers(),
          lintGutter(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          javascript(),
          ...exprAssist(variables, nodeContext),
          lintCompartment.current.of(makeLinter()),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { fontSize: '13px', borderRadius: '10px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', overflow: 'hidden' },
            '.cm-content': { fontFamily: "'Fira Mono', 'Cascadia Code', 'Consolas', monospace", padding: '12px 4px', minHeight: '160px', caretColor: 'hsl(var(--primary))' },
            '.cm-focused': { outline: 'none' },
            '&.cm-focused': { borderColor: 'hsl(var(--primary))', boxShadow: '0 0 0 3px hsl(var(--primary) / 0.15)' },
            '.cm-gutters': { background: 'hsl(var(--muted))', border: 'none', borderRight: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' },
            '.cm-lineNumbers .cm-gutterElement': { minWidth: '26px', padding: '0 6px 0 8px' },
            '.cm-activeLine': { background: 'hsl(var(--primary) / 0.06)' },
            '.cm-activeLineGutter': { background: 'transparent', color: 'hsl(var(--muted-foreground))' },
            '.cm-matchingBracket': { background: 'hsl(var(--primary) / 0.2)', outline: '1px solid hsl(var(--primary) / 0.4)', borderRadius: '2px' },
            '.cm-selectionBackground, ::selection': { background: 'hsl(var(--primary) / 0.2) !important' },
            '.cm-tooltip': { border: '1px solid hsl(var(--border))', borderRadius: '8px', background: 'hsl(var(--card))', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' },
            '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' },
            '.cm-tooltip-autocomplete ul li': { padding: '3px 8px', fontFamily: "'Fira Mono', monospace", fontSize: '12px' },
            '.cm-completionDetail': { color: 'hsl(var(--muted-foreground))', fontStyle: 'normal', marginLeft: '8px' },
            '.cm-diagnostic-error': { borderLeft: '3px solid hsl(var(--destructive))' },
            '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '2px wavy hsl(var(--destructive))', textDecoration: 'underline wavy hsl(var(--destructive))' },
          }),
        ],
      }),
      parent: domRef.current,
    })

    viewRef.current = view
    if (editorRef) editorRef.current = view
    return () => {
      view.destroy()
      if (editorRef) editorRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Push external value changes without clobbering the cursor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  // Re-run the linter whenever the backend diagnostic changes.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: lintCompartment.current.reconfigure(makeLinter()) })
  }, [diagnostic, makeLinter])

  return <div ref={domRef} className="w-full" />
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

const TYPE_COLORS: Record<string, string> = {
  string:   'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  integer:  'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  float:    'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  boolean:  'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
  time:     'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  datetime: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  array:    'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  object:   'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  nil:      'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]/70',
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ---------------------------------------------------------------------------
// Main ExpressionEditor dialog
// ---------------------------------------------------------------------------

interface ExpressionEditorProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (v: string) => void
  variables: VariableDecl[]
  /** Outputs of upstream nodes available at this execution point. */
  nodeContext?: NodeOutputSchema[]
  label?: string
}

export function ExpressionEditor({ open, onClose, value, onChange, variables, nodeContext = [], label }: ExpressionEditorProps) {
  const [draft, setDraft]       = useState(value)
  const [varSearch, setVarSearch]   = useState('')
  const [fnSearch, setFnSearch]     = useState('')
  const [fnCategory, setFnCategory] = useState('All')
  const editorRef = useRef<EditorView | null>(null)

  useEffect(() => { if (open) setDraft(value) }, [open, value])

  const validation = useExpressionValidation(draft, variables, open)

  // Map a backend compile error to a CodeMirror diagnostic spanning the doc.
  const diagnostic: Diagnostic | null = useMemo(() => {
    if (validation.status !== 'invalid' || !validation.result?.error) return null
    if (validation.result.stage !== 'compile') return null // eval errors aren't syntax
    return {
      from: 0,
      to: Math.max(1, draft.length),
      severity: 'error',
      message: validation.result.error,
    }
  }, [validation, draft])

  const handleSave = useCallback(() => { onChange(draft); onClose() }, [draft, onChange, onClose])

  const insert = useCallback((text: string) => {
    if (editorRef.current) {
      insertAtCursor(editorRef.current, text)
      setDraft(editorRef.current.state.doc.toString())
    } else {
      setDraft((d) => d + text)
    }
  }, [])

  const filteredVars = variables.filter((v) => v.name.toLowerCase().includes(varSearch.toLowerCase()))
  const filteredFns = EXPR_FUNCTIONS.filter((f) => {
    const matchCat = fnCategory === 'All' || f.category === fnCategory
    const matchSearch = !fnSearch || f.name.toLowerCase().includes(fnSearch.toLowerCase()) || f.description.toLowerCase().includes(fnSearch.toLowerCase())
    return matchCat && matchSearch
  })

  // Split workflow variables into time-typed vs the rest for richer grouping.
  const timeVars = filteredVars.filter((v) => v.type === 'time' || v.type === 'datetime')

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex h-[82vh] w-[960px] max-w-[95vw] flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
              <Braces size={14} className="text-[hsl(var(--primary))]" />
            </div>
            Expression Editor
            {label && <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">— {label}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Left: editor + status + preview */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 border-r border-[hsl(var(--border))] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Expression</span>
              <StatusBadge state={validation} />
            </div>

            <div className="flex-1 overflow-auto">
              <CodeEditor
                value={draft}
                onChange={setDraft}
                variables={variables}
                nodeContext={nodeContext}
                diagnostic={diagnostic}
                editorRef={editorRef}
              />
            </div>

            {/* Error message */}
            {validation.status === 'invalid' && validation.result?.error && (
              <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-3 py-2 text-[11px] text-[hsl(var(--destructive))]">
                <CircleAlert size={13} className="mt-px shrink-0" />
                <div>
                  <span className="font-semibold capitalize">{validation.result.stage ?? 'error'}: </span>
                  <span className="font-mono">{validation.result.error}</span>
                </div>
              </div>
            )}

            {/* Live preview */}
            <PreviewPanel state={validation} />

            <div className="rounded-lg bg-[hsl(var(--muted))] p-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              <p className="mb-1 font-semibold text-[hsl(var(--foreground))]">Quick reference</p>
              <p><code className="text-[hsl(var(--primary))]">Vars["name"]</code> — workflow variable · <code className="text-[hsl(var(--primary))]">Times["name"]</code> — date variable</p>
              <p><code className="text-[hsl(var(--primary))]">NodeOutputs["id"]["field"]</code> — previous node output</p>
              <p><code className="text-[hsl(var(--primary))]">TriggerRecord["field_name"]</code> — the triggering record's field (record-triggered runs; nil otherwise)</p>
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">Type to autocomplete · <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1">Ctrl</kbd>+<kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1">Space</kbd> to trigger</p>
            </div>
          </div>

          {/* Right: variable + function browser */}
          <div className="flex w-80 shrink-0 flex-col">
            <Tabs defaultValue="variables" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-[hsl(var(--border))] px-3 pb-2 pt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="variables" className="flex-1 gap-1.5"><Braces size={12} />Variables</TabsTrigger>
                  <TabsTrigger value="functions" className="flex-1 gap-1.5"><FunctionSquare size={12} />Functions</TabsTrigger>
                </TabsList>
              </div>

              {/* Variables tab — categorized */}
              <TabsContent value="variables" className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
                <SearchBox value={varSearch} onChange={setVarSearch} placeholder="Search variables…" />
                <ScrollArea className="mt-2 flex-1">
                  <div className="space-y-4 pr-2">
                    {/* Upstream node outputs (context-aware) */}
                    {nodeContext.length > 0 && (
                      <VarGroup icon={<Database size={11} />} title="Workflow Context" count={nodeContext.length}>
                        {nodeContext.map((schema, i) => (
                          <NodeContextTree
                            key={`${schema.nodeId}-${i}`}
                            schema={schema}
                            search={varSearch}
                            onInsert={insert}
                          />
                        ))}
                      </VarGroup>
                    )}

                    {/* Workflow variables */}
                    <VarGroup icon={<Workflow size={11} />} title="Workflow Variables" count={filteredVars.length}>
                      {filteredVars.length === 0 ? (
                        <EmptyHint>{variables.length === 0 ? 'No variables declared' : 'No matches'}</EmptyHint>
                      ) : (
                        filteredVars.map((v) => (
                          <InsertRow
                            key={v.name}
                            mono={v.name}
                            sub={`Vars["${v.name}"]`}
                            badge={<TypeBadge type={v.type} />}
                            onClick={() => insert(`Vars["${v.name}"]`)}
                          />
                        ))
                      )}
                    </VarGroup>

                    {/* Date/time typed access */}
                    {timeVars.length > 0 && (
                      <VarGroup icon={<VariableIcon size={11} />} title="Dates (typed)" count={timeVars.length}>
                        {timeVars.map((v) => (
                          <InsertRow
                            key={v.name}
                            mono={v.name}
                            sub={`Times["${v.name}"]`}
                            badge={<TypeBadge type={v.type} />}
                            onClick={() => insert(`Times["${v.name}"]`)}
                          />
                        ))}
                      </VarGroup>
                    )}

                    {/* Context roots */}
                    <VarGroup icon={<Database size={11} />} title="Context" count={CONTEXT_ENTRIES!.length}>
                      {CONTEXT_ENTRIES!.map((e) => (
                        <InsertRow key={e.insert} mono={e.label} sub={e.insert} onClick={() => insert(e.insert)} />
                      ))}
                    </VarGroup>

                    {/* Current user (Search-menu filters only, FR-D2-013) */}
                    <VarGroup icon={<Database size={11} />} title="Current User (Search filters)" count={CURRENT_USER_ENTRIES!.length}>
                      {CURRENT_USER_ENTRIES!.map((e) => (
                        <InsertRow key={e.insert} mono={e.label} sub={e.insert} onClick={() => insert(e.insert)} />
                      ))}
                    </VarGroup>

                    {/* Environment roots reference */}
                    <VarGroup icon={<Database size={11} />} title="Environment Roots" count={EXPR_ROOTS.length}>
                      {EXPR_ROOTS.map((r) => (
                        <InsertRow key={r.name} mono={r.name} sub={r.description} onClick={() => insert(`${r.name}[""]`)} />
                      ))}
                    </VarGroup>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Functions tab */}
              <TabsContent value="functions" className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
                <SearchBox value={fnSearch} onChange={setFnSearch} placeholder="Search functions…" />
                <div className="my-2 flex flex-wrap gap-1">
                  {['All', ...FUNCTION_CATEGORIES].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFnCategory(cat)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                        fnCategory === cat ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/70',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1 pr-2">
                    {filteredFns.map((fn) => (
                      <FunctionRow key={fn.name} fn={fn} onClick={() => insert(fn.example)} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={validation.status === 'invalid' && validation.result?.stage === 'compile'}
            className="gap-1.5 disabled:opacity-50"
          >
            <Check size={14} />
            Apply Expression
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ state }: { state: ValidationState }) {
  if (state.status === 'checking') {
    return <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]"><Loader2 size={11} className="animate-spin" />Checking…</span>
  }
  if (state.status === 'valid') {
    return <span className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--success))]"><CircleCheck size={11} />Valid</span>
  }
  if (state.status === 'invalid') {
    return <span className="flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--destructive))]"><CircleAlert size={11} />Invalid</span>
  }
  return null
}

function PreviewPanel({ state }: { state: ValidationState }) {
  const preview = state.result?.preview
  if (state.status !== 'valid' || !preview) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-3 py-2">
      <Eye size={13} className="shrink-0 text-[hsl(var(--success))]" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--success))]">Preview</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[hsl(var(--foreground))]">{formatPreviewValue(preview.value)}</code>
      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[preview.type] ?? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
        {preview.type}
      </span>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pl-7 text-xs" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function VarGroup({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {icon}
        {title}
        <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 text-[9px] text-[hsl(var(--muted-foreground))]">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InsertRow({ mono, sub, badge, onClick }: { mono: string; sub: string; badge?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-lg border border-transparent px-2.5 py-1.5 text-left transition-colors hover:border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/10"
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-[12px] font-medium text-[hsl(var(--foreground))]">{mono}</p>
        <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {badge}
        <ChevronRight size={11} className="text-[hsl(var(--muted-foreground))]/60 group-hover:text-[hsl(var(--primary))]" />
      </div>
    </button>
  )
}

// Renders one upstream node's output as an expandable tree. Clicking a field
// inserts the real Expr path (NodeOutputs["id"]["records"][0]["email"]).
function NodeContextTree({ schema, search, onInsert }: {
  schema: NodeOutputSchema
  search: string
  onInsert: (text: string) => void
}) {
  const [open, setOpen] = useState(true)
  const q = search.trim().toLowerCase()

  // When searching, only render the node if any field key matches.
  const matches = (fields: OutputField[]): boolean =>
    fields.some((f) => f.key.toLowerCase().includes(q) || (f.children ? matches(f.children) : false))
  if (q && !matches(schema.fields)) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-t-lg bg-[hsl(var(--muted))] px-2 py-1.5 text-left"
      >
        {open ? <ChevronDown size={11} className="text-[hsl(var(--muted-foreground))]" /> : <ChevronRight size={11} className="text-[hsl(var(--muted-foreground))]" />}
        <Database size={11} className="text-[hsl(var(--primary))]" />
        <span className="truncate text-[11px] font-semibold text-[hsl(var(--foreground))]/80">{schema.nodeLabel}</span>
        <span className="ml-auto rounded bg-[hsl(var(--muted))] px-1 text-[9px] text-[hsl(var(--muted-foreground))]">{schema.nodeType}</span>
      </button>
      {open && (
        <div className="p-1">
          {schema.fields.map((f) => (
            <OutputFieldRow
              key={f.key}
              field={f}
              path={[f]}
              nodeId={schema.nodeId}
              root={schema.root ?? 'node_outputs'}
              search={q}
              depth={0}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OutputFieldRow({ field, path, nodeId, root, search, depth, onInsert }: {
  field: OutputField
  path: OutputField[]
  nodeId: string
  root: 'node_outputs' | 'vars'
  search: string
  depth: number
  onInsert: (text: string) => void
}) {
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = !!field.children && field.children.length > 0

  // Filter: keep this row if its label/key matches, or any descendant matches.
  const fieldMatches = (f: OutputField) =>
    f.key.toLowerCase().includes(search) || (f.label ?? '').toLowerCase().includes(search)
  const selfMatch = !search || fieldMatches(field)
  const childMatch = hasChildren && field.children!.some(fieldMatches)
  if (search && !selfMatch && !childMatch) return null

  const insertPath = outputFieldPath(nodeId, path, root)
  // Show the human-readable label; the raw key is a subtle hint when it differs.
  const display = field.label || field.key
  const showKeyHint = !!field.label && field.label !== field.key

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 10 }}>
        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} className="flex h-5 w-5 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <button
          onClick={() => onInsert(insertPath)}
          className="group flex flex-1 items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-[hsl(var(--primary))]/10"
          title={insertPath}
        >
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-[11px] text-[hsl(var(--foreground))]">
              {display}{field.isArray && <span className="text-[hsl(var(--muted-foreground))]">[ ]</span>}
            </span>
            {showKeyHint && (
              <span className="truncate font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{field.key}</span>
            )}
          </span>
          <span className="ml-1 shrink-0 rounded bg-[hsl(var(--muted))] px-1 text-[9px] text-[hsl(var(--muted-foreground))]">{field.type}</span>
        </button>
      </div>
      {hasChildren && open && (
        <div>
          {field.children!.map((c) => (
            <OutputFieldRow
              key={c.key}
              field={c}
              path={[...path, c]}
              nodeId={nodeId}
              root={root}
              search={search}
              depth={depth + 1}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FunctionRow({ fn, onClick }: { fn: ExprFunction; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/10"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[12px] font-semibold text-[hsl(var(--foreground))]">{fn.signature}</p>
        <span className="shrink-0 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))]">{fn.category}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{fn.description}</p>
      <p className="mt-0.5 truncate font-mono text-[9px] text-[hsl(var(--primary))]/70 opacity-0 transition-opacity group-hover:opacity-100">{fn.example}</p>
    </button>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">{children}</div>
}

function TypeBadge({ type }: { type: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[type] ?? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{type}</span>
}
