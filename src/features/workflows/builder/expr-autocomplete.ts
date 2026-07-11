// CodeMirror autocomplete + bracket-closing for the Expr language.
//
// Provides these kinds of completions:
//   1. Inside Vars[" / Times[" / Context[" → declared variable names
//   2. Inside NodeOutputs[" → upstream node ids (labelled by friendly node name)
//   3. Inside NodeOutputs["id"][" → that node's output field keys
//   4. Inside NodeOutputs["id"]["records"][0][" → the record's field keys
//   5. Bare identifiers → built-in functions + roots
//
// The variable list and upstream node-output context are passed at editor build.

import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import { EXPR_FUNCTIONS, EXPR_ROOTS } from './expr-meta'
import type { VariableDecl } from '../types'
import type { NodeOutputSchema, OutputField } from './node-output-schema'

// Vars/Times/Context string-key access (NodeOutputs handled separately below).
const VAR_BRACKET_RE = /(Vars|Times|Context)\s*\[\s*"([^"]*)$/

// Vars["item"][ "path"... ][ "  — deep path into a loop-scoped var (the cursor
// is in a LATER bracket). Captures the top-level var key, the closed segments,
// and the in-progress key, so we can walk the var's inferred field shape.
const VARS_PATH_RE = /Vars\s*\[\s*"([^"]+)"\s*\]((?:\s*\[\s*(?:"[^"]*"|\d+)\s*\])+)\s*\[\s*"([^"]*)$/

// NodeOutputs["  — cursor inside the FIRST bracket (choosing the node id).
const NODEOUT_ID_RE = /NodeOutputs\s*\[\s*"([^"]*)$/

// NodeOutputs["id"][ "path"... ][ "  — cursor inside a LATER bracket. Captures
// the node id and the already-typed bracket segments so we can walk the schema.
const NODEOUT_PATH_RE = /NodeOutputs\s*\[\s*"([^"]+)"\s*\]((?:\s*\[\s*(?:"[^"]*"|\d+)\s*\])*)\s*\[\s*"([^"]*)$/

function variableCompletions(variables: VariableDecl[]): Completion[] {
  return variables.map((v) => ({
    label: v.name,
    type: 'variable',
    detail: v.type,
    boost: 50,
  }))
}

function functionCompletions(): Completion[] {
  return EXPR_FUNCTIONS.map((f) => ({
    label: f.name,
    type: 'function',
    detail: f.signature.replace(f.name, '').trim(),
    info: f.description,
    apply: f.name,
    boost: 10,
  }))
}

function rootCompletions(): Completion[] {
  return EXPR_ROOTS.map((r) => ({
    label: r.name,
    type: 'namespace',
    detail: r.detail,
    info: r.description,
    boost: 30,
  }))
}

// Resolve the field list reachable at a given segment path within a node schema.
// segments are the already-closed bracket keys after the node id, e.g.
// ["records", "0"] → returns the record's child fields.
function fieldsAtPath(schema: NodeOutputSchema, segments: string[]): OutputField[] {
  let fields = schema.fields
  for (const seg of segments) {
    if (/^\d+$/.test(seg)) continue // array index — stay at element type
    const match = fields.find((f) => f.key === seg)
    if (!match || !match.children) return []
    fields = match.children
  }
  return fields
}

// Parse the closed bracket segments out of the middle capture (e.g. `["records"][0]`).
function parseSegments(raw: string): string[] {
  const out: string[] = []
  const re = /\[\s*(?:"([^"]*)"|(\d+))\s*\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) out.push(m[1] ?? m[2] ?? '')
  return out
}

function fieldCompletions(fields: OutputField[]): Completion[] {
  return fields.map((f) => {
    const t = f.isArray ? `${f.type}[]` : f.type
    // `label` must stay the key (it's what gets inserted into the Expr path);
    // surface the human-readable form label + type as the detail.
    const detail = f.label && f.label !== f.key ? `${f.label} · ${t}` : t
    return {
      label: f.key,
      type: f.children ? 'class' : 'property',
      detail,
      boost: 60,
    }
  })
}

