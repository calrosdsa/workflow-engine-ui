// Shared metadata about the Expr language: the built-in functions and the
// variable categories. Used by both the variable/function browser panel and
// the CodeMirror autocomplete source so they never drift apart.

export interface ExprFunction {
  name: string
  signature: string
  description: string
  example: string
  category: 'String' | 'Date/Time' | 'Regex' | 'Math' | 'Convert'
}

export const EXPR_FUNCTIONS: ExprFunction[] = [
  // String
  { name: 'upper',      signature: 'upper(s) string',                 description: 'Convert string to uppercase',          example: 'upper(Vars["name"])',                 category: 'String' },
  { name: 'lower',      signature: 'lower(s) string',                 description: 'Convert string to lowercase',          example: 'lower(Vars["code"])',                 category: 'String' },
  { name: 'trim',       signature: 'trim(s) string',                  description: 'Trim whitespace from both ends',       example: 'trim(Vars["input"])',                 category: 'String' },
  { name: 'trimPrefix', signature: 'trimPrefix(s, prefix) string',    description: 'Remove a leading prefix',              example: 'trimPrefix(Vars["path"], "/")',       category: 'String' },
  { name: 'trimSuffix', signature: 'trimSuffix(s, suffix) string',    description: 'Remove a trailing suffix',             example: 'trimSuffix(Vars["file"], ".txt")',    category: 'String' },
  { name: 'contains',   signature: 'contains(s, sub) bool',           description: 'Reports if s contains sub',            example: 'contains(Vars["text"], "hello")',     category: 'String' },
  { name: 'hasPrefix',  signature: 'hasPrefix(s, prefix) bool',       description: 'Reports if s starts with prefix',      example: 'hasPrefix(Vars["url"], "https")',     category: 'String' },
  { name: 'hasSuffix',  signature: 'hasSuffix(s, suffix) bool',       description: 'Reports if s ends with suffix',        example: 'hasSuffix(Vars["file"], ".pdf")',     category: 'String' },
  { name: 'replace',    signature: 'replace(s, old, new, n) string',  description: 'Replace occurrences (-1 = all)',       example: 'replace(Vars["s"], " ", "_", -1)',    category: 'String' },
  { name: 'split',      signature: 'split(s, sep) []string',          description: 'Split string by separator',            example: 'split(Vars["csv"], ",")',             category: 'String' },
  { name: 'join',       signature: 'join(arr, sep) string',           description: 'Join slice with separator',            example: 'join(Vars["tags"], ", ")',            category: 'String' },
  { name: 'len',        signature: 'len(v) int',                      description: 'Length of string / array / map',       example: 'len(Vars["items"])',                  category: 'String' },
  // Convert
  { name: 'int',        signature: 'int(v) int',                      description: 'Convert value to integer',             example: 'int(Vars["count"])',                  category: 'Convert' },
  { name: 'float',      signature: 'float(v) float',                  description: 'Convert value to float',               example: 'float(Vars["price"])',                category: 'Convert' },
  { name: 'string',     signature: 'string(v) string',                description: 'Convert value to string',              example: 'string(Vars["count"])',               category: 'Convert' },
  // Date/Time
  { name: 'now',            signature: 'now() time',                          description: 'Current UTC time',               example: 'now()',                                      category: 'Date/Time' },
  { name: 'FormatDate',     signature: 'FormatDate(t, layout) string',        description: 'Format a time value',            example: 'FormatDate(now(), "2006-01-02")',            category: 'Date/Time' },
  { name: 'FormatDateTime', signature: 'FormatDateTime(t, layout) string',    description: 'Format date + time',             example: 'FormatDateTime(now(), "2006-01-02 15:04")',  category: 'Date/Time' },
  { name: 'ParseDate',      signature: 'ParseDate(s, layout) time',           description: 'Parse a date string',            example: 'ParseDate(Vars["date"], "2006-01-02")',      category: 'Date/Time' },
  { name: 'DateAdd',        signature: 'DateAdd(t, "24h") time',              description: 'Add a duration to a date',       example: 'DateAdd(now(), "24h")',                      category: 'Date/Time' },
  { name: 'DateSub',        signature: 'DateSub(t, "24h") time',              description: 'Subtract a duration from a date',example: 'DateSub(now(), "168h")',                     category: 'Date/Time' },
  { name: 'DateDiffDays',   signature: 'DateDiffDays(a, b) int',              description: 'Whole days between two dates',    example: 'DateDiffDays(now(), Times["deadline"])',     category: 'Date/Time' },
  { name: 'DateYear',       signature: 'DateYear(t) int',                     description: 'Year component',                 example: 'DateYear(now())',                            category: 'Date/Time' },
  { name: 'DateMonth',      signature: 'DateMonth(t) int',                    description: 'Month (1-12)',                   example: 'DateMonth(now())',                           category: 'Date/Time' },
  { name: 'DateDay',        signature: 'DateDay(t) int',                      description: 'Day of month',                   example: 'DateDay(now())',                             category: 'Date/Time' },
  { name: 'DateHour',       signature: 'DateHour(t) int',                     description: 'Hour (0-23)',                    example: 'DateHour(now())',                            category: 'Date/Time' },
  // Regex
  { name: 'RegexMatch',      signature: 'RegexMatch(s, pattern) bool',         description: 'Tests if string matches pattern', example: 'RegexMatch(Vars["email"], `^.+@.+$`)',       category: 'Regex' },
  { name: 'RegexFind',       signature: 'RegexFind(s, pattern) string',        description: 'Returns first match',             example: 'RegexFind(Vars["text"], `\\d+`)',            category: 'Regex' },
  { name: 'RegexFindGroup',  signature: 'RegexFindGroup(s, pattern, n) string',description: 'Returns nth capture group',       example: 'RegexFindGroup(Vars["s"], `(\\w+)`, 1)',     category: 'Regex' },
  { name: 'RegexReplace',    signature: 'RegexReplace(s, pat, repl) string',   description: 'Replace first match',             example: 'RegexReplace(Vars["s"], `\\s+`, "_")',       category: 'Regex' },
  { name: 'RegexReplaceAll', signature: 'RegexReplaceAll(s, pat, repl) string',description: 'Replace all matches',             example: 'RegexReplaceAll(Vars["s"], `\\s+`, "_")',    category: 'Regex' },
  // Current user (Search-menu filter resolution only — see FR-D2-013)
  { name: 'ResolveCurrentUserRecord', signature: 'ResolveCurrentUserRecord(formId) string', description: "Linked record ID on formId belonging to the current user, or \"\" if none (Search filters only)", example: 'ResolveCurrentUserRecord("employee_form_id")', category: 'String' },
]

