---
name: bun-use
description: >-
  How Bun is used as the JavaScript/TypeScript execution runtime, test runner,
  package manager, and tarball packager across separated repositories: standalone
  subgraph configuration (bunfig.toml, package.json, tsconfig.json), test preloads,
  dependency resolution without rootDir pitfalls, packaging with bun pm pack,
  and coordinator vs standalone execution models.
governs:
  - The tools layer
  - cat-harness
---

# Bun Runtime, Toolchain, and Multi-Repo Conventions

> Skill id: `bun-use` · Package: `sdlc-core`
> Related: [`package-release`](package-release.md), [`npm-kg-distribution`](../../../skills/kg/kg-core/npm-kg-distribution.md), [`tool-authoring`](../../../skills/tools/folio-core/tool-authoring.md)

**Bun is the primary JavaScript/TypeScript runtime, test runner, and package
manager across the platform.** In the separated repository architecture, each
repository maintains standalone toolchain autonomy while the top-level
checkout coordinates them.

---

## 1. Per-Repository Toolchain Autonomy

Every separated repository (`cat-harness`, the tools layer, `bootstrap-tools`,
the DAK layer, etc.) MUST maintain its own standalone configuration files:

| file | purpose in each repository |
|---|---|
| `package.json` | Declares package identity (`name`), dependencies, scripts (`test`, `typecheck`), export map (`exports`), and tarball whitelist (`files`). |
| `tsconfig.json` | Standalone TypeScript compiler settings tailored for Bun and isolated from other repositories. |
| `bunfig.toml` | Per-repository test runners, test preloads, and runtime flags. |

---

## 2. TypeScript Compiler Rules with Bun

To prevent boundary leakage and cross-repository compiler errors:

1. **Avoid `rootDir` and `outDir` in Multi-Repo Layouts**:
   - In subgraphs that import cross-directory utilities (e.g., schemas or tests),
     specifying `"rootDir": "."` or `"outDir": "dist"` causes TypeScript to fail
     with:
     ```
     error TS6059: File '...' is not under 'rootDir' '...'. 'rootDir' is expected to contain all source files.
     ```
   - **Rule**: Set `"noEmit": true` and omit `rootDir` and `outDir` in
     `tsconfig.json`. This allows TypeScript to typecheck cleanly across repository
     boundaries.
2. **Compiler Flags**:
   - Standard flags for all subgraphs:
     ```json
     {
       "compilerOptions": {
         "target": "ESNext",
         "module": "ESNext",
         "moduleResolution": "bundler",
         "types": ["bun"],
         "strict": true,
         "skipLibCheck": true,
         "noEmit": true
       }
     }
     ```
3. **Ambient Type Definitions**:
   - Include ambient declarations in `"include"`:
     ```json
     "include": ["src/**/*.ts", "test/**/*.ts", "types/**/*.d.ts"]
     ```

---

## 3. Test Execution and Preloads (`bunfig.toml`)

1. **Test Runner**:
   - Run tests directly with `bun test`.
   - Run targeted tests for fast verification:
     ```sh
     bun test cat-harness-tools/scripts/tests/beans.test.ts
     ```
2. **Preloading Test Environments**:
   - If test suites rely on global setups, ambient matchers, or test-specific
     mocks, declare them in `bunfig.toml` under `[test]`:
     ```toml
     [test]
     preload = ["./schemas/test-preload.ts", "./schemas/test-fixture-preload.ts"]
     ```
   - Do not rely on command-line flags (`bun test --preload ...`) in CI scripts;
     the declaration in `bunfig.toml` ensures consistent behavior locally and in CI.

---

## 4. Packaging and Publishing with Bun

1. **Tarball Packaging (`bun pm pack`)**:
   - Use `bun pm pack` to build deterministic npm tarballs (`.tgz`).
   - The files included in the tarball are controlled strictly by the `"files"`
     whitelist in `package.json`.
2. **Authoring the Package Manifest**:
   - Declare `"private": false` on publishable packages.
   - Whitelist only published artifacts and compiled sources. Exclude test
     fixtures, scratch scripts, and ephemeral directories.
   - In Knowledge Graphs, declare `package.json` under `assets` in `<instance>.json`
     (see [`npm-kg-distribution`](../../../skills/kg/kg-core/npm-kg-distribution.md)).

---

## 5. Declarative Coordinator vs Standalone Execution

The top-level repository (`folio-assistant`) and downstream subgraphs have
distinct roles:

1. **Top-Level Declarative Coordinator**:
   - The coordinator repository is **purely declarative**: it holds no root `package.json`,
     `tsconfig.json`, `bunfig.toml`, or `bun.lock`.
   - All layer compositions are declared in `index.config.json` and locked with their
     pinned SHAs and tree digests in `index.lock.json`.
   - Subgraphs and remote layers are mounted from the lock via `bun cat-harness-tools/scripts/mount-from-lock.ts`.
   - A downstream root's `cat` script is `bun .github/cat.ts`, which mounts from the lock
     (through `.github/mount-from-lock.sh`) when the layers are missing, so `bun run cat <name>`
     works on a fresh clone.
   - Whole-checkout integration tests live under the tools layer's `test/coordinator/`.
   - Working state subgraphs (`beans/`, `fsh-guts/`) are branch-mounted subgraphs kept at branch
     tips (`cat/cat-harness/beans`, `cat/cat-harness/fsh-guts`) and mounted via
     `bun cat-harness-tools/scripts/state-mount.ts`.
2. **Standalone Subgraphs**:
   - Each code repository (the tools layer, `cat-harness`, `bootstrap-tools`, etc.) maintains
     its own standalone `package.json`, `tsconfig.json`, and `bunfig.toml`.
   - Each subgraph can be cloned, typechecked, and tested independently:
     ```sh
     bun test <tools-layer>/test
     ```
   - CI workflows in upstream repositories run independently of the coordinator.