function exprCompletionSource(variables: VariableDecl[], nodeContext: NodeOutputSchema[]) {
  const varComps = variableCompletions(variables)
  const fnComps = functionCompletions()
  const rootComps = rootCompletions()
  // One node id can now map to MULTIPLE schema entries (e.g. an http_request
  // node's base fields plus one entry per named response schema — see
  // node-output-schema.ts's buildNodeOutputSchema). Group by id rather than
  // keeping only the last one, so completions merge every entry's fields
  // instead of the later entries silently shadowing the earlier ones.
  const byId = new Map<string, NodeOutputSchema[]>()
  for (const s of nodeContext) {
    if (s.root === 'vars') continue
    const list = byId.get(s.nodeId)
    if (list) list.push(s)
    else byId.set(s.nodeId, [s])
  }

  // Loop-scoped vars (root: 'vars') expose their top-level fields directly under
  // Vars["name"] — collect them by key so we can complete the name and drill in.
  const varFieldsByKey = new Map<string, OutputField>()
  for (const s of nodeContext) {
    if (s.root !== 'vars') continue
    for (const f of s.fields) varFieldsByKey.set(f.key, f)
  }
  const loopVarComps: Completion[] = [...varFieldsByKey.keys()].map((key) => ({
    label: key, type: 'variable', detail: 'loop', boost: 65,
  }))

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.sliceDoc(0, context.pos)

    // Vars["item"]…[" → drill into a loop var's inferred fields.
    const varsPath = VARS_PATH_RE.exec(before)
    if (varsPath) {
      const [, topKey, midSegments, typed] = varsPath
      const root = varFieldsByKey.get(topKey)
      if (root) {
        // Walk from the root var's children through the closed segments.
        const fields = fieldsAtPath({ fields: root.children ?? [] } as NodeOutputSchema, parseSegments(midSegments))
        const from = context.pos - typed.length
        return { from, options: fieldCompletions(fields), validFor: /^[^"]*$/ }
      }
    }

    // 2/3/4. NodeOutputs deep path: NodeOutputs["id"]…[" → field keys.
    const pathMatch = NODEOUT_PATH_RE.exec(before)
    if (pathMatch) {
      const [, nodeId, midSegments, typed] = pathMatch
      const schemas = byId.get(nodeId)
      if (schemas) {
        // Merge every schema sharing this node id into one flat top-level
        // field list before walking segments — e.g. an http_request node's
        // base fields (status_code/body/…) plus each named response schema's
        // fields (Id/Name/Email/…) all need to be reachable here.
        const merged: NodeOutputSchema = { ...schemas[0], fields: schemas.flatMap((s) => s.fields) }
        const segments = parseSegments(midSegments)
        const fields = fieldsAtPath(merged, segments)
        const from = context.pos - typed.length
        return { from, options: fieldCompletions(fields), validFor: /^[^"]*$/ }
      }
    }

    // 2. NodeOutputs[" → upstream node ids (labelled by friendly node name).
    // One id can appear multiple times in nodeContext (see byId above) — only
    // offer it once here, keeping the first (base) entry's label.
    const idMatch = NODEOUT_ID_RE.exec(before)
    if (idMatch) {
      const typed = idMatch[1]
      const from = context.pos - typed.length
      const options: Completion[] = [...byId.values()].map(([s]) => ({
        label: s.nodeId,
        displayLabel: s.nodeLabel,
        apply: s.nodeId,
        type: 'namespace',
        detail: s.nodeType,
        boost: 70,
      }))
      return { from, options, validFor: /^[^"]*$/ }
    }

    // 1. Vars/Times/Context[" → variable names (+ loop-scoped item/index for Vars).
    const bracket = VAR_BRACKET_RE.exec(before)
    if (bracket) {
      const typed = bracket[2]
      const from = context.pos - typed.length
      const opts = bracket[1] === 'Vars' ? [...loopVarComps, ...varComps] : varComps
      return { from, options: opts, validFor: /^[^"]*$/ }
    }

    // 5. Bare word → functions + roots.
    const word = context.matchBefore(/[\w]+/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    return {
      from: word.from,
      options: [...rootComps, ...fnComps],
      validFor: /^[\w]*$/,
    }
  }
}

/** Builds the full set of editor extensions for Expr authoring assistance. */
export function exprAssist(variables: VariableDecl[], nodeContext: NodeOutputSchema[] = []) {
  return [
    closeBrackets(),
    autocompletion({
      override: [exprCompletionSource(variables, nodeContext)],
      icons: true,
      activateOnTyping: true,
    }),
    keymap.of([...closeBracketsKeymap, ...completionKeymap]),
  ]
}
