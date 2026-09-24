# QA seed

`seed-qa-users.mjs` creates the roles and accounts the end-to-end suite signs
in as, inside an existing staging tenant. Run it once per environment, and
again whenever its permission sets change; it is idempotent.

| Account | Access |
| --- | --- |
| `qa-admin` | Client-wide Super Admin |
| `qa-builder` | **QA Builder** role: design, publish, forms, workflows, executions, menus, content |
| `qa-runtime` | **QA Runtime User** role: menus and content only. Tests grant per-form record permissions themselves |

```sh
QA_BASE_URL=https://<staging app host>/api \
QA_CLIENT_ID=<tenant client id> QA_APP_ID=<app id> \
QA_OWNER_EMAIL=<a Super Admin> QA_OWNER_PASSWORD=<...> \
node e2e/seed/seed-qa-users.mjs
```

It prints `QA_<ROLE>_EMAIL` / `QA_<ROLE>_PASSWORD` for each account it
created; store them as GitHub secrets. The header of the script documents every
option, including `QA_OWNER_TOKEN` for an owner whose login is behind MFA.
