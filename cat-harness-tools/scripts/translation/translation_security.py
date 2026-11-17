"""Security helpers shared by the translation service scripts.

Five scripts in this directory import this module — `pull_translations`,
`pull_crowdin_translations`, `pull_launchpad_translations`,
`register_translation_project` and `register_all_dak_projects`. Until this
file existed, every one of them died at import with
`ModuleNotFoundError: No module named 'translation_security'`: the module
was referenced from the first commit that used it and never itself
committed, on any branch.

The public contract here is not invented — it is what the call sites
already require:

* ``DEFAULT_TIMEOUT_SECONDS`` is passed as ``timeout=`` to every
  ``requests`` call in the four scripts that talk to a service.
* ``sanitize_slug(value, field)`` and ``sanitize_url(value, field)`` take
  the field name as a second argument, purely so the error message can
  name the offending input, and raise ``ValueError``.
* ``sanitize_lang_code(value)`` takes one argument and raises ``ValueError``.
* ``assert_no_secret_in_env(env_name)`` raises ``RuntimeError``; callers
  catch exactly that and turn it into a log line plus exit status 1.

One piece of the contract was NOT recoverable from the call sites, and is
flagged rather than hidden: what ``assert_no_secret_in_env`` should
consider a violation. The callers only loop over the three token variables
and treat any ``RuntimeError`` as fatal. The semantics implemented below —
placeholder values, and values reachable through ``ps`` — are an inference
from the name and from what actually leaks tokens in CI. If the original
intent was narrower or broader, this is the function to revisit.
"""

from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlparse

# Every outbound call in this directory is to a translation platform's REST
# API. Long enough for a slow PO download, short enough that a hung CI job
# fails instead of burning the wall clock.
DEFAULT_TIMEOUT_SECONDS = 30

# Ceiling on a streamed download, enforced chunk-by-chunk by the two pull
# scripts as they write to a temp file. A PO file for one component is
# measured in hundreds of kilobytes; 64 MiB is far above any legitimate
# one and still small enough that a service returning something
# unbounded — or a redirect to something that is not a PO file at all —
# fails fast instead of filling the runner's disk.
MAX_RESPONSE_BYTES = 64 * 1024 * 1024

# Values that mean "nobody filled this in". A token left at its template
# value authenticates as nothing, but it does reach the service as a
# credential attempt, so it is worth failing loudly and early rather than
# reading a 401 back and guessing why.
_PLACEHOLDERS = frozenset(
    {
        "",
        "changeme",
        "your-token-here",
        "your_token_here",
        "xxx",
        "xxxx",
        "todo",
        "tbd",
        "none",
        "null",
        "placeholder",
        "secret",
        "token",
        "<token>",
    }
)

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
# BCP 47 subset: the tags a translation platform actually serves. Language,
# optional script, optional region — `pt`, `zh-Hans`, `pt-BR`, `zh-Hans-CN`.
_LANG_RE = re.compile(r"^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$")

# Anything that looks like a credential in free text a service handed back.
# Ordered longest-prefix-first so a `github_pat_` token is not matched by a
# shorter rule and left half-visible.
_SECRETISH = (
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"(?i)\b(?:bearer|token)\s+[A-Za-z0-9._\-]{8,}"),
    # A credential embedded in a URL's userinfo — how a tokenised clone URL
    # ends up in a subprocess's stderr.
    re.compile(r"(?<=://)[^/\s:@]+:[^/\s@]+(?=@)"),
    re.compile(r"(?i)\b[a-z_]*(?:token|secret|password|api[_-]?key)[\"'\s:=]+[A-Za-z0-9._\-]{8,}"),
)

__all__ = [
    "DEFAULT_TIMEOUT_SECONDS",
    "MAX_RESPONSE_BYTES",
    "assert_no_secret_in_env",
    "redact_for_log",
    "sanitize_lang_code",
    "sanitize_slug",
    "sanitize_url",
]


