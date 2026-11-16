The `.bpmn` files are the source of truth.

```sh
# 1. edit processes/<area>/<diagram>.bpmn — in a modeler, or by hand
# 2. regenerate the SVGs
bun run cat render:bpmn
# 3. or, in CI, just check they are not stale
bun run cat render:bpmn:check
```

`render:bpmn` renders each `.bpmn` with [bpmn-js](https://bpmn.io/toolkit/bpmn-js/)
in headless Chromium and writes `docs/assets/img/workflows/<diagram>.svg`. If
the sandbox ships a Chromium that does not match the pinned Playwright build,
point at it with `CHROMIUM_PATH=/path/to/chrome`.

When you add an activity, add its `<bootstrap.processes:skill ref="…"/>` extension (and
`<cat-harness.processes:bean store="beans/"/>` if it touches the work plan) and the matching
row in the tables above, so the diagram and the skill list do not drift
apart.
