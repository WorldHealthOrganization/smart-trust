# L1 publication coverage — the report contract

**This contract lives in folio-assistant-core**, the layer that implements the
check: the methodology
[`l1-coverage`](https://github.com/litlfred/folio-assistant-core/blob/main/methodologies/l1-coverage.md)
(moved there in litlfred/folio-assistant-core#779, for
litlfred/folio-assistant#3108). Its skill
[`l1-coverage`](https://github.com/litlfred/folio-assistant-core/blob/main/skills/library/ingestion/l1-coverage.md)
runs it.

It was smart-kg's `docs/COVERAGE.md` (written for folio-assistant#2406). When
smart-kg was deprecated it came here with the rest of smart-kg's docs, but
folio-assistant-core sits below this layer and cannot point up at it, and the
contract is generic, so its one copy is core's. This page is the pointer; edit
the methodology, not this page.

What the contract fixes, in one line each:
- which sentences count as normative (a closed, English marker list; §1);
- the three states each one ends in, captured, excluded for a fixed-list
  reason a person signed off, or unaccounted (§2);
- what the report contains and what its percentages mean (§3, §4).
