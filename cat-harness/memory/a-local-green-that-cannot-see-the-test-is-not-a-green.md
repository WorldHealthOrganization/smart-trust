---
$schema: folio-memory/v1
id: a-local-green-that-cannot-see-the-test-is-not-a-green
label: trap
summary: "CI checks the MERGE of head into base, so a gate main added after your last merge is absent locally and `bun test -t` reports 0 fail"
createdAt: 2026-09-19
roles:
  - build-pipeline
  - validation-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
A `pull_request` check runs against the **merge of head into base**. A test
`main` gained *after* your last merge is in CI's tree and not in yours.

PR #403, 2026-09-19: CI ran **191** test files, the tree had **190**. The
hard gate failed on three successive heads on one test from a file that had
landed on `main` an hour earlier, while `bun test` said 0 fail — and
`bun test -t "<its name>"` printed `0 pass, 0 fail`, which reads like a
pass. **`-t` matching nothing is indistinguishable from `-t` matching and
passing**: the third-state rule, arriving through the test runner.

Before trusting a local pass: `git rev-list --count HEAD..origin/main` is 0,
and your **file count** equals CI's. `prepare-merge` step 3 is not enough —
the base moved again between that step and the push.

**Read the job log on the FIRST failure notice.** Three arrived before I
opened one, because a green local suite made the CI result look like the
anomaly. The log named the test in one line.
