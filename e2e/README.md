# End-to-end suites

Two Playwright suites live here:

- **Staging** (`e2e/*.e2e.ts`, below): the real builder and runtime against a
  deployed environment, after each staging deploy.
- **Mocked** (`e2e/mock/`, at the end): the production build against a fake
  backend, with screenshots in both themes, on every pull request.

## Staging suite

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

### In CI

`.github/workflows/e2e.yml` runs after the `staging` job of both deploy
pipelines: this repository's, and `calrosdsa/workflow-engine`'s (which calls it
at `main`). It runs on a GitHub-hosted runner against the public staging URL,
and can also be started by hand from the Actions tab (**e2e → Run workflow**).

Until the QA accounts are configured it **skips with a notice** instead of
failing. To turn it on:

1. Pick an app **used only by this suite**. Tests publish it (which ships every
   draft change in it) and create and delete forms, menus and workflows in it,
   so never point it at an app people build or use.
2. Run the seed once per environment (see `seed/README.md`):
   ```sh
   QA_BASE_URL=https://app.staging.penvly.com/api QA_CLIENT_ID=<client id> QA_APP_ID=<app id> \
   QA_OWNER_EMAIL=<a Super Admin> QA_OWNER_PASSWORD=<...> node e2e/seed/seed-qa-users.mjs
   ```
3. In **each** of the two repositories (a personal account has no shared
   secrets), add the secrets `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_BUILDER_EMAIL`,
   `QA_BUILDER_PASSWORD`, `QA_RUNTIME_EMAIL`, `QA_RUNTIME_PASSWORD`, and the
   variables `QA_CLIENT_ID`, `QA_APP_ID`.

The QA tenant must not require two-step verification (Team → Security); the
sign-in step stops with that message if it does.

The HTML report (and, on a retry, a trace) is uploaded only when the calling
repository is private, i.e. for runs started by a backend deploy. Anyone can
download this public repository's artifacts, and they would show the QA
tenant's pages, emails and (traces) session cookies; public runs keep the
console log. Passwords never reach the report: sign-in types them through
`fillSecret`, never `fill()`, whose step title records the value. Every run
signs its sessions out at the end.

### Locally

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

### Writing tests

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
- `sweep.setup.ts` removes data a crashed run left behind: items named exactly
  like `runName()` output and older than two hours, plus per-form grants on the
  QA roles whose form is gone (the API refuses a role update that names a
  deleted form, so one killed run would otherwise break every later one).
- Two runs that change the same QA role at once can race (read, then replace
  the list); a test that fails only then shows up as flaky, not failed.

## Mocked suite (pull requests)

`e2e/mock/` runs the production build (`vite build` + `vite preview`) with every
`/api` call answered by `fake-backend.ts` from the fixed data in `world.ts`.
The data is typed with the UI's own types, so a change to what the UI expects
fails `tsc` rather than drifting. `ci.yml`'s `browser` job runs it on every pull
request, and it needs no secrets.

- **Screens** (`screens.mock.ts`): eight key screens must render their data,
  pass the accessibility check, and match their screenshot. Each test runs in
  the `dark` and `light` projects, so each screen has two images in
  `mock/__screenshots__/`.
- **Failures** (`failures.mock.ts`): what the UI does when the server says no,
  which a real backend won't do on demand. That covers a wrong password, the
  two-step challenge, a session expiring mid-use, a role without design
  access, a 5xx's request id, rejected publish issues, and an empty app.
- A request with no fake answers 501 and fails the test, as does an uncaught
  exception in the page. Add a handler in `world.ts` for anything new the UI
  calls, or override one in a test with `backend.on(...)` and `reply(...)`.

Screenshots are only compared inside the Playwright image
(`mcr.microsoft.com/playwright:v<version>-noble`): the UI uses system fonts,
which render differently on every OS. Elsewhere the suite still runs, minus
the pixel comparison.

```sh
npm run e2e:mock          # any machine; no screenshot comparison
npm run e2e:mock:docker   # in the image, comparing, as CI does (needs Docker)
npm run e2e:mock:update   # in the image, rewriting changed screenshots
```

After an intentional visual change, run `npm run e2e:mock:update`, look at the
new images, and commit them with the change. When `@playwright/test` is
upgraded, move the image tag and `PLAYWRIGHT_IMAGE_VERSION` in `ci.yml` with it
(the job refuses a mismatch) and regenerate the screenshots.

