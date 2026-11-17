---
layout: default
title: Swarm management
nav_order: 13
---

# Swarm management
{: .no_toc }

1. TOC
{:toc}

---

> The skill is
> [`swarm-management`]({{ '/reference/skill-instructions/swarm-management.html' | relative_url }});
> this page is the reader-facing summary.

## What a swarm is here

Several agents working one goal in parallel, each against a disjoint slice of
the corpus, rolling up into one parent work item. It is the most expensive tool the
harness offers.

## The rule that matters most

**An agent must ask before starting a swarm, every time.** It spends the
author's tokens, and permission is per swarm rather than standing — "yes" to
one fan-out does not authorise the next.

When asking, an agent gives three numbers: **how many agents, at which model
level, and the rough cost** relative to doing the work serially.

## Most "parallel" work is not

| situation | what to do |
|---|---|
| one file at a time | serial — a swarm cannot make one edit faster |
| the parts share state | serial — parallel writers to one file is a self-inflicted merge |
| not yet decomposed | **decompose first** — N agents will otherwise discover the same thing N times |
| two or three independent parts | **sub-beans, run in order** |
| many independent parts, disjoint inputs | a swarm is justified |

**The decomposition is the work.** If you cannot write down N units with
non-overlapping inputs and separate outputs, you do not have a swarm shape.

## Sizing

| dimension | guidance |
|---|---|
| **size** | start at 3; above 6 only for genuinely disjoint slices; past ~10 coordination and token cost outgrow throughput |
| **model level** | match the *hardest* judgement in a unit, not the average — mixed swarms (small workers, one large reviewer) are usually right |
| **CPU** | bounded by the box; if units shell out to a build or solver, that tool's parallelism is the real limit |
| **wall-clock** | bound every unit — an unbounded unit is an unbounded swarm |

## Stopping early

If the first two units disagree about something structural, stop: the
decomposition was wrong, and the remaining units will reproduce the
disagreement at full price.

## What is not built

This page and its skill are **written ahead of the tooling**:

- **No swarm runner enforces the sizing above.** `dispatch-agent` covers the
  mechanics of dispatching background agents; nothing checks the count, the
  model level, or the slice disjointness.
- **No per-unit wall-clock bound** exists, so "bound every unit" is currently a
  discipline rather than a mechanism.
- **No cost estimate** can be shown to the author at the moment of asking, so
  the ask is qualitative.
- **No sub-bean hierarchy.** `TodoItem` has `related[]` but no `parent`, so the
  roll-up this page assumes is done by convention. See the
  [minimum cat-harness analysis](../concepts/architecture/cat-harness-minimum.html)
  §"User todo management".
