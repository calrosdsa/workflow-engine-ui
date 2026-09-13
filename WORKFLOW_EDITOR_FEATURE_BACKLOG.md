# Workflow editor — n8n study and feature backlog

Reference studied: the authenticated n8n workflow editor at the user-provided URL.
The reference is used as interaction research only; this project keeps its own
visual identity, copy, routes, and data model.

## Hallmark diagnosis

- **Macrostructure:** Canvas + Rail, with a dense workbench shell around a
  horizontal graph.
- **Surface:** Near-black canvas, subtle dot grid, thin neutral rules, and a
  small warm-orange action accent. n8n uses `InterVariable` for the interface.
- **Hierarchy:** The graph owns the viewport. Editor / Executions / Evaluations
  are a persistent segmented view switcher. Secondary tools stay in compact
  rails instead of competing with the graph.
- **Interaction DNA:** Add-node drawer with search and functional categories;
  command bar for discoverability and shortcuts; node actions revealed on
  selection; contextual node editor with input, parameters, and output regions;
  execution history that can reopen a run and show its graph state.
- **Rhythm:** Generous negative space around a compact left-to-right chain;
  dense detail is reserved for drawers and execution surfaces. This rhythm is
  based on the authenticated visual pass, not inferred from HTML alone.
- **Anti-patterns to avoid:** Copying n8n’s branding, subscription copy, exact
  iconography, or modal geometry; hiding important actions behind unlabeled
  controls; making execution state indistinguishable from editing state.

## Node configuration study

The attached reference shows a node editor that treats configuration as a
focused workbench, not as a form hidden in a sidebar. Its important pattern is
the separation of three concerns:

- **Input context:** upstream data, variables, and the triggering event, with
  Schema / Table / JSON views and search.
- **Parameters:** the editable node contract, grouped into clear sections with
  dynamic expression support and node-specific actions such as Import cURL.
- **Output feedback:** the latest result, empty state, mock-data path, and a
  readable representation of what downstream nodes can consume.

The configuration surface also has a persistent node header, explicit
Parameters / Settings tabs, a prominent Execute step action, resizable panes,
documentation access, and clear close/return behavior. This is the interaction
DNA to carry forward; the visual treatment should continue using this project’s
tokens and horizontal canvas rather than reproducing n8n’s chrome.

### Current strengths in our editor

- Built-in nodes already dispatch through dedicated type-specific forms.
- Pluggable connectors can render from a JSON Schema manifest.
- HTTP Request already covers method, URL, params, headers, body, auth,
  timeout, output variables, and response schemas.
- Expression editing already has validation, preview, functions, workflow
  variables, and upstream output context.
- Unknown connector types fail safely into a read-only stored-configuration
  view instead of crashing the editor.
- Node setup validation and execution overlays provide a foundation for inline
  configuration state.

## Node configuration backlog — later implementation

### P0 — configuration workbench foundation

1. **Three-pane node editor.** Replace the narrow single inspector mode with a
   resizable Input / Parameters / Output workbench. Preserve the compact right
   inspector as a responsive fallback, but make the full workbench the desktop
   path for complex nodes.
2. **Node editor shell.** Add a stable header with node icon, editable label,
   node type, status, documentation link, close action, pin/mock-data action,
   and an unsaved/configuration warning when applicable.
3. **Parameters and Settings tabs.** Separate business inputs from execution
   behavior. Settings should cover disabled state, retry policy, timeout,
   continue-on-error, always-output-data, notes, and error-routing policy.
4. **Execute step lifecycle.** Add per-node execution with loading, cancel,
   success, failure, retry, duration, request id, and stale-result handling.
   Running a step must not silently publish or mutate the saved workflow.
5. **Input context viewer.** Show the data available to the selected node,
   including trigger payload, upstream node outputs, workflow variables, and
   environment context. Provide Schema / Table / JSON views, search, copy, and
   field-path insertion into expression-capable inputs.
6. **Output viewer.** Show the latest node result with Schema / Table / JSON
   views, item counts, field search, copy/download, expandable nested values,
   and a clear no-output state. Distinguish no run, empty result, failed run,
   and stale output.
