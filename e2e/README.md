# End-to-end suite

Playwright tests that drive the real builder and runtime in a browser, against
a deployed environment. They sign in as three QA accounts in one QA app:

| Role | Account | Used for |
| --- | --- | --- |
| `admin` | client-wide Super Admin | the Team page; granting permissions and publishing in test setup |
| `builder` | **QA Builder** role | the designer: form builder, records, workflows |
| `runtime` | **QA Runtime User** role | the published app, and being turned away from the designer |

What it covers: sign-in, where each role may and may not go, renaming a form
in the form builder, adding a record from the designer, creating and editing a
record through a published Search menu, being refused a menu whose form the
role can't view, and running a workflow to completion. Every page a test
visits must have no serious or critical accessibility violations (axe).

## In CI

`.github/workflows/e2e.yml` runs after the `staging` job of both deploy
pipelines: this repository's, and `calrosdsa/workflow-engine`'s (which calls it
at `main`). It runs on a GitHub-hosted runner against the public staging URL,
and can also be started by hand from the Actions tab (**e2e → Run workflow**).

Until the QA accounts are configured it **skips with a notice** instead of
failing. To turn it on, in **each** of the two repositories (a personal account
has no shared secrets):

1. Run the seed once per environment (see `seed/README.md`):
   ```sh
   QA_BASE_URL=https://app.staging.penvly.com/api QA_CLIENT_ID=<client id> QA_APP_ID=<app id> \
   QA_OWNER_EMAIL=<a Super Admin> QA_OWNER_PASSWORD=<...> node e2e/seed/seed-qa-users.mjs
   ```
2. Secrets: `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_BUILDER_EMAIL`,
   `QA_BUILDER_PASSWORD`, `QA_RUNTIME_EMAIL`, `QA_RUNTIME_PASSWORD`.
3. Variables: `QA_CLIENT_ID`, `QA_APP_ID`.

The QA tenant must not require two-step verification (Team → Security); the
sign-in step stops with that message if it does.

The HTML report is uploaded as an artifact. Traces are only kept when the
calling repository is private: they record session cookies, and anyone can
download this public repository's artifacts. Every run signs its sessions out
at the end.

## Locally

Against any running builder (a local stack, or staging):

```sh
npx playwright install chromium
E2E_BASE_URL=http://localhost:5173 E2E_CLIENT_ID=... E2E_APP_ID=... \
QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=... QA_BUILDER_EMAIL=... QA_BUILDER_PASSWORD=... \
QA_RUNTIME_EMAIL=... QA_RUNTIME_PASSWORD=... npm run e2e
```

`npm run e2e -- --ui` opens Playwright's UI mode. A local engine must run with
`ALLOW_HEADER_TENANT=false`, or header-only requests act as a Super Admin and
the refusal tests prove nothing.

## Writing tests

- Select by role and label (`getByRole`, `getByLabel`) in the platform's
  English strings; the app has no `data-testid`s. The locale is pinned to `en`.
- Create test data over the API (`support/api.ts`), named with `runName()`, so
  runs from the two repositories never see each other's data, and delete it
  afterwards. Delete menus before the forms they point at: a menu on a deleted
  form fails every later publish of the app.
- The QA roles hold no per-form record permissions; a test grants what it needs
  for its own form and takes it back.
- Wait with `expect.poll` or web-first assertions, never fixed sleeps.
- Call `expectAccessible(page, '<what>')` on each new page. An accessibility
  problem that can't be fixed right away goes in `KNOWN_VIOLATIONS` in
  `support/ui.ts` with its reason; don't turn the check off.
- `sweep.setup.ts` removes `qa-*` data older than two hours that a crashed run
  left behind.
