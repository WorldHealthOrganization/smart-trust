---
name: ontologist
description: >
  Semantic Ontologist — scans narrative text for ambiguous terms,
  generates a formal glossary/registry, and produces a mapping linking
  narrative strings to formal identifiers. Acts as the "Gatekeeper"
  ensuring every term has a unique type/identity assignment before
  formalization proceeds.
allowed-tools: Read Write Edit Bash Grep Glob
uses-methodology:
  - automatic-term-extraction
---

# Semantic Ontologist (Ambiguity Detection & Glossary)

## Overview

The **Gatekeeper** for definitions: before any narrative-to-formal
translation proceeds, every term has a unique identity (and, where the
project has a formal layer, a unique type assignment). The Ontologist detects
ambiguities, maintains the formal glossary, and produces the machine-readable
mapping.

## Formal-layer tooling (when available)

When the project has a formal-proof layer with language-server / MCP
tooling, **prefer those tools for type checking** over re-building:

| Goal | Prefer | Why better |
|------|--------|-----------|
| Find type mismatches | structured diagnostics tool | per-file error messages |
| Resolve a symbol's type | hover-info tool | see the resolved type in place |
| Find an existing definition | local search tool | search project + stdlib |
| Check whether a type exists in the stdlib | symbol/type search tool | locate the exact declaration |
| Find where a type is declared | declaration-file tool | jump to source |
| Guess an import path | completion tool | auto-complete import paths |

### Consistency loop

When the formal build or the diagnostics tool reports a type mismatch:

1. Identify the glossary entries involved and flag them as ambiguous.
2. Hover the mismatched symbol → see expected vs actual type.
3. Search for the intended type → find the correct import.
4. Read the actual definition to understand the mismatch.
5. Update the glossary with the corrected assignment.
6. Regenerate the formal glossary, re-run the scan with the error context,
   and re-check diagnostics.

## When to Use This Skill

- New terms or definitions are added to chapter files.
- The formal build fails due to type mismatches (consistency loop).
- The formalizer reports an unresolved term.
- Reviewing changes that introduce new notation.
- Before running the formalizer on any chapter.

## Workflow

### 1. Scan narrative text for terms

Run the project's ontologist scanner over the source chapters. It
parses for definitions, symbols, and terms and outputs candidates to the
glossary.

### 2. Detect ambiguities

The scanner flags terms that lack a unique assignment. **Trigger
phrases** (require disambiguation) are bare nouns used without their
distinguishing structure — "the mapping" without domain/codomain, "the
space" without which kind of space, "the group" without which kind of
group, and bare single-letter symbols without an annotation.

**Action**: interrupt the pipeline and request a **Type/Identity
Assignment**.

### 3. Generate the formal glossary

Run the generator. It produces a formal-glossary file with each term as
a declaration, docstrings containing the original narrative definition,
and any required annotations.

### 4. Generate the mapping

Run the mapping generator. It produces a file linking narrative strings
to formal identifiers.

## Glossary entry structure

Each glossary entry follows this pattern: a docstring with the
human-readable definition, the source location of the narrative
definition, and (when relevant) the stdlib reference the term maps to,
followed by the declaration itself.

### Bibliographic reference requirement

Every unproved gap (`sorry`-style stub) in the formal glossary **must**
be preceded by a reference comment linking to the foundational source,
whose key matches a citation key in the project's reference registry
exactly. (Auto-generated bibliography files are derived from the
registry — never edit them directly.)

## Ambiguity Resolution Format

### Standing disambiguation rulings

The project's notation / terminology register holds a table of
author-resolved terms; agents MUST apply them when scanning. A ruling fixes the
canonical term, any banned synonyms or notations, and when a qualifier is
required. Banned notations and "always qualify" entries are hard rules.

When an ambiguity is detected, the Ontologist outputs a record naming
the narrative term, a message describing the ambiguity, the candidate
resolutions, and a `resolved_to` field that is null until the author
fills it. The pipeline **halts** until `resolved_to` is filled.

## Output Files