7. **Mock and pinned data.** Let authors set representative mock output,
   pin a captured result for design-time work, clear it, and see whether the
   displayed data is live, mocked, or pinned. Redact secrets by default.
8. **Configuration validation contract.** Validate required fields, types,
   ranges, patterns, cross-field dependencies, and backend capability before
   execution. Surface field-level messages, a summary, and a node-level
   readiness state that links directly to the failing field.

### P1 — node authoring depth

9. **Expression mode everywhere.** Add static / expression switching to
   connector-schema fields and every eligible built-in setting, with context
   autocomplete, type hints, preview values, syntax errors, and an explicit
   distinction between an expression and a secret.
10. **Full JSON Schema form renderer.** Extend the generic connector form to
    support nested objects, arrays, nullable values, `oneOf` / discriminated
    unions, enums with labels, defaults, min/max, pattern, format, secret and
    code fields, file/binary inputs, and schema-version migrations.
11. **Credential lifecycle.** Provide credential type filtering, create/select,
    edit, test connection, missing-credential states, permission errors,
    environment scoping, and safe secret references that never render raw
    values in logs or exports.
12. **HTTP Request parity.** Add Import cURL, request preview, content-type
    presets, raw JSON/form/multipart/binary bodies, auth helpers, headers and
    query toggles, redirects, retries, pagination, batching, proxy/TLS
    options, request timeout guidance, and an inspectable raw request.
13. **Response schema workflow.** Generate a response schema from a sample
    execution, JSON/OpenAPI/cURL input, or an inferred payload; allow typed
    field mapping; preview downstream paths; and warn when a saved schema no
    longer matches a live response.
14. **Node-specific settings registry.** Let each node declare its available
    Settings sections and validation rules without hard-coding the entire
    inspector. Keep generic platform settings consistent across built-ins,
    connectors, and templates.
15. **Docs and help context.** Add node-specific documentation, inline field
    help, examples, keyboard shortcuts, and links that preserve the current
    workflow context when opened.
16. **Configuration history.** Add reset-to-default, undo/redo at field and
    section granularity, copy/paste configuration, duplicate node with config,
    and a compact before/after diff for risky changes.
17. **Execution diagnostics.** Show request/response metadata, logs, warnings,
    input/output item counts, retries, credential failures, and backend
    validation details close to the field or section that caused the problem.

### P2 — scale, safety, and extensibility

18. **Node UI manifests.** Define a versioned capability contract for connector
    forms: fields, widgets, expression support, output schema, settings,
    docs, execution actions, and migrations. Keep the safe generic renderer as
    the fallback when a richer UI is unavailable.
19. **Sensitive-data boundaries.** Redact tokens, cookies, authorization
    headers, PII, and binary payloads in input/output viewers, screenshots,
    exports, execution logs, and copied diagnostics. Add an explicit reveal
    action with permission checks where necessary.
20. **Large-data performance.** Virtualize large tables and JSON trees,
    paginate execution items, debounce schema search, avoid recalculating
    upstream context on every keystroke, and keep the canvas responsive while
    the inspector is open.
21. **Accessibility-complete inspector.** Provide keyboard navigation across
    panes and fields, predictable focus when opening/closing the workbench,
    screen-reader labels for data paths and validation, high-contrast states,
    reduced-motion behavior, and a non-visual equivalent for every graph action.
22. **Responsive configuration modes.** Define desktop split-pane, tablet
    stacked-pane, and mobile full-screen modes without page-level horizontal
    scrolling. Preserve the selected node and unsaved edits across mode changes.
23. **Testing and fixture matrix.** Add contract tests for schema rendering,
    field validation, credential redaction, expression insertion, mock/pinned
    data, execute-step states, and representative config fixtures for every
    built-in node plus connector schema variants.
24. **Version and migration safety.** Version node configurations, migrate old
    saved shapes, show migration warnings, preserve unknown fields for forward
    compatibility, and provide a recovery path when a connector version is no
    longer installed.

## Node configuration delivery status — 2026-09-09

The initial configuration workbench is now delivered in `NodeConfigPanel`.
It keeps each existing built-in form as the Parameters source of truth and
stores workbench-only data in `GraphNode.metadata.extra` so type-specific
configuration and saved workflow execution behavior are not silently changed.

