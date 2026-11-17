---
name: root-readme
description: >
  Write the repository's root README when there is none, carrying a link to the
  harness that was installed and the overall install status. Never replaces one
  that exists. It runs only once the install has succeeded.
---

# The root README, and the one fact it must carry

**You are the Bootstrapping Agent, and the install has just succeeded.** The repository
now *is* a layer instantiating a harness, and — unless somebody wrote one before you
got here — nothing at its root says so.

People and agents read `README.md` first, so the README says it.

## Writing it is not the write the layer rule forbids

An `instance-readme` is read at session start and never written by a running
process. That rule governs a process operating on a layer that exists;
initialization brings the layer into being, so it may create the README.

## When it is absent — write it

Two things, and **no more**:

1. **A link to the harness that was installed.** Whatever reference the
   Requestor gave when the harness was confirmed, resolved to something clickable.
2. **The overall install status.** Not one line per location dug out of a log —
   the question a reader has is *"is this repository set up, and as what"*, and
   that is what you answer. Say how many locations the install touched and
   whether every one of them succeeded.

Write nothing else: the harness's own README tool fills the rest, in marker
pairs, once it is installed.

**Say which locations, when there is more than one.** *"Installed"* over three
locations where one failed is a false statement about the repository, and the
reader who acts on it is the person who set it up.

## When one is already there — do NOT replace it

Add the link and the status **inside a marker pair** instead, so the harness's
README tool owns that region from then on and the rest of the file stays the
author's. If you cannot tell whether an existing file is authored or a
leftover, it is authored: that is the assumption whose failure mode is a
duplicated sentence rather than a lost page.

## What you do not decide here

Whether the install *succeeded* — the install step decided that, and you are on the
path where it did. Which harness it was — the Requestor decided that. What the
README should eventually say — its author decides that, and you are not its
author.

If the write fails (no permission, a read-only checkout), **say so and end
installed anyway**: the harness is installed.
