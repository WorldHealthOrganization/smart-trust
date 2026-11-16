#!/usr/bin/env python3
"""Keep the one `main-red` issue of a repository in step with main's verdict.

Run by `layer-main-qa.yml` after a push to main was judged (owner,
2026-10-30, "Both": "each merge to main gets a full QA run that files an
issue when it is red"). Nothing is run here: the verdict is the gate run's.

Environment:
  VERDICT        green | red | unknown, main's own verdict, or empty when
                 the gate run gives none (its workflow conclusion is used).
  FAILURES       one line of JSON from main-verdict.py, or empty.
  CHECKS_RESULT  the gate run's result as the caller saw it (success,
                 failure, cancelled, skipped) or empty.
  GATE_RUN_ID    the workflow run that judged main.
  SHA            the commit of main it judged.
  GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID, GITHUB_STEP_SUMMARY.

Red: the open `main-red` issue is updated (or one is opened) with the failing
gates, tests and jobs, and the commits since the last green main: the newest
successful push run of the gate run's workflow on main. Green: the open issue
is closed. Only the newest main reports: when SHA is no longer main's head, a
newer push's run reports instead, and the issue is not touched. Unknown, or a
cancelled gate run that gave no verdict: nothing is touched. A cancelled gate
run that still gave a green or red VERDICT is judged by that verdict: main's
gate set finished, and only a later job (the writer record) was cancelled.

Exits 1 when main is red, so the QA run itself is red; 2 when main's verdict
is unknown (its answer could not be read: could-not-determine is never
green) and SHA is still main's head; 0 otherwise.
"""
import hashlib
import json
import os
import subprocess
import sys

LABEL = "main-red"
QA_JOB = "Post-merge QA of main"
REPO = os.environ["GITHUB_REPOSITORY"]
SERVER = os.environ.get("GITHUB_SERVER_URL", "https://github.com")


def gh(path, method="GET", body=None, ok_codes=()):
    """`gh api`, REST only; the parsed JSON, or None for an expected failure."""
    cmd = ["gh", "api", "-X", method, path]
    if body is not None:
        cmd += ["--input", "-"]
    r = subprocess.run(cmd, input=json.dumps(body) if body is not None else None,
                       capture_output=True, text=True)
    if r.returncode != 0:
        if any(str(c) in r.stdout + r.stderr for c in ok_codes):
            return None
        raise SystemExit(f"gh api {method} {path} failed: {r.stderr.strip() or r.stdout.strip()}")
    return json.loads(r.stdout) if r.stdout.strip() else {}


