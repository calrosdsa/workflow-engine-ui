# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct personas, enforced by the router's own access control (`src/features/auth/access.ts`):

- **App designers / admins ("builders")** — the primary audience for this codebase. Anyone holding the `application:design` permission on at least one app, or Super Admin status. They construct data-model forms, node-graph workflows, dashboards, navigation menus, and app theming/settings for a tenant's app(s), then publish the result. Within this persona, permission keys are resource:action pairs (`forms:write`, `workflows:read`, `roles:write`, `credentials:write`, `executions:write`, etc.) scoped per app, plus a distinct client-wide Super Admin tier (`"*"` permission grant) for team/tenant administration (`/team`).
- **Runtime end users** — people who use a *published* app but don't qualify for the builder. Routed to `/portal` (a picker across every published app they belong to) or straight into a single app's runtime if they only belong to one. They interact with forms, records, dashboards, and workflows the builder persona configured — never the design surface itself.

A single person can hold memberships across multiple clients (tenants) and switch between them; within a client they may have different roles per app.

## Product Purpose

App Builder lets a builder persona design a complete, data-driven business application — its data model (forms/records), its automation (node-graph workflows with triggers, conditions, connectors, and knowledge-base-backed AI steps), its dashboards, and its navigation — without writing code, then publish it as a live, versioned app that a separate population of end users runs. Success is a builder shipping a working internal or customer-facing app faster than hand-coding one, and an end user completing their task in the published app without ever seeing the builder surface.

## Positioning

General-purpose low-code SaaS, positioned against tools like Retool, Airtable, and Bubble. What a generic form/database-builder competitor cannot truthfully claim:

- **Workflow automation is a first-class, node-graph engine, not a bolt-on.** Triggers (on-demand, scheduled, before/after record write, webhook, executed-by-another-workflow, on-error) drive a visual DAG of typed nodes (data ops, HTTP, conditions, notifications, knowledge retrieval) backed by a durable Temporal-based execution engine — this is closer to an embedded automation platform than a "run a script on save" feature.
- **A pluggable connector architecture** lets a workflow node type be authored and deployed as an independent gRPC service, so the platform's own node catalog can grow without a redeploy of the core product — most low-code tools ship a fixed, vendor-curated integration list instead.
- **Knowledge bases (RAG) are a native building block**, addressable from both the builder's own AI-assisted authoring and from workflow nodes at runtime, not a separate product bolted alongside.
- **One design surface targets two independent runtime rendering targets**: this repo's own web runtime bundle (`runtime.html`, a second Vite entry point sharing zero admin-bundle code with the builder) and a native Kotlin Multiplatform mobile app that renders the *same* published `AppSnapshot` — a builder configures one app once (including a dedicated Mobile Layout nav configuration) and it runs natively on mobile, not just in a mobile web view.

## Operating Context

- **Multi-tenant**: every API call is scoped by `X-Client-ID` / `X-App-ID` headers derived from the authenticated user's active membership (never from URL params), so a bookmarked/refreshed page stays correctly scoped. A client (tenant/org) can own multiple apps.
- **Draft vs. published**: builder edits are live/draft state against the backend; "Publish" creates an immutable, versioned `AppSnapshot` that every runtime surface (web runtime, native runtime) reads from. Publish validation surfaces structured issues before a broken app can go live.
- **Session auth**: an HttpOnly session cookie issued by the backend's own auth (Limen); the client never holds a readable token, and every protected route load re-asks the server for the session.
- **Two independent SPA bundles from one codebase**: `index.html` (Builder, session-cookie/tenant-scoped) and `runtime.html` (Runtime, session-cookie/app-scoped) — deliberately not merged, so the runtime never ships the admin bundle to anonymous/end-user visitors.

## Capabilities and Constraints

Confirmed feature areas (`src/features/*`):

