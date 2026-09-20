# Security vulnerability handling

The `security` workflow scans Workflow Engine UI source, npm dependencies,
secrets, infrastructure configuration, and the deployable `ui` image. It runs
for trusted pull requests, main-branch changes, and weekly; scan JSON and
CycloneDX SBOMs are retained for 400 days.

Set `security / source` and `security / images` as required checks for changes
from this repository. Pull requests from forks are deliberately skipped because
they must not execute untrusted code on the self-hosted deployment runner.
Review forked changes in a trusted branch before merging them.

Treat scan results as security records. Open a tracked remediation item for
each confirmed finding and retain its scan, triage decision, owner, target
date, and closure evidence. HIGH and CRITICAL findings, including an unfixed
upstream finding, fail the gate until an approved exception or remediation is
in place.

| Severity | Target response |
| --- | --- |
| Critical | Triage within one business day; remediate or mitigate before release. |
| High | Triage within two business days; remediate within 14 days. |
| Medium | Triage within five business days; remediate within 45 days. |
| Low | Triage in the next planned review; remediate according to risk. |

An exception needs a documented owner, expiry date, compensating control, and
management approval. Re-run the scan after remediation and attach the clean or
accepted result to the same item.
