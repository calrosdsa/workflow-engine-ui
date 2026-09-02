# UI workflow conformance corpus

`corpus.json` is the shared specification for how a UI workflow behaves. Both
interpreters run it:

| Runtime | Test |
|---|---|
| Web (TypeScript) | `conformance.test.ts`, via `vitest` |
| Mobile (Kotlin/KMP) | `UiWorkflowConformanceTest.kt`, via `kotlin.test` |

## Why a corpus rather than two test suites

The graph is JSON, so the interpreter has to exist twice — there is no viable
way to share one implementation between a React runtime and a Compose one.
Two hand-written test suites would drift the moment one side fixed a bug the
other didn't know about, and the drift would be invisible: both suites green,
different behaviour.

A corpus makes each semantic decision a piece of data that both sides must
satisfy. Adding a case here is how a decision becomes binding on every
runtime, and a case one implementation fails is a build failure rather than a
discrepancy someone notices in production.

## It is authored, not recorded

These cases are hand-written from the decision, not captured from a run. A
recorded corpus only says what one implementation currently does, which makes
it useless as an arbiter the moment that implementation is the thing in
question. Each case carries a `why` for the same reason: the expectation is
the point, and a case whose reasoning nobody can reconstruct is a case nobody
can safely change.

## Shape

```jsonc
{
  "name": "...",
  "why": "the decision this pins",
  "steps": [ /* the graph */ ],
  "context": { "formId": "...", "recordId": "...", "record": {}, "variables": {} },
  "host": {                    // queued responses, consumed in order
    "searchRecords": [{ "records": [], "total": 0 }],
    "createRecord":  [{ "id": "rec-1" }],
    "updateRecord":  [{ "error": "403 forbidden" }],   // `error` makes it throw
    "askUser":       [{ "confirmed": true, "value": "x" }]
  },
  "expect": {
    "status": "completed" | "failed" | "cancelled",
    "failedStepId": "...",
    "errorContains": "...",
    "trace":     [{ "stepId": "a", "status": "ok" | "skipped" | "failed" }],
    "variables": { /* subset — only the keys asserted */ },
    "calls":     [ /* host interactions, in order */ ]
  }
}
```

`calls` is what makes this more than a state check: it pins what each
interpreter actually *did*, in order, not merely where it ended up. `variables`
and `trace` are asserted as subsets, so a case stays about one decision rather
than accidentally freezing every incidental detail.

## What it deliberately does not cover

- **The `MAX_STEPS` bound.** A cycle is not expressible in JSON, so each
  implementation tests its own runaway guard.
- **Host implementations.** Toasts, routing and HTTP are per-platform by
  definition; the corpus fixes the *contract*, not how it is met.
- **Authoring UI.** Panels are a web concept today.

## Changing it

The Kotlin copy is generated — `npm run gen:conformance` in `workflow-engine-ui`
writes `ConformanceCorpus.kt` from this file, the same
one-source-of-truth-with-a-generated-embed shape `ui-catalog.json` uses for the
Go backend. Edit `corpus.json`, regenerate, and run both suites.
