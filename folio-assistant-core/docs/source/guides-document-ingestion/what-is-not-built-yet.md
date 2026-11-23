The path is two commands, and `check:l1-complete` is the gate between them:

```sh
bun run cat ingest uploads/FILE.pdf --library <lib>            # rung + every derived arm, into ingest-staging/
bun run cat ingest uploads/FILE.pdf --library <lib> --promote  # the L1 gate, then into <lib>/<slug>/
```

The gate reports each requirement as **met**, **unmet** or **not yet
derivable**: a per-format arm (images, audio, tables, archives) that cannot run
does not read as a pass. The method, rung by rung, is the
[`l1-document-ingestion`]({{ '/reference/skill-instructions/l1-document-ingestion.html' | relative_url }})
skill; audio and tables have their own,
[`audio-transcription`]({{ '/reference/skill-instructions/audio-transcription.html' | relative_url }})
and
[`tabular-metadata`]({{ '/reference/skill-instructions/tabular-metadata.html' | relative_url }}).
