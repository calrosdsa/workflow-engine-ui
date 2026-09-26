#!/usr/bin/env bash
# Runs the mocked suite inside the pinned Playwright image, the only place its
# screenshots are compared (system fonts render differently on every OS).
#
#   npm run e2e:mock:update   rewrite the screenshots that changed, and copy
#                             them back into e2e/mock/__screenshots__
#   npm run e2e:mock:docker   compare only, as CI does
#
# The working tree is copied in (tracked plus new, not-ignored files), never
# bind-mounted: its node_modules holds this machine's native binaries.
# node_modules is installed fresh inside; a named volume keeps npm's cache.
set -euo pipefail

mode=${1:-check}
case "$mode" in
  update) flags=(--update-snapshots=changed) ;;
  check) flags=() ;;
  *) echo "usage: $0 [update|check]" >&2; exit 2 ;;
esac

cd "$(git rev-parse --show-toplevel)"
version=$(node -p "require('./node_modules/@playwright/test/package.json').version")
image="mcr.microsoft.com/playwright:v${version}-noble"

# Everything the build and the suite read, without node_modules or old results.
git ls-files -z --cached --others --exclude-standard | tar --null -T - -cf - |
  MSYS_NO_PATHCONV=1 docker run --rm -i --ipc=host \
    -v e2e-mock-npm-cache:/root/.npm \
    -e CI=1 -e E2E_SNAPSHOTS=1 \
    "$image" bash -c '
      set -euo pipefail
      mkdir -p /w && cd /w && tar -xf -
      {
        npm ci --no-audit --no-fund
        status=0
        npx playwright test -c e2e/mock/playwright.config.ts "$@" || status=$?
      } >&2
      tar -cf - e2e/mock/__screenshots__ 2>/dev/null || true
      exit "$status"
    ' _ "${flags[@]}" > /tmp/e2e-mock-screenshots.tar || status=$?

if [ "$mode" = update ] && [ -s /tmp/e2e-mock-screenshots.tar ]; then
  rm -rf e2e/mock/__screenshots__
  tar -xf /tmp/e2e-mock-screenshots.tar
  echo "screenshots updated in e2e/mock/__screenshots__; review and commit them" >&2
fi
rm -f /tmp/e2e-mock-screenshots.tar
exit "${status:-0}"
