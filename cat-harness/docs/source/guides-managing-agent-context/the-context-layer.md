The Context layer is declared, not inferred. Five graph typologies currently sit in
it, and the schema requires each kind to say which layer it belongs to, so a
kind that has not decided does not compile:

| kind | what it holds |
|---|---|
| `memory` | durable facts an agent carries between sessions |
| `interaction` | how a person wants to be asked — read at session start |
| `waiver` | confirmations granted in advance, each naming one gate |
| `methodology` | an adopted way of reaching a judgement, kept whole |
| `fsh-guts` | deprecated and throwaway structured content, kept addressable |

Ask the code rather than this table — `graphTypologiesOfLayer("context")` returns
the live answer; a count written into prose is not re-derived.
The shapes are in
[`schemas/cat-harness.ts`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/schemas/cat-harness.ts).

`fsh-guts` holds
structured material that COULD be rendered, which is what makes it look like
content. It is context because no running process writes it.
