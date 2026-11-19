import tseslint from "typescript-eslint";

/**
 * ESLint flat config.
 *
 * `package.json` has carried `"lint": "eslint ."` for a long time, but there
 * was no config file and neither `eslint` nor `typescript-eslint` was a
 * dependency — so the documented command has never run. AGENTS.md lists
 * `eslint .` as a project command, which made that worse than a no-op: it
 * read as coverage that did not exist.
 *
 * SEVERITY SPLIT. A first run over 194 files found 356 problems. Failing the
 * gate on all of them would make `bun run cat lint` permanently red, which trains
 * everyone to ignore it — exactly how the test suite came to sit at 29
 * permanent failures. So:
 *
 *   ERROR — things that are defects regardless of style: dead bindings,
 *           `let` that is never reassigned, and (implicitly) anything that
 *           fails to PARSE. The parse check alone earned its keep on the
 *           first run: `scripts/generate-docs.ts` had `skills/*​/…` inside a
 *           JSDoc block, whose `*​/` closed the comment early and left the
 *           rest of it being parsed as code. bun could not load that file.
 *
 *   WARN  — gradual-typing and module-style debt that is real but is a
 *           project-wide decision, not something to fail a build over. This
 *           tier is now EMPTY: `no-require-imports`, `no-unsafe-function-type`
 *           and `no-this-alias` were drained first, and `no-explicit-any` —
 *           190 of the original 356 — followed. Every rule is an error.
 *
 * Warnings are counted, not hidden. `bun run cat lint` reports them; the backlog
 * is visible without being a blocker. Tighten by promoting a rule here once
 * its count reaches zero — and promote it the moment it does, so the count
 * cannot creep back up behind a warning nobody reads.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      // An agent dispatched with worktree isolation puts a COMPLETE SECOND
      // CHECKOUT of this repository under `.claude/worktrees/<id>/`. Without
      // this, `bun run cat lint` walks into it and typescript-eslint's project
      // service refuses every file there as outside the tsconfig program.
      // Measured 2026-09-30 on a branch whose whole diff was three lines of
      // JSON: 3158 errors, none of them the branch's — and 0 errors with this
      // pattern added (bean `vpek`). Those files are linted on their own
      // branch, by their own agent; linting them twice from here reports a
      // failure that belongs to nobody's diff, which is the one thing a gate
      // must not do.
      ".claude/worktrees/**",
      // GENERATED and minified: `gen-navbar-assets.ts` bundles it from
      // `navbar-client.ts`, which IS linted; `navbar-assets.test.ts` holds the
      // bundle to its source byte for byte (bean `lnoy`).
      // By NAME, not by site root: the chrome moved `docs/` → `site-chrome/`
      // (2026-10) and a root-anchored path silently stopped matching — 31
      // prefer-const errors in a minified bundle nobody wrote.
      "**/assets/js/navbar.js",
      "**/.lake/**",
      // `**/`, not root-anchored: a PUBLISHABLE package builds into its own
      // `dist/`, and since `check:published-packages` builds it (bean `rsi6`),
      // that output now exists on any machine that has run the gate set.
      // Root-anchored, this matched only the platform's own build, and
      // `bun run cat lint` reported 3 errors in generated CJS nobody wrote.
      "**/dist/**",
      "**/*.d.ts",
      "viewer/**",
      "ui/**",
      "home_page/**",
      // Jekyll + TypeDoc build output. Gitignored, but eslint does not read
      // .gitignore — so without this, anyone who builds the docs site locally
      // and then runs `bun run cat lint` gets a wall of errors from TypeDoc's
      // bundled assets.
      "_site/**",
      // Vendored third-party code, committed verbatim with its licence. It is
      // not ours to restyle: an unused `buffer` parameter and a bare
      // expression statement are this project's rules applied to a file that
      // never agreed to them, and "fixing" them would mean editing a file
      // whose whole value is that it matches its upstream byte for byte.
      // Reported as 8 errors on 2026-09-15 when docs/assets/js/vendor landed;
      // the diagnosis took longer than it should have because `*.js` is
      // gitignored here, so nothing else in the repo had ever put hand-written
      // JavaScript in front of eslint.
      "**/vendor/**",
      // The theme's own `assets/js/just-the-docs.js`, copied verbatim from the
      // just-the-docs 0.12.0 gem with two hunks marked `2tfy` (lazy search).
      // Ignored for both reasons above at once: it is upstream code whose
      // value is matching its upstream, and it is a Liquid template — Jekyll
      // front matter and `{% %}` tags — that eslint cannot parse at all
      // ("Parsing error: Expression expected" at 1:2). Its behaviour is pinned
      // by `cat-harness-tools/test/search-lazy.e2e.ts`, which renders it through
      // Liquid and runs it.
      "**/assets/js/just-the-docs.js",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // ── Errors: invariants that currently HOLD ─────────────────
      // A rule is an error here only once its count is zero, so a red
      // `bun run cat lint` always means a regression rather than pre-existing
      // debt. Promote a rule from the warn block below when it reaches zero.
      "prefer-const": "error", // driven to 0 (15 auto-fixed)
      // Driven to 0 from 111. Promoting it is the ratchet: the cleanup is
      // only worth doing if it cannot silently come back.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // `_`-prefixed bindings are the conventional "deliberately unused"
          // marker and are used that way across the pipeline.
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // Driven to 0 from 13. All were lazy inline `require()` of Node
      // builtins (`fs`, `child_process`) inside functions — a CommonJS idiom
      // in an ESM/TS codebase, and deferring a builtin's load buys nothing.
      // Hoisted to top-level imports.
      "@typescript-eslint/no-require-imports": "error",
      // Driven to 0 from 10. Every site was a redundant widening: two servers
      // cast an already-typed handler to `Function` (throwing away its return
      // type), and the test stubs typed their tool registries as `Function`
      // where a real call signature was available.
      "@typescript-eslint/no-unsafe-function-type": "error",
      // Driven to 0 from 2. Both were `const self = this` forced by
      // `Bun.serve({ fetch(req) {…} })` — a method shorthand binds its own
      // `this`. An arrow captures it lexically and the alias disappears.
      "@typescript-eslint/no-this-alias": "error",

      // Driven to 0 from 201 over 194 files (bean lnt1) — the last rule to
      // come off `warn`, and the only one that was never a sweep: each `any`
      // was a separate typing decision, and a blanket replacement with
      // `unknown` would either not compile or push a cast to every call site.
      //
      // A rule is an error only once its count is zero, and this one now is,
      // so the escape hatch closes here rather than sitting on `warn` while
      // the count creeps back. What the drain surfaced, in short: the skill
      // registry never validated against its own schema; three schemas had
      // drifted from the data (a second `FeedbackItem`, a second
      // `LifecycleStage`, `SkillDefinition` missing two fields present on
      // 18/18 files); `blk.status` was a phantom in both resolvers;
      // `renderBlock` was being handed a `ResolvedBlock`; feedback
      // status/priority were written to `main` unvalidated; PACKAGES.md had
      // always shipped empty; and five mdast guards could never fire.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // Liquid fragments under docs/_includes are not modules and not scripts:
  // Jekyll interpolates them into the middle of a statement somewhere else.
  // `mermaid_config.js` becomes the right-hand side of
  // `var config = <file>;` in just-the-docs' own
  // `_includes/components/mermaid.html`, so its entire contents are one
  // expression by design and `no-unused-expressions` is measuring the wrong
  // thing.
  //
  // Scoped to this directory and to that ONE rule rather than ignoring the
  // path, because the rest of eslint is doing real work here: it is what
  // caught the file's five unused catch bindings, and a parse error in this
  // fragment would otherwise surface as a broken docs site rather than as a
  // failed check.
  {
    // `**/docs/**/_includes/`, which survives the site root moving in EITHER
    // direction. It was `docs/**/_includes/` and broke the moment the stub
    // pattern inverted (`docs/<stub>/` -> `<stub>/docs/`, bean `wggr`), which
    // is the third time a literal site path has had to be chased after a move
    // — hence a pattern that names the relationship rather than the location.
    //
    // Originally `docs/**/_includes/` rather than `docs/_includes/`: the site moved under
    // its layer stub (`docs/<stub>/`) to package it for the repo split, and
    // a glob pinned to the old depth silently stops matching — which is a lint
    // rule that quietly covers nothing rather than one that fails loudly.
    // Now `**/_includes/`: the chrome left `docs/` for `site-chrome/`, the
    // fourth move this glob has had to chase. A Jekyll `_includes/` is a
    // Liquid fragment wherever it sits, so the relationship is the directory
    // name alone.
    files: ["**/_includes/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
);
