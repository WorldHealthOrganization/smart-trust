/**
 * The host side of shared assets (Q-SZ-7 "A"; `scripts/lib/shared-assets.ts`):
 * write a site's shared directories as the host serves them.
 *
 *   bun run cat-harness-tools/scripts/shared-assets.ts stage --site <dir holding assets/…> --out <host site root>
 *
 * `--site` is any directory laid out as a built site: an IG build before its
 * assets were shared, or one a host assembles from the same pinned layers.
 * Each shared directory lands at `<out>/shared/<dir>/<key>/` with a
 * `.shared.json`; one already there is left alone.
 *
 * @covers none — a build step that copies a site's assets, not an audit of a declared graph
 */
import { stageShared } from "./lib/shared-assets.ts";

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const [site, out] = [arg(argv, "--site"), arg(argv, "--out")];
  if (argv[0] !== "stage" || !site || !out) {
    console.error("usage: shared-assets.ts stage --site <dir> --out <host site root>");
    process.exit(2);
  }
  const r = stageShared(site, out);
  for (const x of r) console.log(`${x.written ? "staged" : "already there"}: shared/${x.dir}${x.digest}/`);
  if (!r.length) console.log("no shared directory in that site");
}
