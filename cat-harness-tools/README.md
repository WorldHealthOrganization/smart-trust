# cat-harness-tools

What implements C@T Harness's Tool definitions — the MCP servers, their tool
registrars and routes. The definitions stay in `cat-harness/tools/`; this layer
runs them.

**Contents**

<!-- readme:toc:begin -->

- [Why a separate layer](#why-a-separate-layer)
- [Where it sits](#where-it-sits)
- [Working on it from a plain clone](#working-on-it-from-a-plain-clone)

<!-- readme:toc:end -->

## Why a separate layer

The same split `bootstrap` and `bootstrap-tools` use: a contract can be read,
audited and published without the code that runs it.

## Where it sits

It needs `cat-harness` and `bootstrap-tools`, and sits below the content core,
which needs it. Nothing here may import the content layers above; a server
part that needs one moves up into it.

## Working on it from a plain clone

`@litlfred/cat-harness` and `@litlfred/bootstrap-tools` are not published to
any registry, so `bun install` in a lone clone fails with a 404 for both. They
are resolved as **workspaces** instead: `package.json` lists
`../cat-harnes[s]` and `../bootstrap-tool[s]`, which match a sibling checkout
when there is one and nothing when there is not. Clone the two layers this one
`needs` beside it:

```sh
mkdir work && cd work
git clone https://github.com/litlfred/cat-harness
git clone https://github.com/litlfred/bootstrap-tools
git clone https://github.com/litlfred/cat-harness-tools
(cd bootstrap-tools && bun install)
(cd cat-harness && bun install)
cd cat-harness-tools
bun install
bun test scripts/tests/sdlc/stage-local-publisher.test.ts
```

Run `bun install` in **every** sibling, not only this one. Bun and `tsc` load a
sibling's files from its real path (`../bootstrap-tools/…`) and resolve `zod`
from there, so a sibling with no `node_modules` of its own fails every test in
the preload. A folio-assistant index and CI put a `node_modules` above the
siblings and do not hit this.

Each sibling then has its own copy of `zod`, so the copies must be the same
version: two versions make `tsc` reject a schema from one layer passed to the
other (`ZodType` is not assignable to `ZodType`). Keep `zod` at one version
across the layers, and bump it in all of them together.

`main` of `cat-harness` is the right sibling, since this repository's `main`
tracks it (see `.github/workflows/pr-tests.yml`). Inside a folio-assistant
index, or a folio with its layers mounted, the same globs match the mounted
directories and nothing needs cloning. Tests that read other layers (the
index's workflows, `bootstrap/`, content folios) still need that full mount.

### Running the checkout scripts beside it

The `checkoutScripts` (every `check:` and `:check` among them) are spelled
`bun run cat-harness-tools/scripts/…` and run from the directory that holds
the layers, as in a composed index. For a plain directory of clones, add
`bootstrap` beside the three above and write a minimal root into that
directory — an `index.config.json` naming the four as local layers, and a
`package.json` with the `cat` alias:

```sh
git clone https://github.com/litlfred/bootstrap
bun cat-harness-tools/scripts/sibling-root.ts   # never overwrites; --force does
bun run cat check:import-direction
```

It is not a folio-assistant index: checks that read the index's own files,
other layers or a built site still need one.
