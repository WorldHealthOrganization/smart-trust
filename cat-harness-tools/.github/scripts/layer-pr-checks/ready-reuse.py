#!/usr/bin/env python3
"""Was this PR, marked ready for review, already judged on these exact inputs?

Merge manager, 2026-11-07 (owner's rules relayed: "same head_sha AND same
base.sha", "compare the pins the first run mounted, fall back to the window
only when they aren't recorded", "an API error means no reuse").

## Why

A PR the merge queue paces goes draft -> ready -> draft -> ready without a
push. Each `ready_for_review` runs the full tier again on the same head
against the same main and the same pins: 60-200 work-minutes for an answer
the run before already recorded.

## The rule: equal inputs, read from the record, never assumed

`key` writes the name `layer-judged-<digest>`, and prepare-head uploads an
artifact under it on every full-tier PR run. The digest covers what the run
judged: the PR head, the payload's base.sha, the merge commit's tree and first
parent (the caller's two sides), the folio-assistant index and judging-scripts
commits it pinned, and the branch-kept graph tips it mounted (`state.json`).

`decide` reuses an earlier run only when ALL of these hold:

  1. It is a `pull_request` run of this same workflow on this head.
  2. Its "No new failures (tests and gates)" job concluded `success` (a
     fast tier run, "Fast tier only", never counts).
  3. EITHER it recorded `layer-judged-<digest>` equal to this run's
     ("pins"), OR it recorded no `layer-judged-*` at all (a run older than
     the record), the PR's base.sha it lists equals this run's, and it
     started at most `MAX_HOURS` ago ("window").

Anything else -- no such run, a different digest, an API error, a field that
cannot be read -- is `reuse=false`, and every job runs. The script exits 0 in
every state, so a crash here cannot skip anything: the jobs it gates run
unless its output is exactly `true`.

Env (both): GH_TOKEN, GITHUB_API_URL, REPO, HEAD_SHA, BASE_SHA, MERGE_SHA,
INDEX, TOOLS, STATE (path of state.json, may be absent).
Env (decide): RUN_ID, MAX_HOURS, NOW (ISO time, tests only; default now).
Writes `key` / `reuse`, `run_id`, `run_url`, `how` to $GITHUB_OUTPUT.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

FULL_TIER_JOB = "No new failures (tests and gates)"
PREFIX = "layer-judged-"


def output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            f.write(f"{name}={value}\n")


def summary(*lines: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    text = "\n".join(lines) + "\n"
    if path:
        with open(path, "a") as f:
            f.write(text)
    else:
        sys.stdout.write(text)


class ApiError(Exception):
    pass


def api(path: str) -> dict:
    base = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
    req = urllib.request.Request(base + path, headers={"Accept": "application/vnd.github+json"})
    token = os.environ.get("GH_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.load(r)
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise ApiError(f"{path}: {e}") from e
    if not isinstance(body, dict):
        raise ApiError(f"{path}: not a JSON object")
    return body


def merge_sides(repo: str, merge_sha: str) -> tuple[str, str]:
    """The merge commit's tree and first parent: what the caller's two sides were."""
    c = api(f"/repos/{repo}/git/commits/{merge_sha}")
    tree = (c.get("tree") or {}).get("sha") or ""
    parents = c.get("parents") or []
    parent = parents[0].get("sha", "") if parents and isinstance(parents[0], dict) else ""
    if not tree or not parent:
        raise ApiError(f"merge commit {merge_sha}: no tree or first parent")
    return tree, parent


def digest(env: dict[str, str], tree: str, parent: str) -> str:
    state = ""
    path = env.get("STATE", "")
    if path and os.path.isfile(path):
        with open(path) as f:
            state = json.dumps(json.load(f), sort_keys=True, separators=(",", ":"))
    parts = [
        "v1",
        f"head={env['HEAD_SHA']}",
        f"base={env['BASE_SHA']}",
        f"tree={tree}",
        f"parent={parent}",
        f"index={env.get('INDEX', '')}",
        f"tools={env['TOOLS']}",
        f"state={state}",
    ]
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()[:40]


def required(env: dict[str, str], *names: str) -> None:
    missing = [n for n in names if not env.get(n)]
    if missing:
        raise ApiError("missing " + ", ".join(missing))


def key_name(env: dict[str, str]) -> str:
    required(env, "REPO", "HEAD_SHA", "BASE_SHA", "MERGE_SHA", "TOOLS")
    tree, parent = merge_sides(env["REPO"], env["MERGE_SHA"])
    return PREFIX + digest(env, tree, parent)


def cmd_key(env: dict[str, str]) -> int:
    try:
        name = key_name(env)
    except ApiError as e:
        # No record: a later ready_for_review falls back to nothing, never to
        # a guess. The run itself is unaffected.
        print(f"ready-reuse key: none -- {e}")
        output("key", "")
        return 0
    print(f"ready-reuse key: {name}")
    output("key", name)
    return 0


def parse_time(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def no_reuse(reason: str) -> int:
    output("reuse", "false")
    summary("### Verdict reuse: none -- every job runs", "", reason)
    print(f"ready-reuse: no -- {reason}")
    return 0


def judged(repo: str, run_id: int) -> bool:
    jobs = api(f"/repos/{repo}/actions/runs/{run_id}/jobs?filter=latest&per_page=100").get("jobs") or []
    return any(
        isinstance(j, dict)
        and (j.get("name") == FULL_TIER_JOB or str(j.get("name", "")).endswith(" / " + FULL_TIER_JOB))
        and j.get("conclusion") == "success"
        for j in jobs
    )


def recorded_keys(repo: str, run_id: int) -> list[str]:
    arts = api(f"/repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100").get("artifacts") or []
    return [a["name"] for a in arts if isinstance(a, dict) and str(a.get("name", "")).startswith(PREFIX)]


def cmd_decide(env: dict[str, str]) -> int:
    try:
        required(env, "REPO", "RUN_ID", "HEAD_SHA", "BASE_SHA", "MAX_HOURS")
        repo, head, base = env["REPO"], env["HEAD_SHA"], env["BASE_SHA"]
        this_run = int(env["RUN_ID"])
        max_hours = float(env["MAX_HOURS"])
        now = parse_time(env["NOW"]) if env.get("NOW") else datetime.now(timezone.utc)
        want = key_name(env)
        workflow = api(f"/repos/{repo}/actions/runs/{this_run}").get("workflow_id")
        if workflow is None:
            return no_reuse("This run's workflow could not be read.")
        runs = api(f"/repos/{repo}/actions/runs?head_sha={head}&event=pull_request&per_page=50").get("workflow_runs") or []
        for run in sorted((r for r in runs if isinstance(r, dict)), key=lambda r: r.get("created_at", ""), reverse=True):
            rid = run.get("id")
            if rid == this_run or run.get("workflow_id") != workflow or run.get("head_sha") != head:
                continue
            if not judged(repo, rid):
                continue
            keys = recorded_keys(repo, rid)
            how = ""
            if want in keys:
                how = "pins"
            elif not keys:
                bases = {p.get("base", {}).get("sha") for p in run.get("pull_requests") or [] if isinstance(p, dict)}
                started = run.get("run_started_at") or run.get("created_at") or ""
                if base in bases and started:
                    age = (now - parse_time(started)).total_seconds() / 3600
                    if 0 <= age <= max_hours:
                        how = "window"
            if not how:
                continue
            url = run.get("html_url") or f"https://github.com/{repo}/actions/runs/{rid}"
            output("reuse", "true")
            output("run_id", str(rid))
            output("run_url", url)
            output("how", how)
            output("key", want)
            detail = (
                "the same head, base, merge tree and pins (index, judging scripts, graph tips)"
                if how == "pins"
                else f"the same head and base; that run recorded no pins, so it was taken because it started within {env['MAX_HOURS']} h"
            )
            summary(f"### SKIPPED -- already passed as judged in run {url}", "", f"Marked ready for review with {detail}.")
            print(f"ready-reuse: yes ({how}) -- run {url}")
            return 0
        return no_reuse(f"No earlier run of this workflow on `{head}` passed the full tier with these inputs.")
    except (ApiError, KeyError, TypeError, ValueError) as e:
        return no_reuse(f"Could not determine ({e}).")


def main(argv: list[str]) -> int:
    env = dict(os.environ)
    if len(argv) != 2 or argv[1] not in ("key", "decide"):
        print("usage: ready-reuse.py key|decide", file=sys.stderr)
        return 2
    return cmd_key(env) if argv[1] == "key" else cmd_decide(env)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
