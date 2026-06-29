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
  return fields.map((f) => ({
    label: f.key,
    type: f.children ? 'class' : 'property',
    detail: f.isArray ? `${f.type}[]` : f.type,
    boost: 60,
  }))
}

function exprCompletionSource(variables: VariableDecl[], nodeContext: NodeOutputSchema[]) {
  const varComps = variableCompletions(variables)
  const fnComps = functionCompletions()
  const rootComps = rootCompletions()
  const byId = new Map(nodeContext.map((s) => [s.nodeId, s]))

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.sliceDoc(0, context.pos)

    // 2/3/4. NodeOutputs deep path: NodeOutputs["id"]…[" → field keys.
    const pathMatch = NODEOUT_PATH_RE.exec(before)
    if (pathMatch) {
      const [, nodeId, midSegments, typed] = pathMatch
      const schema = byId.get(nodeId)
      if (schema) {
        const segments = parseSegments(midSegments)
        const fields = fieldsAtPath(schema, segments)
        const from = context.pos - typed.length
        return { from, options: fieldCompletions(fields), validFor: /^[^"]*$/ }
      }
    }

    // 2. NodeOutputs[" → upstream node ids (labelled by friendly node name).
    const idMatch = NODEOUT_ID_RE.exec(before)
    if (idMatch) {
      const typed = idMatch[1]
      const from = context.pos - typed.length
      const options: Completion[] = nodeContext.map((s) => ({
        label: s.nodeId,
        displayLabel: s.nodeLabel,
        apply: s.nodeId,
        type: 'namespace',
        detail: s.nodeType,
        boost: 70,
      }))
      return { from, options, validFor: /^[^"]*$/ }
    }

    // 1. Vars/Times/Context[" → variable names.
    const bracket = VAR_BRACKET_RE.exec(before)
    if (bracket) {
      const typed = bracket[2]
      const from = context.pos - typed.length
      return { from, options: varComps, validFor: /^[^"]*$/ }
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
