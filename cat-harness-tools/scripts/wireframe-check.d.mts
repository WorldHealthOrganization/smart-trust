// Types for `wireframe-check.mjs`, which stays plain JavaScript because it is
// run as `bun run cat wireframe:check`. Kept beside it so the tests typecheck.
export declare const USES: readonly ["design", "as-is"];
export declare class UsageError extends Error {}
export interface WireframeRun {
  use: "design" | "as-is";
  topic: string;
  surface: string;
  /** Absolute path of the topic's asset directory. */
  assetDir: string;
  /** Absolute paths of the candidates checked. */
  candidates: string[];
  /** Absolute path the screenshots and report.json go to. */
  out: string;
}
export declare function parseArgs(argv: string[]): { flags: Record<string, string>; files: string[] };
export declare function assetDirSuffixes(use: string, topic: string): string[];
export declare function findAssetDir(root: string, suffixes: string[]): string | undefined;
export declare function asIsSurfaces(assetDir: string, topic: string): string[] | undefined;
export declare function resolveRun(argv: string[], root?: string): WireframeRun;
export declare function runChecks(run: WireframeRun, root?: string): Promise<number>;
