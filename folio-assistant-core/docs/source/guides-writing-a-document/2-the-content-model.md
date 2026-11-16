```
content/cold-chain-guidance/
  cold-chain-guidance.ts        the document manifest — chapters, in reading order
  introduction/
    introduction.ts             the chapter manifest — sections, in reading order
    overview.ts                 a block manifest: kind, label, title, uses[]
    overview.md                 that block's prose
    overview.qa.json            QA sidecar — machine-written, never hand-edited
```

Three ordered lists hold the whole structure, and **a block reaches the output
only if some section's `blocks[]` names it**. A block whose `.ts` and `.md` are
committed but that no section lists renders nowhere.