### P0 status

- [x] **Three-pane node editor.** Desktop uses resizable Input / Parameters /
  Output panes. The compact inspector retains all three regions through an
  explicit tab switcher at constrained widths, preserving the horizontal
  canvas and avoiding document-level horizontal overflow.
- [x] **Node editor shell.** The selected node has an editable label, type,
  readiness state, contextual help, pin action, close action, stale-result
  warning, and visible running state.
- [x] **Parameters / Settings separation.** Existing node-specific forms stay
  in Parameters. Settings now has disabled, retry, timeout,
  continue-on-error, always-output, notes, and error-routing controls. These
  are transparently labelled design-time metadata until server-side policy
  support exists.
- [~] **Execute-step lifecycle foundation.** HTTP Request uses the existing
  draft test endpoint with loading, cancellation, success/failure, retry,
  duration, request id, and stale-result handling. Other nodes use a clearly
  labelled local draft preview; it validates the in-memory node and does not
  save, publish, or call the server.
- [~] **Input context viewer.** Captured upstream output (pinned, mocked, or
  locally previewed), declared trigger/configuration context, workflow
  variables, and execution environment context support Schema, Table, and
  JSON views, search, redacted copy, and insertion into an open expression
  editor. A real trigger payload still requires a run-context API.
- [x] **Output viewer.** Latest preview/test output distinguishes no output,
  running, failure, draft/live, mocked, pinned, and stale states. It supports
  Schema/Table/JSON, item count, search, redacted copy/download, and nested
  object inspection.
- [x] **Mock and pinned data.** Authors can apply/clear JSON mock output,
  pin/clear a captured result, and see its source. Viewer and clipboard data
  redact credentials, tokens, authorization headers, cookies, and passwords.
- [~] **Configuration validation contract.** Connector JSON Schema required,
  type, enum, range, length, and pattern checks render at the field; workbench
  setting bounds render at the field; built-in readiness checks supply a
  linked summary before a preview starts.

### P0 remaining gaps

- A server-side generic per-node execution endpoint is still needed for true
  live execution of every built-in and connector node; this UI intentionally
  does not pretend the whole-workflow endpoint is a per-node runner.
- Backend support is required before generic Settings policies can affect
  production execution. The current engine only enforces the settings native
  to individual node types.
- Built-in forms need stable field ids/validation adapters to make every
  backend validation message land directly beside its exact custom control;
  connector and shared-settings fields already do so.
- Pane sizes are session-local. Persisting personal pane preferences is a
  follow-up, not workflow data.

### P1/P2 progress and remaining work

- [~] **P1 expression and schema authoring.** Built-in expression editors and
  HTTP response-schema inference were already present; the workbench now adds
  expression-path insertion plus connector range/length/pattern validation.
  Full static/expression switching for every connector field, nested/union
  JSON Schema widgets, credential lifecycle UI, Import cURL, and the remaining
  HTTP transport controls are still open.
- [~] **P1 help/history/diagnostics.** Node help, existing undo/redo, safe
  config duplication, HTTP test diagnostics, and output diagnostics are
  surfaced in the workbench. A node documentation registry, section-level
  history/diff, and backend diagnostic-to-form mapping remain open.
- [~] **P2 safety/responsiveness/testing.** Default secret redaction,
  keyboard-operable pane resizing, desktop/compact modes, and focused tests
  for metadata isolation, validation, and redaction are complete. Data
  virtualization/pagination, reveal permissions, full keyboard graph/pane
  navigation, fixtures for every node/connector, configuration migrations,
  and version recovery remain open.

## Implemented in this redesign pass

- Horizontal Dagre layout and left/right node handles.
- Canvas-first dark dotted editor with compact tabs and utility rails.
- First-paint fit-to-view so the workflow opens centered and readable.
- Categorized node picker restyled as a right-side drawer with capability search.
- Workflow command bar with `Ctrl/Cmd+K` and `/` entry points.
- Command actions for adding steps, fitting, tidying, minimap, variables, and
  inspector panels.
- Responsive canvas shell verified at narrow breakpoints without document-level
  horizontal scrolling.
