// Postman-style config UI for the http_request node: a method + URL bar,
// then Params/Headers/Body/Auth tabs. Reuses this codebase's existing
// building blocks throughout — KeyValueRows (headers/params/form-body rows),
// ExpressionField (single-value static/expression toggle, from the
// form-builder package), and the FormReferenceSelect async-picker pattern
// (adapted here for picking a saved app credential by name).

import { useMemo, useState } from 'react'
import {
  Check, ChevronsUpDown, Loader2, KeyRound, Table2, ChevronDown, ChevronRight,
  Plus, Trash2,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { KeyValueRows } from '../KeyValueRows'
import { useCredentials } from '@/features/app-settings/hooks'
import { nanoid } from '../nanoid'
import { ensureKeyValueIds, ensureResponseSchemaIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type {
  VariableDecl, HttpRequestConfig, HTTPMethod, HTTPAuthType, HTTPBodyMode, ValueMode,
  ResponseSchema, ResponseSchemaField, ResponseFieldType, ResponseSchemaKind, ResponseSchemaSource,
} from '../../types'

const METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']

export function normaliseHttpRequestConfig(raw: unknown): HttpRequestConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HttpRequestConfig>
  return {
    method:  r.method ?? 'GET',
    url_mode: r.url_mode ?? 'static',
    url: r.url ?? '',
    url_expr: r.url_expr ?? '',
    params:  ensureKeyValueIds(r.params),
    headers: ensureKeyValueIds(r.headers),
    body_mode: r.body_mode ?? 'none',
    body_value_mode: r.body_value_mode ?? 'static',
    body_value: r.body_value ?? '',
    body_expression: r.body_expression ?? '',
    body_raw_content_type: r.body_raw_content_type ?? '',
    body_form: ensureKeyValueIds(r.body_form),
    auth_type: r.auth_type ?? 'none',
    auth_credential: r.auth_credential ?? '',
    auth_username_mode: r.auth_username_mode ?? 'static',
    auth_username: r.auth_username ?? '',
    auth_username_expr: r.auth_username_expr ?? '',
    auth_password_mode: r.auth_password_mode ?? 'static',
    auth_password: r.auth_password ?? '',
    auth_password_expr: r.auth_password_expr ?? '',
    auth_token_mode: r.auth_token_mode ?? 'static',
    auth_token: r.auth_token ?? '',
    auth_token_expr: r.auth_token_expr ?? '',
    auth_api_key_name: r.auth_api_key_name ?? '',
    auth_api_key_location: r.auth_api_key_location ?? 'header',
    auth_api_key_value_mode: r.auth_api_key_value_mode ?? 'static',
    auth_api_key_value: r.auth_api_key_value ?? '',
    auth_api_key_value_expr: r.auth_api_key_value_expr ?? '',
    timeout_ms: r.timeout_ms,
    output_var: r.output_var ?? '',
    response_schemas: ensureResponseSchemaIds(r.response_schemas),
  }
}

export interface HttpRequestFormProps {
  config: HttpRequestConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: HttpRequestConfig) => void
}

