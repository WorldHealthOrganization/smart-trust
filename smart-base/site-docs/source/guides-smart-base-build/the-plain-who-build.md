This repository keeps the files of the stock WHO build, which runs the IG
Publisher with no harness:

| Command | What it does |
|---|---|
| `./_updatePublisher.sh` | downloads the **latest** `publisher.jar`, so the version floats |
| `./_genonce.sh` | runs the Publisher once over the IG; the HTML is in `output/` |
| `./_gencontinuous.sh` | runs it again on every change |

In CI the same build is `.github/workflows/ghbuild.yml`: six DAK
pre-processing steps, the Publisher, then nine post-processing steps that
write the DAK API, the JSON Schemas and the JSON-LD vocabularies.
`bun run cat stage:local --repo . --bare-ig` publishes that output as it is.

Use this route to compare with WHO's own build. The harnessed site above is
what this repository publishes.