def redact_for_log(text: object) -> str:
    """Mask anything credential-shaped in ``text`` so it is safe to log.

    Service errors and subprocess stderr are the two places a token
    reaches a log without anyone deciding to put it there: a failed
    ``git clone`` echoes the URL it was given, userinfo and all. Pass such
    text through here before it goes to a logger.

    Redaction is best-effort by construction — it recognises the shapes it
    knows. It is a second line of defence for text of unknown provenance,
    never a licence to log a value you are holding deliberately.
    """
    out = str(text)
    for pattern in _SECRETISH:
        out = pattern.sub("[REDACTED]", out)

    # Any exact secret currently in the environment, whatever its shape.
    # This is the part that does not depend on guessing a token format.
    for name, value in os.environ.items():
        if not value or len(value) < 8:
            continue
        if not re.search(r"(?i)token|secret|password|api[_-]?key", name):
            continue
        out = out.replace(value, "[REDACTED]")
    return out


def assert_no_secret_in_env(env_name: str) -> None:
    """Raise ``RuntimeError`` if ``env_name`` is set to something unusable.

    Two failures, both of which have to be caught before the value is
    used rather than after:

    * a **placeholder** — the variable is set, so every ``if not token``
      guard upstream passes, and the request goes out with a credential
      that was never filled in.
    * a value **also present in ``sys.argv``** — passing a token as a
      command-line argument publishes it to every other process on the
      machine through ``ps``, and into CI logs that echo their command
      line. The environment variable is the supported channel; the flag
      is the leak.

    A variable that is simply absent is not an error. These scripts each
    support several services and check all three token variables
    regardless of which one is in play.
    """
    value = os.environ.get(env_name)
    if value is None:
        return

    if value.strip().lower() in _PLACEHOLDERS:
        raise RuntimeError(
            f"{env_name} is set to a placeholder value. Set it to a real "
            f"token or unset it; as it stands the request will be sent with "
            f"a credential that was never filled in."
        )

    if len(value) >= 8 and any(value in arg for arg in sys.argv[1:]):
        raise RuntimeError(
            f"{env_name} also appears in this process's command line. A "
            f"token passed as an argument is visible to every process on "
            f"the host via `ps` and is echoed into CI logs. Pass it only "
            f"through the environment."
        )


def sanitize_slug(value: str, field: str) -> str:
    """Return ``value`` if it is a safe project/component slug.

    These slugs are interpolated into REST paths, so a value containing
    ``/`` or ``..`` does not select a component — it selects a different
    endpoint. Raises ``ValueError`` naming ``field``.
    """
    candidate = (value or "").strip()
    if not _SLUG_RE.match(candidate):
        raise ValueError(
            f"{field} must be a lowercase, hyphen-separated slug "
            f"(got {value!r}). It is interpolated into a REST path, so a "
            f"value containing '/' or '..' selects a different endpoint."
        )
    return candidate


def sanitize_lang_code(value: str) -> str:
    """Return ``value`` if it is a BCP 47 tag this pipeline serves.

    Same reasoning as :func:`sanitize_slug` — the code is interpolated
    into a URL path and into an output file path, so ``../`` in it escapes
    the translations directory. Raises ``ValueError``.
    """
    candidate = (value or "").strip()
    if not _LANG_RE.match(candidate):
        raise ValueError(
            f"{value!r} is not a language code this pipeline accepts. "
            f"Expected a BCP 47 tag such as 'fr', 'pt-BR' or 'zh-Hans'."
        )
    return candidate


def sanitize_url(value: str, field: str) -> str:
    """Return ``value`` if it is a plain ``https`` service URL.

    Rejects non-``https`` schemes, because these requests carry a bearer
    token and ``http`` puts it on the wire in clear; and rejects userinfo
    in the URL, because credentials smuggled there end up in every log
    line that prints the URL. Raises ``ValueError`` naming ``field``.
    """
    candidate = (value or "").strip().rstrip("/")
    parsed = urlparse(candidate)

    if parsed.scheme != "https":
        raise ValueError(
            f"{field} must be an https:// URL (got {parsed.scheme or 'no'} "
            f"scheme). These requests carry a bearer token."
        )
    if not parsed.netloc:
        raise ValueError(f"{field} has no host: {value!r}")
    if "@" in parsed.netloc:
        raise ValueError(
            f"{field} embeds credentials in the URL. Pass the token through "
            f"the documented environment variable instead."
        )
    return candidate
