/**
 * The Playwright config for the checkout's e2e specs, at `cat-harness-tools/`
 * since bean `ar1s` phase 4 and passed with `-c` by `bun run cat test:e2e` and CI.
 *
 * @covers none — a browser-test runner's configuration, not a graph audit
 */
import { defineConfig, devices } from '@playwright/test';
import { resolveChromium } from './scripts/playwright-chromium.ts';

// Which Chromium to launch, decided once and REPORTED. A prebuilt image pins
// a browser build that the installed @playwright/test may not be the one that
// asks for it, and the resulting "Executable doesn't exist … run npx
// playwright install" names a remedy the image forbids. Falling back silently
// would be worse than the error: the suite would measure a different browser
// than it claims to, so the fallback prints which build it chose.
const chromium = resolveChromium(process.env as Record<string, string | undefined>);
if (chromium.kind === 'fallback' || chromium.kind === 'unknown') {
  console.warn(`[playwright] chromium: ${chromium.kind} — ${chromium.note}`);
}

/**
 * `i/N` → Playwright's shard, or `null` for the whole suite.
 *
 * A malformed value THROWS. Read as "no shard" it would run the whole suite
 * in every shard job — slower but green — and read as shard 1 it would drop
 * the rest. Neither is visible from a green check, so neither is allowed.
 */
function parseShard(raw: string | undefined): { current: number; total: number } | null {
  if (raw === undefined || raw === '') return null;
  const m = /^(\d+)\/(\d+)$/.exec(raw);
  const current = m ? Number(m[1]) : NaN;
  const total = m ? Number(m[2]) : NaN;
  if (!(current >= 1 && total >= 1 && current <= total)) {
    throw new Error(`E2E_SHARD must be i/N with 1 <= i <= N, got ${JSON.stringify(raw)}`);
  }
  return { current, total };
}

export default defineConfig({
  // `./test`, not `./tests`. This repository had both until 2026-09-19 (bean
  // `auap`): `test/` because a declaration in `harness.json` pointed at
  // `test/results/`, `tests/` because this one line pointed here. An id in a
  // declaration is the expensive thing to move, a `testDir` is one line, so
  // the specs came to the declaration rather than the other way round.
  // `test` beside this file: the specs moved with the layer (bean `wggr`),
  // then into cat-harness-tools with the code (bean `70lx`), and this config
  // moved with them; relative paths here resolve against this file. A stale
  // `testDir` does not error — it collects ZERO specs and reports a clean run, which is the `dh4f` shape and
  // exactly what a green e2e job over nothing would have looked like.
  testDir: './test',
  // `*.e2e.ts`, not `*.spec.ts`: `bun test` collects `*.spec.*` anywhere in
  // the tree and chokes on Playwright's `test.describe()`. Keeping the two
  // runners on separate conventions is what stops an e2e spec reddening the
  // unit-test gate. It is also what makes sharing a directory with
  // `test/results/` (504 committed JSON verdicts) and `test/health/*.test.ts`
  // safe: Playwright collects only `**/*.e2e.ts` beneath `testDir`.
  testMatch: ['**/*.e2e.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Bean `dlqu`: one worker per core on CI. `workers: 1` held the e2e job at
  // 4m33s of playwright alone, the workflow's slowest job once `bun test` ran
  // in parallel. Locally it stays at one, which is what it was.
  //
  // Safe because what the specs generate under `_kg/` is now generated ONCE,
  // before any worker starts — see `globalSetup` below. Before that, two specs
  // ran a generator at module load, which with N workers is N concurrent
  // writers to the files the other workers are serving.
  workers: process.env.CI ? '100%' : 1,
  // `E2E_SHARD=i/N` splits the suite across CI jobs. An ENVIRONMENT variable
  // rather than `--shard=${{ matrix.* }}` on the command line, for the reason
  // `bun test --parallel` gives in the workflow: `gatesFrom` runs a `bun` line
  // with no shell, so an interpolation there reaches the local gate run as
  // literal text (the bean `9zok` shape). Unset means the whole suite.
  shard: parseShard(process.env.E2E_SHARD),
  globalSetup: './test/e2e-global-setup.ts',
  // `list` prints to the job log; on CI an HTML report is written BESIDE it so
  // the workflow can keep it as an artifact.
  //
  // Bean `yqc4`. A red e2e job here was opaque to anyone who could not reach
  // GitHub's log host: the check run's annotations say only `Process completed
  // with exit code 1`, the run uploaded nothing, and `list` writes to the log
  // and nowhere else. So the one record of WHICH test failed lived in the one
  // place a reader might not be able to open.
  //
  // `open: 'never'` because CI has no browser to open it in, and the step that
  // follows uploads the folder rather than serving it.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  // Relative paths in this file resolve against ITS directory, which is
  // `cat-harness-tools/` since bean `ar1s` phase 4 — so the two output
  // folders are named at the checkout root, where CI uploads and
  // `.gitignore` ignores them.
  outputDir: '../test-results',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    headless: true,
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // Resolved above. `undefined` means "Playwright's own default", which
      // is what a developer machine with a matching install wants; a path
      // means this image pins a build and we are launching it deliberately.
      executablePath: chromium.path,
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // `cat-harness-tools/test/test-server.mjs` serves the repo root statically. It was
  // referenced here long before it existed — see bean `dzl3` — so no e2e test
  // in this repo was runnable until it was written. It sat at the repository
  // root until 2026-10-06 and moved beside the e2e specs it serves (bean
  // `ar1s`, phase 3); it still serves the REPOSITORY root, two levels up.
  webServer: {
    command: 'node cat-harness-tools/test/test-server.mjs',
    // The command runs in `cwd`, which defaults to this file's directory.
    cwd: '..',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },
  timeout: 180000,
  expect: {
    timeout: 10000,
  },
});
