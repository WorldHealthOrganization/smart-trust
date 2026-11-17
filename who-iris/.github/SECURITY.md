# Security policy

## Reporting a vulnerability

Please do **not** open a public issue, pull request or discussion for a security problem.

Report it privately instead: open this repository's **Security** tab and choose **Report a vulnerability**. That creates a private advisory that only the maintainers can see.

Include what you found, where (file, workflow or URL), how to reproduce it, and what an attacker could do with it. We aim to acknowledge a report within 7 days and to agree a disclosure date with you once a fix is ready.

## Scope

In scope: the code, GitHub Actions workflows, published packages and published sites built from this repository.

Out of scope: content of upstream sources this repository mirrors or cites, and findings that need an already-compromised maintainer account.

## Supply chain

Third-party GitHub Actions are pinned to full commit SHAs, shared workflows are pinned to the commit the repository's `index.lock.json` names, and dependency advisories are checked in CI. A change that loosens any of these needs the maintainer's review.
