In a new, empty repository:

```sh
git init
git submodule add https://github.com/litlfred/folio-assistant.git folio-assistant
(cd folio-assistant && bun install)

bun run folio-assistant/scripts/init-folio.ts \
    --type document \
    --title "Cold Chain Guidance" \
    --author "A. Author"
```

Or, if your agent already has a folio-assistant server connected, ask it:

> *initialize a new document folio here using litlfred/folio-assistant, titled
> "Cold Chain Guidance", author A. Author*

Either way you get `content/`, `uploads/`, `library/`, the manifests for one
document with one chapter and one block, `<name>.config.json`, the builder shim,
`AGENTS.md` with `CLAUDE.md` / `GEMINI.md` stubs, `.mcp.json`, and the beans
work plan. See the
[README quickstart](https://github.com/litlfred/folio-assistant#start-a-new-folio)
for the full file list.

The starter block is a placeholder that says so. Replace it.

---
