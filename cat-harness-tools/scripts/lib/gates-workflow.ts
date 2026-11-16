/**
 * The workflow that defines the FAST gate set, repository-relative.
 *
 * @module scripts/lib/gates-workflow
 * @graphNode none — one path constant
 *
 * Here rather than in `gates.ts`, which re-exports it, because
 * `qa-working-copy.ts` needs it too and `gates.ts` imports that module: the
 * constant in either would make the two import each other.
 */
import { join } from "node:path";

export const GATES_WORKFLOW = join(".github", "workflows", "code-quality-gates.yml");
