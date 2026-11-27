#!/usr/bin/env bun
/**
 * Print the GitHub login of whoever this session acts for — one line, or
 * nothing — for the session-start sweep's "who is typing" step.
 *
 * Part of the user authentication and authorization Tool (`auth_whoami`); it
 * asks the same resolver, `githubIdentity`. The GitHub handle is the identity
 * interaction preferences are keyed by, since one person may hold more than
 * one Claude account.
 *
 * `--all` prints every identity the session can see instead,
 * provider-neutral: see `src/core/identity.ts`.
 *
 * Exits 0 with the login on stdout when GitHub named one; exits 2 (could not
 * determine) with the reason on stderr otherwise — never 0 with an empty line,
 * so a caller cannot read "nobody" as "somebody we know nothing about".
 *
 * @module cat-harness-tools/scripts/auth-login
 * @covers none — a resolver, not a gate
 */
import { githubIdentity } from "../src/core/github-auth.js";
import { matchKeys, resolveIdentities } from "../src/core/identity.js";

if (import.meta.main && process.argv.includes("--all")) {
  // Bean f1e1, owner ruling 2026-10-10 (provider-neutral): every identity the
  // session can see, one match key per line — each handle bare and as
  // `provider:handle` — for the sweep to match interaction entries against.
  // `--json` prints the resolution instead. Exit 2 when nothing was found, for
  // the same reason as below.
  const r = await resolveIdentities({ env: process.env, cwd: process.cwd() });
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          identities: r.identities,
          hosts: r.hosts,
          userConfig: r.userConfig.state,
          ...(r.activeProfile ? { activeProfile: r.activeProfile } : {}),
          multiUserStatus: r.multiUserStatus,
          interaction: r.interaction,
          notes: r.notes,
        },
        null,
        2,
      ),
    );
  } else {
    for (const k of matchKeys(r.identities)) console.log(k);
  }
  for (const n of r.notes) console.error(`note: ${n}`);
  process.exit(r.identities.length ? 0 : 2);
}

if (import.meta.main) {
  const id = await githubIdentity({ env: process.env });
  if (id.login) {
    console.log(id.login);
    process.exit(0);
  }
  console.error(`could not determine the GitHub login: ${id.reason ?? id.status}`);
  process.exit(2);
}