- Execution inspector with status filters, 5-second opt-in auto-refresh,
  timestamps, durations, selected-run graph overlays, and a read-only
  “copy run context to editor” handoff that never modifies the definition.
- Four-tab node inspector: Input context, Parameters, Output preview, and
  Settings. The run context and declared outputs are intentionally read-only.
- Workflow Setup drawer for environment state, unresolved node requirements,
  and the completed-step overlay preference.
- Workflow lifecycle drawer backed by the real whole-app checkpoint/publish
  APIs: Draft/Saved/Published/Failed feedback, an editor-vs-saved graph diff,
  checkpoint creation, version-diff summary, and an explicit publish review.
- Central workflow command registry with shortcut labels, recent actions,
  node add/search, node navigation, setup, lifecycle, save, and run commands.

## Suggested backlog for an n8n-like experience

### P0 — workflow authoring foundation

1. **[Done] Execution inspector.** Run list includes status, duration,
   timestamps, filters, user-controlled auto-refresh, selected-run graph
   overlays, and safe read-only run-context copying to the editor.
2. **[Partially done] Three-region node editor.** Input/context, editable
   Parameters, Output preview, and explicit Settings tabs are available. HTTP
   Request uses the existing draft test endpoint and other nodes make an
   explicitly labelled local preview; a general server-backed per-node
   execute/cancel contract remains open.
3. **[Partially done] Publish/version lifecycle.** The editor now represents
   Draft, Saved, Published, and Failed outcomes; it can create whole-app
   checkpoints and publish through the existing API after showing a graph diff
   and explicit review. Unpublish is intentionally absent because there is no
   safe app-unpublish endpoint; full version history remains available in the
   application Version History surface.
4. **[Done] Workflow setup drawer.** Setup and Focus cover environment state,
   incomplete configuration, and the completed-step display preference without
   leaving the canvas.
5. **[Done] Reliable command model.** The searchable registry provides
   shortcut labels, recent actions, node add/search, navigation, and workflow
   actions, each with a visible mouse route in the editor.

### P1 — graph comprehension and recovery

6. **Sticky notes and annotations.** Add movable notes with color, markdown-lite
   text, pinning, and export-safe serialization.
7. **Branch and merge authoring.** Make conditions, parallel paths, merges,
   loops, and subflows visibly distinct, with branch labels and a tidy-layout
   policy that preserves semantic order.
8. **Node run states.** Show idle, queued, running, succeeded, failed, skipped,
   and stale states directly on nodes and edges, with accessible text equivalents.
9. **Credential and expression UX.** Add credential pickers, expression mode,
   variable/context browser, inline validation, test values, and a safe raw
   request preview.
10. **Undoable recovery.** Support branch deletion, reconnect, duplicate,
    copy/paste, multi-select, and a visible undo history rather than relying
    only on keyboard shortcuts.
11. **Node catalog depth.** Add favorites, recently used nodes, connector
    provenance, capability filters, templates, and an “add trigger” path that
    supports more than one trigger per workflow.

### P2 — scale and collaboration

12. **Evaluation workspace.** Make Evaluations a real surface for test cases,
    expected outputs, run comparisons, and regression status.
13. **Import/export and templates.** Support workflow JSON import/export, import
    from URL, reusable subworkflow templates, and safe duplicate/archive flows.
14. **Collaboration and audit.** Add presence, comments, change history, and
    who-published/changed metadata when multiple builders work on one workflow.
15. **Canvas accessibility.** Add keyboard graph navigation, focusable node
    ordering, screen-reader summaries of connections, and a list/outline mode
    that can complete every graph task without pointer dragging.
16. **Performance guardrails.** Virtualize large node catalogs and execution
    lists, debounce expensive layout work, and keep the canvas interactive while
    execution data refreshes.

## Acceptance criteria for future parity work

- Editing, execution review, and workflow setup remain separate but connected
  surfaces.
- Every destructive action has confirmation or an undo path.
- Every canvas action has a keyboard-accessible route.
- A failed run can be opened, inspected, and copied back into the editor without
  mutating the saved workflow.
- The graph remains horizontally legible from 320px through desktop widths,
  with no page-level horizontal scrollbar.
