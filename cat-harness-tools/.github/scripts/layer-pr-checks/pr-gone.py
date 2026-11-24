#!/usr/bin/env python3
"""Is this run's pull request still open? (cat-harness-tools#2391)

## Why

A `pull_request` run checks out `refs/pull/N/merge`, and GitHub deletes that
ref once the PR merges or closes. A run that starts as the PR merges then
fails at the checkout: WHO dth-phc run 44031440302 started at 06:28:15Z, its
PR merged at 06:28:16Z, and the merged PR was left with red checks that judge
nothing in it. The cancel-on-close workflow and the concurrency group only
help a caller that triggers on `closed`, and only before the checkout.

## What it does

It reads the PR from the API (`state`, `merged`), with the token and then
anonymously, as the tier step reads the labels. Closed or merged is `gone`:
prepare-head skips its checkout and everything after it, and the later jobs
report "nothing to judge" instead of a red. Open, or anything it cannot read,
is not gone, so the run goes on exactly as before: a wrong "open" can only
leave the old red, never hide a real one.

  (default)  before the checkout. Exits 0 in every state.
  --late     after a checkout of the merge ref failed. Gone exits 0; open or
             unread exits 1, so the failure stays a hard failure.

Writes `gone=true|false` and `state=open|closed|merged|unknown` to
GITHUB_OUTPUT, and `GONE=true` to GITHUB_ENV when gone.

Env: GH_TOKEN, GITHUB_API_URL, REPO, PR, GITHUB_OUTPUT, GITHUB_ENV,
GITHUB_STEP_SUMMARY.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def append(var: str, text: str) -> None:
    path = os.environ.get(var)
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)


def read_pr(repo: str, pr: str) -> dict | None:
    """The PR as the API returns it, or None when it cannot be read."""
    base = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
    url = f"{base}/repos/{repo}/pulls/{pr}"
    token = os.environ.get("GH_TOKEN", "")
    for auth in ([token] if token else []) + [""]:
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
        if auth:
            req.add_header("Authorization", f"Bearer {auth}")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.load(r)
        except (urllib.error.URLError, OSError, ValueError):
            continue
        if isinstance(body, dict):
            return body
    return None


def state_of(body: dict | None) -> str:
    """open, closed, merged, or unknown when the body says neither."""
    if not isinstance(body, dict):
        return "unknown"
    if body.get("merged") is True or body.get("merged_at"):
        return "merged"
    s = body.get("state")
    return s if s in ("open", "closed") else "unknown"


def main(argv: list[str]) -> int:
    late = "--late" in argv[1:]
    repo, pr = os.environ.get("REPO", ""), os.environ.get("PR", "")
    state = state_of(read_pr(repo, pr)) if repo and pr else "unknown"
    gone = state in ("closed", "merged")
    append("GITHUB_OUTPUT", f"gone={'true' if gone else 'false'}\nstate={state}\n")
    if gone:
        append("GITHUB_ENV", "GONE=true\n")
        msg = f"PR #{pr} was {state} as this run started: its merge ref is gone, so there is nothing to judge."
        print(f"::notice title=Nothing to judge::{msg}")
        append("GITHUB_STEP_SUMMARY", f"### Is the PR still open? No, {state}\n\n{msg}\n")
        return 0
    if late:
        why = "is still open" if state == "open" else "could not be read"
        print(f"::error::the merge ref of PR #{pr} could not be checked out, and the PR {why}: a real failure, not the merge race")
        return 1
    print(f"PR #{pr}: {state}" + ("" if state == "open" else " (taken as open)"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
