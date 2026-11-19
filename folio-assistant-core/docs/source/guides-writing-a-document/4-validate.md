```
content_validate          schema + constraints + profile conformance
content_profile_check     profile conformance alone, over the whole folio
qa_sweep                  the QA axes, per block
```

Profile conformance catches two things schema validation cannot, because a
`theorem` is a valid `theorem` whatever folio it sits in:

1. a block whose kind is outside the declared profile; and
2. a `lean` field or a `.lean` sibling on a kind the profile otherwise allows —
   `remark`, `example`, `algorithm` and `simulator` all *declare* an optional
   `lean`, so the type permits what the profile forbids.

Both name the file and the remedy, including "declare `contentType: "paper"`"
when that is what you actually meant.

---