- **Workflows + Executions** — node-graph workflow builder (React Flow-based canvas) with triggers (on-demand, scheduled, before/after record write, webhook, executed-by-another-workflow, error trigger), data/HTTP/notification/knowledge-retrieval node types, and run history/monitoring.
- **Forms / Form Builder** — data-model and form designer; runtime record UI (tables, detail panels, comments with @mentions, custom actions).
- **Dashboard** — drag/grid dashboard-widget builder (charts, embeds, KPIs).
- **Page Builder / Detail Page Builder** — freeform page and record-detail spatial layout builders sharing common canvas primitives.
- **Applications** — app CRUD, settings, theming, publish/version lifecycle.
- **Menus** — app navigation-tree builder plus a separate Mobile Layout config for the native runtime's bottom-tab/drawer nav.
- **App Settings** — credentials and variables management (consumed by workflow nodes).
- **Permissions / Roles / Users / Invitations** — RBAC administration and team member invites; per-field masking is authored on the field itself (`hide_rules`, in the form builder's Advanced Settings), not on the role.
- **Knowledge (RAG)** — knowledge-base management (documents, ingestion, entity/relation graph, query modes), shared client-wide or scoped to one app.
- **LLM Providers** — credential configuration for LLM/embedding providers consumed by knowledge bases and workflow AI nodes.
- **Integrations** — external system connections (embeddable SSO-launched integrations).
- **Connectors** — pluggable, independently-deployed workflow node types (gRPC-based), discovered at runtime and rendered via a generic JSON-Schema-driven config form.
- **Theme** — per-app branding/theme configuration (colors, logo).
- **Runtime** — the published-app shell/nav/record pages/notifications end users actually interact with.

Terminology: "Client" = tenant/organization. "App" = one buildable/publishable application under a client. "Membership" = a user's role+permissions within one client, optionally scoped to one app. "Trigger" = what starts a workflow execution. "Definition" = a saved workflow's graph. "Execution" = one run of a definition. "Publish" = snapshot the current draft into an immutable versioned `AppSnapshot`.

## Brand Commitments

No designed brand identity exists yet — no logo/wordmark asset, no registered product name beyond the descriptive "App Builder" used in the README, and the repo/package name (`workflow-engine-ui`) is an internal codename, not a product name. The favicon is a generic placeholder. A tenant app's own theme (colors, logo URL) is separately customer-configurable and unrelated to this product's own (currently absent) brand.

## Evidence on Hand

No real customer names, testimonials, case studies, or press exist in this repository — none should be fabricated. Development/staging data observed (e.g. "Acme CRM Pro," sample Users/Products/Photos forms) is internal test fixture data, not real customer evidence, and must not be presented as such.

## Product Principles

1. **Builder and runtime are strictly separate surfaces.** Design-time complexity (the full admin bundle, every builder feature) must never leak into what an end user's browser downloads to use a published app.
2. **Automation is a peer to data modeling, not an afterthought.** Workflow triggers, node types, and connectors are designed with the same rigor as forms/records — this is a differentiator, not a secondary feature.
3. **One app, every surface.** A builder configures an app once; it must render correctly and natively across every runtime target (web runtime, native mobile) from that single published snapshot.
4. **Publish is a safety boundary.** Draft state is freely mutable; only a validated, versioned publish becomes what real end users see, with structured validation feedback before it goes live.
5. **Multi-tenancy is load-bearing, not incidental.** Every capability must respect client/app scoping correctly, including on bookmarked/refreshed URLs and across multi-client memberships.

## Accessibility & Inclusion

No formal accessibility requirement (WCAG level, contract clause, or specific user need) has been established. The existing codebase shows a consistent baseline convention worth preserving: Radix UI primitives as the base layer for interactive components (built-in ARIA/keyboard support), explicit `focus-visible` styling in the shared component layer, and deliberate keyboard-operability for drag-and-drop interactions (e.g. `KeyboardSensor` alongside `PointerSensor` in reorder UIs). Treat this as the floor to maintain, not a ceiling already reached.