def summary(text):
    print(text)
    p = os.environ.get("GITHUB_STEP_SUMMARY")
    if p:
        with open(p, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def failed_jobs(run_id):
    """The gate run's failed jobs and their failed steps, this QA job left out."""
    out = []
    jobs = gh(f"repos/{REPO}/actions/runs/{run_id}/jobs?filter=latest&per_page=100").get("jobs", [])
    for j in jobs:
        if j.get("conclusion") not in ("failure", "timed_out") or j.get("name", "").endswith(QA_JOB):
            continue
        steps = [s["name"] for s in j.get("steps") or [] if s.get("conclusion") == "failure"]
        out.append({"name": j["name"], "steps": steps, "url": j.get("html_url", "")})
    return out


def last_green(run, sha):
    """The newest successful push run of the gate workflow on main, before this one."""
    runs = gh(f"repos/{REPO}/actions/workflows/{run['workflow_id']}/runs"
              f"?branch={run['head_branch']}&event=push&status=success&per_page=30").get("workflow_runs", [])
    for r in runs:
        if r["head_sha"] != sha and r["created_at"] <= run["created_at"]:
            return r
    return None


def body_for(sha, run, failures, jobs, green, checks_result):
    short = sha[:12]
    lines = ["<!-- main-red: kept by layer-main-qa.yml; edited on every red push to main -->",
             f"**main is red** at [`{short}`]({SERVER}/{REPO}/commit/{sha}), "
             f"judged by [{run['name']} run {run['id']}]({run['html_url']}).", ""]
    if checks_result == "cancelled":
        lines += ["The gate run was cancelled after main's gate set finished; this is that gate set's verdict.", ""]
    elif checks_result not in ("", "success"):
        lines += [f"The gate run itself ended **{checks_result}**: main's gate set did not finish.", ""]
    gates = failures.get("gates") or []
    if gates:
        lines += [f"### Failing gates ({failures.get('gate_count', len(gates))})", ""]
        lines += [f"- `{g['name']}` (exit {g.get('exit')})" for g in gates]
        lines.append("")
    tests = failures.get("tests") or []
    if tests:
        lines += [f"### Failing tests ({failures.get('test_count', len(tests))})", ""]
        lines += [f"- `{t}`" for t in tests]
        lines.append("")
    if failures.get("declared"):
        lines += [f"Only the gates this layer declares in `.github/main-qa-gates.json` are judged; "
                  f"{failures.get('not_judged_count', 0)} red gate(s) outside it are not, and "
                  f"{failures.get('passing_undeclared_count', 0)} passing gate(s) could be added. "
                  f"The run's summary lists them.", ""]
    if failures.get("error"):
        lines += [f"Main's answer: {failures['error']}", ""]
    if jobs:
        lines += ["### Failing jobs", ""]
        for j in jobs:
            steps = f": {', '.join(j['steps'])}" if j["steps"] else ""
            lines.append(f"- [{j['name']}]({j['url']}){steps}")
        lines.append("")
    lines += ["### Commits since the last green main", ""]
    if green:
        g = green["head_sha"]
        lines.append(f"Last green: [`{g[:12]}`]({SERVER}/{REPO}/commit/{g}) "
                     f"([run {green['id']}]({green['html_url']})); "
                     f"[compare `{g[:7]}...{sha[:7]}`]({SERVER}/{REPO}/compare/{g}...{sha}).")
        # GitHub's /compare/ endpoint returns HTTP 500 ("Sorry, this diff is
        # temporarily unavailable due to heavy server load") when a commit in
        # the range has a large diff (smart-base#239, run 41183351401). Do not
        # abort updating the main-red issue when the commit list fails to load.
        cmp = gh(f"repos/{REPO}/compare/{g}...{sha}", ok_codes=(404, 422, 500, 502, 503, 504))
        if cmp is None:
            lines += ["", "*(GitHub could not compute the commit list for this range; follow the compare link above.)*"]
        else:
            commits = cmp.get("commits") or []
            lines.append("")
            for c in commits[-50:]:
                first = c["commit"]["message"].splitlines()[0] if c["commit"]["message"] else ""
                lines.append(f"- [`{c['sha'][:7]}`]({c['html_url']}) {first}")
            if len(commits) > 50:
                lines.append(f"- ... and {len(commits) - 50} earlier")
    else:
        lines.append(f"No successful push run of {run['name']} on main is on record "
                     f"among the last 30, so the range is not known.")
    return "\n".join(lines)


def fingerprint(failures, jobs, checks_result):
    key = json.dumps([[g["name"] for g in failures.get("gates") or []], failures.get("tests") or [],
                      [j["name"] for j in jobs], checks_result], sort_keys=True)
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def main():
    sha = os.environ["SHA"]
    run_id = os.environ["GATE_RUN_ID"]
    checks_result = os.environ.get("CHECKS_RESULT", "")
    verdict = os.environ.get("VERDICT", "")
    try:
        failures = json.loads(os.environ.get("FAILURES") or "{}")
    except ValueError:
        failures = {}
    run = gh(f"repos/{REPO}/actions/runs/{run_id}")
    # main-verdict.py gives green or red only from main's finished gate set
    # (missing reports are `unknown`), so a run cancelled after that, as when
    # the writer record is cancelled, still has main's answer.
    answered = verdict in ("green", "red")
    cancelled = checks_result == "cancelled" or run.get("conclusion") == "cancelled"
    if cancelled and not answered:
        summary(f"The gate run for `{sha[:12]}` was cancelled: no verdict, the `{LABEL}` issue is not touched.")
        return 0
    jobs = failed_jobs(run_id)
    if (checks_result not in ("", "success", "cancelled")
            or (not verdict and run.get("conclusion") not in ("success", None))):
        verdict = "red"
    if not verdict:
        verdict = "green" if run.get("conclusion") == "success" else "unknown"
    default = gh(f"repos/{REPO}")["default_branch"]
    head = gh(f"repos/{REPO}/commits/{default}")["sha"]
    if verdict == "unknown":
        # Could not determine is not green: red, and the issue left alone,
        # since nothing says main is red either. A superseded commit is the
        # newer push's to judge.
        why = failures.get("error", "no answer")
        # A push that ran nothing on purpose (batched into its window's
        # integration run, or pins only): layer-pr-checks marks it, and it is
        # deferred to the push that judges it, not could-not-determine.
        if failures.get("deferred"):
            summary(f"Main's verdict for `{sha[:12]}` is deferred ({failures['deferred']}); "
                    f"judged by {failures.get('judged-by', 'a later push')}. The `{LABEL}` issue is not touched.")
            return 0
        if head != sha:
            summary(f"Main's verdict for `{sha[:12]}` is unknown ({why}), but main has moved on to "
                    f"`{head[:12]}`: that push's run reports, and the `{LABEL}` issue is not touched.")
            return 0
        print(f"::error::main's verdict for {sha[:12]} could not be determined: {why}")
        summary(f"Main's verdict for `{sha[:12]}` is **unknown** ({why}): could not determine, so this run is red. "
                f"The `{LABEL}` issue is not touched.")
        return 2
    if head != sha:
        summary(f"main is **{verdict}** at `{sha[:12]}`, but main has moved on to `{head[:12]}`: "
                f"that push's run reports, and the `{LABEL}` issue is not touched.")
        return 1 if verdict == "red" else 0
    gh(f"repos/{REPO}/labels", "POST",
       {"name": LABEL, "color": "b60205", "description": "main is red after a merge (post-merge QA)"}, ok_codes=(422,))
    open_issues = [i for i in gh(f"repos/{REPO}/issues?labels={LABEL}&state=open&per_page=10")
                   if "pull_request" not in i]
    issue = open_issues[0] if open_issues else None
    if verdict == "green":
        if issue:
            gh(f"repos/{REPO}/issues/{issue['number']}/comments", "POST",
               {"body": f"main is green again at [`{sha[:12]}`]({SERVER}/{REPO}/commit/{sha}) "
                        f"([run {run['id']}]({run['html_url']})). Closing."})
            gh(f"repos/{REPO}/issues/{issue['number']}", "PATCH", {"state": "closed", "state_reason": "completed"})
            summary(f"main is green at `{sha[:12]}`: closed #{issue['number']}.")
        else:
            summary(f"main is green at `{sha[:12]}`; no `{LABEL}` issue is open.")
        return 0
    green = last_green(run, sha)
    fp = fingerprint(failures, jobs, checks_result)
    body = body_for(sha, run, failures, jobs, green, checks_result) + f"\n\n<!-- main-red-fingerprint: {fp} -->"
    parts = [f"{failures[k]} {n}" for k, n in (("gate_count", "gate(s)"), ("test_count", "test(s)")) if k in failures]
    parts.append(f"{len(jobs)} job(s)")
    title = f"main is red: {', '.join(parts)} failing"
    if issue:
        changed = f"main-red-fingerprint: {fp}" not in (issue.get("body") or "")
        gh(f"repos/{REPO}/issues/{issue['number']}", "PATCH", {"title": title, "body": body})
        if changed:
            gh(f"repos/{REPO}/issues/{issue['number']}/comments", "POST",
               {"body": f"Still red at [`{sha[:12]}`]({SERVER}/{REPO}/commit/{sha}), and what fails has changed: "
                        f"see the description ([run {run['id']}]({run['html_url']}))."})
        summary(f"main is red at `{sha[:12]}`: updated #{issue['number']}.")
    else:
        made = gh(f"repos/{REPO}/issues", "POST", {"title": title, "body": body, "labels": [LABEL]})
        summary(f"main is red at `{sha[:12]}`: opened #{made['number']}.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