// Top-level identifiers available in the expression environment.
export interface ExprRoot {
  name: string
  detail: string
  description: string
}

export const EXPR_ROOTS: ExprRoot[] = [
  { name: 'Vars',        detail: 'map',  description: 'Workflow variables — Vars["name"]' },
  { name: 'Times',       detail: 'map',  description: 'Typed time/datetime variables — Times["name"]' },
  { name: 'NodeOutputs', detail: 'map',  description: 'Outputs of prior nodes — NodeOutputs["id"]["field"]' },
  { name: 'Context',     detail: 'map',  description: 'Workflow metadata — Context["key"]' },
  { name: 'AppSettings', detail: 'map',  description: 'App-level global variables (Global Settings) — AppSettings["name"]' },
]

export const FUNCTION_CATEGORIES = [...new Set(EXPR_FUNCTIONS.map((f) => f.category))]

// Variable categories shown in the browser. Workflow variables come from the
// definition; the other groups describe the environment roots available to
// every expression.
export interface VariableCategory {
  id: string
  label: string
  /** True when this category is populated from declared workflow variables. */
  fromVariables?: boolean
  /** Static entries (for Inputs / Context style roots). */
  entries?: { insert: string; label: string; hint: string }[]
}

export const CONTEXT_ENTRIES: VariableCategory['entries'] = [
  { insert: 'Context["workflow_id"]',     label: 'workflow_id',     hint: 'Current workflow definition ID' },
  { insert: 'Context["run_id"]',          label: 'run_id',          hint: 'Current execution run ID' },
  { insert: 'Context["task_queue"]',      label: 'task_queue',      hint: 'Temporal task queue name' },
  { insert: 'Context["trigger_user_id"]', label: 'trigger_user_id', hint: 'User who created/updated/deleted the triggering record (before/after/after_async triggers only)' },
]

// Populated only when resolving a Search menu's filter (FR-D2-013) — absent
// (empty string) in every other Expr call site, since workflow execution has
// no HTTP session to source a user ID from.
export const CURRENT_USER_ENTRIES: VariableCategory['entries'] = [
  { insert: 'Vars["_CurrentUser"]', label: '_CurrentUser', hint: "Logged-in user's ID as a plain string; \"\" if anonymous (Search filters only)" },
]
