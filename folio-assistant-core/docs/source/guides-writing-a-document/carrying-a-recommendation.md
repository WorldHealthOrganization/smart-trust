A normative statement is the block readers cite and implementers trace to. It
wants a label, a stable identity and a place in the dependency graph. Its
carrier is a `recommendation` block:

```ts
export default recommendation({
  label: "rec:cold-chain-audit",
  title: "Audit the cold chain quarterly",
  strength: { list: "grade-recommendation-strength", code: "conditional" },
  uses: ["rec:scope", "prose:cold-chain-terms"],
});
```

- **One statement per block.** A block holding three cannot be cited, reviewed,
  superseded or traced individually.
- **State the strength as a code** in a declared code list:
  `grade-recommendation-strength` (`strong`, `conditional`) or
  `rfc2119-requirement-level` (`must`, `should`, `may`, …), or the folio's own
  `folio-code-list/v1` when its issuing body grades differently.
- **Keep the published number out of the label.** Numbers change between
  editions; the label must not. Put the number in the title.
- **Do not use `definition`.** Its `lean` field is required, so it will not
  validate here at all.

The full convention is in the
[`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }})
skill.

---
