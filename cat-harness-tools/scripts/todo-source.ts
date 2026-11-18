/**
 * WHERE the published todos are read from — one function, on purpose.
 *
 * @module scripts/todo-source
 *
 * Today the todos live on `main`, in `todos/items/*.md`; their source of truth
 * is planned to move to the branch named after the subgraph,
 * `cat/cat-harness/todos`.
 *
 * So every generator that PUBLISHES todos — the JSON index, the JSON-LD graph,
 * the per-todo pages, the no-JS listing — reads them through
 * {@link publishedTodoFiles} and nothing else. When the branch becomes the
 * source, the body of that function is the one line that changes.
 *
 * Not a second reader: it delegates to `readTodoFiles`, which owns parsing and
 * validation. This module owns only the SOURCE.
 */
import { readTodoFiles } from "./todos.js";

/** The branch the todo subgraph will be read from once it moves — recorded, not read yet. */
export const TODO_SOURCE_BRANCH = "cat/cat-harness/todos";

/**
 * Every todo to publish, each with the file it came from (repo-relative to the
 * cat-harness layer, as `readTodoFiles` reports it).
 *
 * TODAY: the working tree on `main`. The switch to {@link TODO_SOURCE_BRANCH}
 * is a change to this body only.
 */
export function publishedTodoFiles(): ReturnType<typeof readTodoFiles> {
  return readTodoFiles();
}