export function HttpRequestForm({ config, variables, nodeContext, onChange }: HttpRequestFormProps) {
  const set = (patch: Partial<HttpRequestConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Method + URL bar */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Request</Label>
        <div className="flex gap-1.5">
          <select
            value={config.method}
            onChange={(e) => set({ method: e.target.value as HTTPMethod })}
            className="w-24 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-slate-700 focus:border-cyan-400 focus:outline-none"
          >
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="min-w-0 flex-1">
            {config.url_mode === 'expression' ? (
              <ExpressionField
                value={config.url_expr ?? ''}
                onChange={(v) => set({ url_expr: v })}
                variables={variables}
                nodeContext={nodeContext}
                placeholder='AppSettings["base_url"] + "/items"'
                label="url"
              />
            ) : (
              <Input
                value={config.url ?? ''}
                onChange={(e) => set({ url: e.target.value })}
                placeholder="https://api.example.com/items"
                className="h-8 font-mono text-[12px]"
              />
            )}
          </div>
        </div>
        <ModeToggle
          mode={config.url_mode ?? 'static'}
          onChange={(m) => set({ url_mode: m })}
        />
      </div>

      <div className="h-px bg-slate-100" />

      <Tabs defaultValue="params">
        <TabsList className="w-full">
          <TabsTrigger value="params" className="flex-1">Params</TabsTrigger>
          <TabsTrigger value="headers" className="flex-1">Headers</TabsTrigger>
          <TabsTrigger value="body" className="flex-1">Body</TabsTrigger>
          <TabsTrigger value="auth" className="flex-1">Auth</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="mt-3">
          <KeyValueRows
            rows={config.params ?? []}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(rows) => set({ params: rows })}
            keyPlaceholder="param name"
            addLabel="Add param"
          />
        </TabsContent>

        <TabsContent value="headers" className="mt-3">
          <KeyValueRows
            rows={config.headers ?? []}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(rows) => set({ headers: rows })}
            keyPlaceholder="header name"
            addLabel="Add header"
          />
        </TabsContent>

        <TabsContent value="body" className="mt-3">
          <BodyTab config={config} variables={variables} nodeContext={nodeContext} onChange={set} />
        </TabsContent>

        <TabsContent value="auth" className="mt-3">
          <AuthTab config={config} variables={variables} nodeContext={nodeContext} onChange={set} />
        </TabsContent>
      </Tabs>

      <div className="h-px bg-slate-100" />

      <ResponseSchemaSection
        schemas={config.response_schemas ?? []}
        onChange={(response_schemas) => set({ response_schemas })}
      />

      <div className="h-px bg-slate-100" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timeout (ms)</Label>
        <Input
          type="number"
          min={0}
          value={config.timeout_ms ?? ''}
          onChange={(e) => set({ timeout_ms: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="30000"
          className="h-8 text-[12px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Store In (optional)</Label>
        <Input
          value={config.output_var ?? ''}
          onChange={(e) => set({ output_var: e.target.value })}
          placeholder="e.g. api_response"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-slate-400">
          The response (status/headers/body) is always available downstream as this node's output — this only
          also mirrors it into a workflow variable.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static/Expression mode toggle — same visual language as AssignmentRow's
// Static/Expression buttons in SetVariableForm.tsx.
// ---------------------------------------------------------------------------

function ModeToggle({ mode, onChange }: { mode: ValueMode; onChange: (m: ValueMode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {(['static', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {m === 'static' ? 'Static' : 'Expression'}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Response Output Schema — maps paths in the parsed response (body/headers)
// into named, typed fields so they become individually addressable in the
// downstream expression editor, instead of the opaque `body: any` output.
// Standalone from the form/FieldDef system — see types.ts's ResponseSchema.
// ---------------------------------------------------------------------------

const RESPONSE_FIELD_TYPES: ResponseFieldType[] = ['string', 'integer', 'float', 'boolean', 'datetime', 'time', 'object']

function newResponseSchema(): ResponseSchema {
  return { id: nanoid(), name: '', kind: 'list', source: 'body', fields: [] }
}

function newResponseSchemaField(): ResponseSchemaField {
  return { id: nanoid(), path: '', type: 'string', name: '' }
}

function ResponseSchemaSection({ schemas, onChange }: {
  schemas: ResponseSchema[]
  onChange: (schemas: ResponseSchema[]) => void
}) {
  const [open, setOpen] = useState(true)

  const addSchema = () => onChange([...schemas, newResponseSchema()])
  const updateSchema = (id: string, patch: Partial<ResponseSchema>) =>
    onChange(schemas.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const removeSchema = (id: string) => onChange(schemas.filter((s) => s.id !== id))

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <Table2 size={12} className="text-cyan-500" />
        <Label className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Output Schema
        </Label>
        {schemas.length > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {schemas.length}
          </span>
        )}
        <span className="ml-auto text-slate-400">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {open && (
        <div className="space-y-2.5">
          <p className="text-[10px] text-slate-400">
            Map JSONPath into named, typed fields — they'll show up as their own entry in the downstream
            expression editor, e.g. <span className="font-mono text-cyan-600">Users → Id</span>. A{' '}
            <span className="font-mono text-cyan-600">List Of Objects</span> schema becomes a real array you
            can drop into an Iterator's source list, with each field autocompleting inside the loop body.
          </p>

          {schemas.map((s) => (
            <SchemaCard
              key={s.id}
              schema={s}
              onChange={(patch) => updateSchema(s.id, patch)}
              onRemove={() => removeSchema(s.id)}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addSchema}
            className="h-7 w-full gap-1.5 border-dashed text-[11px] text-slate-500 hover:text-slate-700"
          >
            <Plus size={12} /> Add New Schema
          </Button>
        </div>
      )}
    </div>
  )
}

function SchemaCard({ schema, onChange, onRemove }: {
  schema: ResponseSchema
  onChange: (patch: Partial<ResponseSchema>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(true)

  const addField = () => onChange({ fields: [...schema.fields, newResponseSchemaField()] })
  const updateField = (id: string, patch: Partial<ResponseSchemaField>) =>
    onChange({ fields: schema.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const removeField = (id: string) => onChange({ fields: schema.fields.filter((f) => f.id !== id) })

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      {/* Card header */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-2.5 py-2">
        <button
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          title="Remove schema"
        >
          <Trash2 size={12} />
        </button>
        <Input
          value={schema.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Schema name, e.g. Users"
          className="h-7 min-w-0 flex-1 text-[12px] font-semibold"
        />
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          title={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 p-2.5">
          {/* Type + Source */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-400">Type</p>
              <div className="flex gap-1 rounded-lg bg-white border border-slate-200 p-1">
                {(['list', 'single'] as ResponseSchemaKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onChange({ kind: k })}
                    className={cn(
                      'flex-1 rounded-md py-1 text-[10.5px] font-medium transition-colors',
                      schema.kind === k ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {k === 'list' ? 'List Of Objects' : 'Single Object'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-400">Source</p>
              <div className="flex gap-1 rounded-lg bg-white border border-slate-200 p-1">
                {(['body', 'headers'] as ResponseSchemaSource[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onChange({ source: src })}
                    className={cn(
                      'flex-1 rounded-md py-1 text-[10.5px] font-medium capitalize transition-colors',
                      schema.source === src ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Field rows */}
          <div className="space-y-1.5">
            {schema.fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 p-2.5 text-center text-[10.5px] text-slate-400">
                No fields yet — add one below.
              </p>
            )}
            {schema.fields.map((f) => (
              <SchemaFieldRow
                key={f.id}
                field={f}
                source={schema.source}
                onChange={(patch) => updateField(f.id, patch)}
                onRemove={() => removeField(f.id)}
              />
            ))}
          </div>

          <p className="text-[10px] text-slate-400">
            Declared type is applied on a best-effort basis (e.g. a numeric string becomes a real number) —
            a value that can't be converted is published as extracted rather than failing the request.
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={addField}
            className="h-7 w-full gap-1.5 border-dashed text-[11px] text-slate-500 hover:text-slate-700"
          >
            <Plus size={12} /> Add field
          </Button>
        </div>
      )}
    </div>
  )
}

function SchemaFieldRow({ field, source, onChange, onRemove }: {
  field: ResponseSchemaField
  source: ResponseSchemaSource
  onChange: (patch: Partial<ResponseSchemaField>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={field.path}
        onChange={(e) => onChange({ path: e.target.value })}
        placeholder={source === 'headers' ? 'header name, e.g. content-type' : 'JSONPath, e.g. address.geo.lat'}
        className="h-7 min-w-0 flex-1 font-mono text-[11px]"
      />
      <span className="shrink-0 text-[11px] text-slate-300">=</span>
      <select
        value={field.type}
        onChange={(e) => onChange({ type: e.target.value as ResponseFieldType })}
        className="h-7 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] capitalize text-slate-700 focus:border-cyan-400 focus:outline-none"
      >
        {RESPONSE_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Input
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="e.g. Id"
        className="h-7 min-w-0 flex-1 text-[11px]"
      />
      <button
        onClick={onRemove}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400"
        title="Remove field"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Body tab
// ---------------------------------------------------------------------------

function BodyTab({ config, variables, nodeContext, onChange }: {
  config: HttpRequestConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<HttpRequestConfig>) => void
}) {
  const mode = config.body_mode ?? 'none'

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['none', 'json', 'form', 'raw'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ body_mode: m as HTTPBodyMode })}
            className={cn(
              'flex-1 rounded-md py-1 text-[11px] font-medium capitalize transition-colors',
              mode === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'none' && (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
          This request has no body.
        </p>
      )}

      {(mode === 'json' || mode === 'raw') && (
        <div className="space-y-2">
          {mode === 'raw' && (
            <Input
              value={config.body_raw_content_type ?? ''}
              onChange={(e) => onChange({ body_raw_content_type: e.target.value })}
              placeholder="Content-Type, e.g. text/plain"
              className="h-7 font-mono text-[11px]"
            />
          )}
          <ModeToggle
            mode={config.body_value_mode ?? 'static'}
            onChange={(m) => onChange({ body_value_mode: m })}
          />
          {config.body_value_mode === 'expression' ? (
            <ExpressionField
              value={config.body_expression ?? ''}
              onChange={(v) => onChange({ body_expression: v })}
              variables={variables}
              nodeContext={nodeContext}
              placeholder='Vars["payload"]'
              label="body"
            />
          ) : (
            <textarea
              value={config.body_value ?? ''}
              onChange={(e) => onChange({ body_value: e.target.value })}
              placeholder={mode === 'json' ? '{\n  "key": "value"\n}' : 'raw body text…'}
              rows={6}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          )}
        </div>
      )}

      {mode === 'form' && (
        <KeyValueRows
          rows={config.body_form ?? []}
          variables={variables}
          nodeContext={nodeContext}
          onChange={(rows) => onChange({ body_form: rows })}
          keyPlaceholder="field name"
          addLabel="Add field"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auth tab
// ---------------------------------------------------------------------------

const AUTH_TYPE_LABELS: Record<HTTPAuthType, string> = {
  none: 'None',
  basic: 'Basic Auth',
  bearer: 'Bearer Token',
  api_key: 'API Key',
  credential: 'Saved Credential',
}

function AuthTab({ config, variables, nodeContext, onChange }: {
  config: HttpRequestConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<HttpRequestConfig>) => void
}) {
  const authType = config.auth_type ?? 'none'

  return (
    <div className="space-y-3">
      <select
        value={authType}
        onChange={(e) => onChange({ auth_type: e.target.value as HTTPAuthType })}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 focus:border-cyan-400 focus:outline-none"
      >
        {(Object.keys(AUTH_TYPE_LABELS) as HTTPAuthType[]).map((t) => (
          <option key={t} value={t}>{AUTH_TYPE_LABELS[t]}</option>
        ))}
      </select>

      {authType === 'none' && (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
          No authentication.
        </p>
      )}

      {authType === 'basic' && (
        <div className="space-y-2">
          <StaticOrExprField
            label="Username"
            mode={config.auth_username_mode ?? 'static'}
            value={config.auth_username ?? ''}
            expression={config.auth_username_expr ?? ''}
            variables={variables}
            nodeContext={nodeContext}
            onModeChange={(m) => onChange({ auth_username_mode: m })}
            onValueChange={(v) => onChange({ auth_username: v })}
            onExpressionChange={(v) => onChange({ auth_username_expr: v })}
          />
          <StaticOrExprField
            label="Password"
            mode={config.auth_password_mode ?? 'static'}
            value={config.auth_password ?? ''}
            expression={config.auth_password_expr ?? ''}
            variables={variables}
            nodeContext={nodeContext}
            secret
            onModeChange={(m) => onChange({ auth_password_mode: m })}
            onValueChange={(v) => onChange({ auth_password: v })}
            onExpressionChange={(v) => onChange({ auth_password_expr: v })}
          />
        </div>
      )}

      {authType === 'bearer' && (
        <StaticOrExprField
          label="Token"
          mode={config.auth_token_mode ?? 'static'}
          value={config.auth_token ?? ''}
          expression={config.auth_token_expr ?? ''}
          variables={variables}
          nodeContext={nodeContext}
          secret
          onModeChange={(m) => onChange({ auth_token_mode: m })}
          onValueChange={(v) => onChange({ auth_token: v })}
          onExpressionChange={(v) => onChange({ auth_token_expr: v })}
        />
      )}

      {authType === 'api_key' && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Key name</label>
            <Input
              value={config.auth_api_key_name ?? ''}
              onChange={(e) => onChange({ auth_api_key_name: e.target.value })}
              placeholder="e.g. X-API-Key"
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['header', 'query'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => onChange({ auth_api_key_location: loc })}
                className={cn(
                  'flex-1 rounded-md py-1 text-[11px] font-medium capitalize transition-colors',
                  (config.auth_api_key_location ?? 'header') === loc ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400',
                )}
              >
                {loc}
              </button>
            ))}
          </div>
          <StaticOrExprField
            label="Value"
            mode={config.auth_api_key_value_mode ?? 'static'}
            value={config.auth_api_key_value ?? ''}
            expression={config.auth_api_key_value_expr ?? ''}
            variables={variables}
            nodeContext={nodeContext}
            secret
            onModeChange={(m) => onChange({ auth_api_key_value_mode: m })}
            onValueChange={(v) => onChange({ auth_api_key_value: v })}
            onExpressionChange={(v) => onChange({ auth_api_key_value_expr: v })}
          />
        </div>
      )}

      {authType === 'credential' && (
        <div className="space-y-1.5">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Credential</label>
          <CredentialSelect
            value={config.auth_credential || undefined}
            onChange={(name) => onChange({ auth_credential: name ?? '' })}
          />
        </div>
      )}
    </div>
  )
}

// A labeled field with a Static/Expression toggle, used for the auth tab's
// username/password/token/api-key-value fields.
function StaticOrExprField({
  label, mode, value, expression, variables, nodeContext, secret,
  onModeChange, onValueChange, onExpressionChange,
}: {
  label: string
  mode: ValueMode
  value: string
  expression: string
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  secret?: boolean
  onModeChange: (m: ValueMode) => void
  onValueChange: (v: string) => void
  onExpressionChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-slate-500">{label}</label>
      <ModeToggle mode={mode} onChange={onModeChange} />
      {mode === 'expression' ? (
        <ExpressionField
          value={expression}
          onChange={onExpressionChange}
          variables={variables}
          nodeContext={nodeContext}
          label={label}
        />
      ) : (
        <Input
          type={secret ? 'password' : 'text'}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="h-7 font-mono text-[11px]"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Credential picker — adapted from FormReferenceSelect.tsx's async
// searchable-combobox pattern, swapping useForms() for useCredentials().
// ---------------------------------------------------------------------------

function CredentialSelect({ value, onChange }: { value?: string; onChange: (name: string | undefined) => void }) {
  const { data: credentials, isLoading } = useCredentials()
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => (credentials ?? []).find((c) => c.name === value),
    [credentials, value],
  )
  const isBroken = !!value && !isLoading && !selected

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 w-full justify-between gap-2 px-2.5 text-[12px] font-normal',
            !value && 'text-slate-400',
            isBroken && 'border-amber-300',
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <KeyRound size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {isLoading && !selected
                ? 'Loading credentials…'
                : selected
                  ? selected.name
                  : isBroken
                    ? 'Unavailable credential'
                    : 'Select a credential…'}
            </span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search credentials…" />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
                <Loader2 size={13} className="animate-spin" /> Loading credentials…
              </div>
            ) : (
              <>
                <CommandEmpty>No credentials found. Add one in Global Settings.</CommandEmpty>
                <CommandGroup>
                  {(credentials ?? []).map((c) => (
                    <CommandItem
                      key={c.name}
                      value={c.name}
                      onSelect={() => { onChange(c.name === value ? undefined : c.name); setOpen(false) }}
                    >
                      <Check size={14} className={cn('shrink-0', c.name === value ? 'opacity-100 text-cyan-600' : 'opacity-0')} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{c.name}</span>
                        <span className="truncate font-mono text-[10px] text-slate-400">{c.type}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
