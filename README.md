# Workflow Engine UI

The web frontend for the App Builder platform: a multi-tenant admin console for designing applications (workflows, forms, dashboards, menus) and a separate public runtime for the apps it publishes.

This package builds **two independent single-page apps from one Vite project**:

| Entry point | Bundle | Audience | Auth |
|---|---|---|---|
| `index.html` → `src/main.tsx` | Builder | App designers / admins | Session cookie, tenant-scoped |
| `runtime.html` → `src/runtime-main.tsx` | Runtime | End users of a published app | Session cookie, app-scoped |

Both talk to the same backend (`workflow-engine`) over `/api`, proxied to `http://localhost:8080` in dev.

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Key concepts](#key-concepts)
- [Testing](#testing)

## Architecture

### Dual-entry SPA

Vite is configured with two Rollup inputs (`vite.config.ts`) instead of the usual single-page-app default:

```
index.html    → src/main.tsx        → src/router.tsx          (Builder)
runtime.html  → src/runtime-main.tsx → src/runtime-router.tsx  (Runtime)
```

- **Builder** — TanStack Router tree rooted in `AppShell`, covering `/`, `/applications/$appId/{workflows,forms,design,settings,executions}`, `/knowledge-bases`, `/team`, `/dev/*`.
- **Runtime** — a second, independent router serving published apps at `/{clientId}/{appId}/{menuSlug}`.

A custom Vite middleware (`runtimeDevFallback` in `vite.config.ts`) inspects the URL shape in dev and routes 2–3 segment paths that aren't a known builder route to `runtime.html`, since Vite's dev server only auto-falls-back to a single `index.html`. Production hosting needs the equivalent rule at the web server / CDN layer.

### Request layer & multi-tenancy

All API calls go through a single `ky` instance (`src/lib/api.ts`) that:

- Prefixes every request with `/api`.
- Injects `X-Client-ID` / `X-App-ID` headers on every request, read from the **active membership** in the Zustand auth store — not from route params, so the header is right even on a bookmark/refresh.
- Auth is an **HttpOnly session cookie** (unreadable from JS by design) issued by the backend's Limen auth. The client never holds a token; `requireSession()` asks the server on every protected route load.
- A 401 on a request where an active membership *was* sent is treated as "session expired" and forces a redirect to `/login`. A 401 with no active membership yet is not treated as a logout (a brand-new user with zero memberships would otherwise be bounced immediately).

### Routing & access control

`src/router.tsx` defines the builder's route tree with TanStack Router, using `beforeLoad` guards for:

- Session requirement (`requireSession`).
- Role-based landing: users who don't qualify for the builder (`qualifiesForBuilder`) are redirected to `/portal`, a separate runtime-app picker; single-app users skip the picker entirely and are sent straight into that app's runtime bundle.
- Super-Admin-only routes (e.g. `/team`).
- Tenant sync: entering `/applications/$appId/*` re-points `activeMembership` at that app so every subsequent API call is scoped correctly.

### Feature-sliced modules

Code is organized by feature, not by layer:

```
src/features/<feature>/
  api.ts       # thin wrappers around the shared `api` (ky) client
  hooks.ts     # TanStack Query hooks (useQuery/useMutation) built on api.ts
  types.ts     # request/response + domain types
  <Components>.tsx
```

Current features: `applications`, `auth`, `app-settings`, `builder-kit`, `dashboard`, `executions`, `form-builder`, `forms`, `integrations`, `invitations`, `knowledge`, `llm-providers`, `menus`, `page-builder`, `permissions`, `roles`, `runtime`, `theme`, `users`, `workflows`.

`src/pages/*` are route-level containers that compose feature modules; `src/components/{layout,ui}` hold cross-feature shell and design-system primitives.

### Workflow builder (the core editor)

`src/features/workflows/builder/` implements a visual, node-based editor on top of `@xyflow/react` (React Flow):

- **`node-registry.ts`** — the single source of truth for every node type (Trigger, Condition, Set Variable, Fetch/Upsert/Update/Delete Records, HTTP Request, Iterator, Transform, Knowledge Retrieval/Ingest, Notification, Debug, …). Each entry pairs a node type with its icon, color/gradient theme, category, config-form component, and a `normalise` function that repairs/defaults incoming config.
- **`node-forms/`** — one config form per node type (`NodeFormProps` gives every form the same shape: `config`, `variables`, `nodeContext`, `onChange`).
- **`store.ts`** — the canvas's Zustand store (nodes, edges, selection, dirty state).
- **`ExpressionEditor.tsx`** + **`expr-autocomplete.ts`** — a CodeMirror-based editor for the workflow expression language, with variable/field autocompletion and live validation against the real backend engine (`validateExpression` in `src/lib/api.ts`) so "valid" always means "the Go engine accepts it," not a client-side approximation.
- **`executionOrder.ts`** / **`node-validation.ts`** — client-side graph checks (cycles, unreachable nodes, missing required config) before a workflow can be saved/run.
- **`ExecutionsSidebar.tsx`** + **`execution-overlay-store.ts`** — live execution status overlaid on the canvas.

This same registry pattern (a typed map of `kind → { component, config, behavior }`) repeats across the codebase for other extensible surfaces (form fields, dashboard widgets, page-builder blocks), so `node-registry.ts` is the best first read for understanding "how do I add a new X" in this app.

## Tech stack

**Core**
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 6](https://vite.dev/) — dual-entry build (see above), `@vitejs/plugin-react`, `@tailwindcss/vite`
- [Tailwind CSS 4](https://tailwindcss.com/)

**Routing & data**
- [TanStack Router](https://tanstack.com/router) — typed, file-free route trees with `beforeLoad` guards
- [TanStack Query](https://tanstack.com/query) — server-state cache, mutations, devtools
- [ky](https://github.com/sindresorhus/ky) — the HTTP client, wrapped once in `src/lib/api.ts`
- [zustand](https://github.com/pmndrs/zustand) (+ `persist` middleware) — client state: auth/active tenant, workflow canvas, execution overlay

**Workflow / visual editing**
- [@xyflow/react (React Flow)](https://reactflow.dev/) — the node-graph canvas
- [@dagrejs/dagre](https://github.com/dagrejs/dagre) — auto-layout for the graph
- [CodeMirror 6](https://codemirror.net/) (`@codemirror/*`) — the expression editor, with JS/HTML language support, linting, autocomplete
- [@dnd-kit](https://dndkit.com/) — drag-and-drop (node palette, reorderable lists)
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) — the dashboard-builder grid canvas

**Forms & validation**
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) + `@hookform/resolvers` — node config forms and app forms

**UI**
- [Radix UI](https://www.radix-ui.com/) primitives + local `src/components/ui/*` — a shadcn/ui-style component layer (accordion, dialog, dropdown, popover, select, tabs, tooltip, data-table, etc.)
- [lucide-react](https://lucide.dev/) — icons
- [class-variance-authority](https://cva.style/), `clsx`, `tailwind-merge` — variant/class composition
- [cmdk](https://cmdk.paco.me/) — command palette
- [recharts](https://recharts.org/) — dashboard charts
- [react-markdown](https://github.com/remarkjs/react-markdown) — rendering rich text (e.g. knowledge base content)
- [dompurify](https://github.com/cure53/DOMPurify) — sanitizing any HTML rendered from user/AI content

**Tooling**
- [Vitest](https://vitest.dev/) + `@testing-library/react` + `jsdom` — unit/component tests
- [oxlint](https://oxc.rs/) — linting
- `tsc -b` (project references via `tsconfig.app.json` / `tsconfig.node.json`) — type checking as part of `build`

## Project structure

```
workflow-engine-ui/
├── index.html              # Builder entry (authenticated admin app)
├── runtime.html             # Runtime entry (published app for end users)
├── vite.config.ts           # Dual-entry build + dev-mode runtime routing fallback
├── src/
│   ├── main.tsx              # Builder bootstrap
│   ├── router.tsx             # Builder route tree (TanStack Router)
│   ├── runtime-main.tsx       # Runtime bootstrap
│   ├── runtime-router.tsx     # Runtime route tree
│   ├── lib/
│   │   ├── api.ts               # Shared ky client: tenant headers, 401 handling, expression/embed-check APIs
│   │   └── utils.ts
│   ├── stores/
│   │   └── auth.ts              # Session, active client/app membership (persisted)
│   ├── hooks/                 # Cross-feature hooks (e.g. useDebouncedValue)
│   ├── components/
│   │   ├── layout/               # AppShell and other cross-feature chrome
│   │   └── ui/                   # Design-system primitives (Radix + Tailwind)
│   ├── features/               # One directory per domain: api.ts / hooks.ts / types.ts / components
│   │   ├── workflows/
│   │   │   └── builder/            # The node-graph editor (see Architecture above)
│   │   ├── forms/, form-builder/
│   │   ├── dashboard/, page-builder/, builder-kit/
│   │   ├── applications/, menus/, theme/, app-settings/
│   │   ├── auth/, permissions/, roles/, users/, invitations/
│   │   ├── executions/, integrations/, knowledge/, llm-providers/
│   │   └── runtime/                # Runtime-side shell, nav, record pages
│   └── pages/                  # Route-level containers composing feature modules
└── public/
```

## Getting started

Requires the backend (`workflow-engine`) running locally on port `8080` — the dev server proxies `/api` to it.

```bash
npm install
npm run dev
```

- Builder: [http://localhost:5173](http://localhost:5173)
- Runtime: [http://localhost:5173/{clientId}/{appId}](http://localhost:5173/) (any 2–3 segment path not matching a builder route)

Override the dev port with `PORT=<port> npm run dev`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server (both entry points, with API proxy) |
| `npm run build` | Type-check (`tsc -b`) then build both bundles for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |
| `npm run test` | Run the Vitest suite once |

## Key concepts

- **Tenant scoping is header-based, not path-based.** Every API request carries `X-Client-ID`/`X-App-ID` derived from the auth store's `activeMembership`, kept in sync by route `beforeLoad` hooks. Don't derive tenant context from route params directly — read/write `useAuthStore`.
- **Two routers, two shells.** `router.tsx` (builder) and `runtime-router.tsx` (runtime) are independent trees with independent shells (`AppShell` vs `RuntimeAppShell`). A page belongs in exactly one.
- **Registries over conditionals.** Extensible surfaces (workflow nodes, and similarly form fields / dashboard widgets / page-builder blocks) are modeled as a typed registry object (`kind → definition`), not a switch statement. Adding a new node type means adding one entry to `node-registry.ts` plus its form in `node-forms/`, not touching the canvas or config-panel code.
- **Expression validity is server-verified.** The expression editor's linting isn't a client-side parser reimplementation — it calls the real backend engine (`POST /api/expressions/validate`) so "valid" always matches what will actually execute.

## Testing

```bash
npm run test
```

Vitest + Testing Library + jsdom. Tests currently cover the workflow builder's core logic: `node-registry.test.ts`, `node-validation.test.ts`, `store.test.ts`, and `auth/permissions.test.ts`, `runtime/nav.test.ts`.