| File | Purpose |
|------|---------|
| glossary (machine-readable) | glossary with ambiguity flags |
| formal glossary | formal file with definitions |
| mapping | narrative-to-formal identifier mapping |

## Blueprint Integration

Every glossary entry that has a label in a chapter file must also appear
in the project's blueprint with the matching formal-declaration macro.
The Ontologist ensures:

1. **Label consistency** between chapters and blueprint.
2. **Declaration consistency** between blueprint macros and the formal
   glossary.
3. **Dependency edges** in the blueprint reference only labels that
   exist and whose glossary entries are resolved.
4. **Bibliography references**: every reference comment in the formal
   glossary matches a citation key in the reference registry; new terms
   get a foundational reference added to the registry.

## Content Object Integration

Glossary terms should link to **content-object labels**. Each definition
block has a `.ts` manifest with a `label` and a `.md` narrative.

- Definitions in `.md` blocks reference glossary entries by their formal
  name and cross-ref by label.
- New glossary entries record the content-object `label` they originate
  from for bidirectional traceability.
- The formal-reference URI in a definition's `.ts` manifest matches the
  corresponding formal-glossary declaration name.
- Before creating a glossary entry for a term detected in a `.md` file,
  check whether a content object already exists, to avoid duplication.

## Glossary Block Policy

A dedicated glossary chapter can contain **glossary blocks** — `remark`
blocks tagged `"glossary"` — that map project terminology to canonical
stdlib declarations. These are the content-object counterpart of
glossary entries.

### When to use a glossary block vs. a definition block

| Criterion | Glossary block (`remark`) | Definition block |
|-----------|--------------------------|------------------|
| Novelty | none — the term is a synonym/light wrapper for a stdlib type | the project introduces genuinely new material |
| Formal file | not required | **required** |
| Label prefix | `rem:glossary-<term>` | `def:<term>` |
| Chapter | glossary chapter | relevant content chapter |

### Decision tree for new terms

1. Does the term exist in the stdlib under a different name? →
   glossary block mapping project name to stdlib name.
2. Is it a lightweight restriction/specialization of a stdlib type? →
   glossary block with a note about the restriction.
3. Does the project add new axioms, fields, or structure? →
   definition block in the relevant chapter.
4. Ambiguous? → ask the author.

### Glossary block structure

Each glossary block is a `.ts` + `.md` pair: the `.ts` declares a
`remark` with the `glossary` tag and a `rem:glossary-<term>` label; the
`.md` gives a 1–3 sentence definition as used in the project plus the
stdlib reference (fully-qualified name, kind, and import path).

### Snippet validation (mandatory after creating .md)

After creating any glossary `.md`, validate its embedded
math/markup snippets with the project's snippet validator before
committing, and fix any errors.

### Maintaining consistency

- When a new stdlib-equivalent term appears in any chapter `.md`, check
  the glossary chapter for an existing entry before creating a
  definition.
- When the glossary is regenerated, cross-check against the glossary
  chapter's entries.
- The chapter-analysis skill's glossary-gap analysis should include the
  glossary-chapter blocks in its coverage check.

### Wrap-every-occurrence

Every term registered in a block's `defines: [...]` must appear wrapped
at every mention — the canonical-definition directive once at the
canonical site, the reference directive everywhere else. The ontologist
owns the choice of canonical site: pick the block whose `.md` carries
the most authoritative definition (stdlib synonym → glossary block; new
material → the relevant `def:` block), add the slug to its `defines`,
and rewrite the canonical mention. Backfilling reference mentions across
the project is the codemod's job.

## Checklist

- [ ] Every definition in the source chapters has a glossary entry
- [ ] No unresolved ambiguities in the glossary
- [ ] The formal glossary compiles (gap warnings OK)
- [ ] The mapping covers all formal-declaration macros
- [ ] Type/identity assignments have correct annotations
- [ ] Docstrings in the formal glossary match narrative definitions
- [ ] Every gap in the formal glossary has a reference comment
- [ ] All reference keys exist in the reference registry
- [ ] The blueprint has entries for all glossary definitions
- [ ] Dependency edges in the blueprint are bidirectionally valid
