/**
 * **A memory store that is not the work plan**: plain files, for one run
 * (cat-harness#991 proposal §4.14, step 21). It implements `MemoryStore` and
 * nothing more, which is the point: it shows the memory Role is Tool-neutral
 * (Q17, layered), and it is what an ITB run can choose instead of beans.
 *
 * One directory per record, under the store's root:
 *
 * - `<id>/record.json` — the record without its entries,
 *   `$schema: memory-record/1.0.0` (`schemas/kg/memory-record.ts`);
 * - `<id>/entries.jsonl` — one entry per line, appended. An append of one
 *   short line is a single `write` with `O_APPEND`, so agents keeping to one
 *   shared record never overwrite each other.
 *
 * The version `recall` answers is the sha1 of the two files' text.
 *
 * @module folio-assistant/workflow/memory-file-store
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryEntrySchema, MemoryRecordKind, type MemoryEntry, type MemoryScope } from "../../schemas/kg/memory-record.ts";
import type { MemoryRecordView, MemoryStore, Refusal } from "./work-plan-store.ts";

/** A record id is a file name here, so it is held to a plain shape. */
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class FileMemoryStore implements MemoryStore {
  constructor(private readonly root: string) {}

  private dir(id: string): string | undefined {
    return ID.test(id) && !id.includes("..") ? join(this.root, id) : undefined;
  }

  open(record: { id: string; title: string; scope: MemoryScope; about?: string[] }): { state: "opened"; version: string } | Refusal {
    const dir = this.dir(record.id);
    if (!dir) return { state: "refused", why: "invalid", detail: `"${record.id}" is not a record id this store can keep` };
    if (existsSync(join(dir, "record.json"))) return { state: "refused", why: "exists", detail: record.id };
    // input-site: inert #a3e3d49c — the moment a record is opened; a write, never a check's input
    const now = new Date().toISOString();
    const head = {
      $schema: "memory-record/1.0.0",
      id: record.id,
      title: record.title,
      scope: record.scope,
      ...(record.about?.length ? { about: record.about } : {}),
      created_at: now,
      updated_at: now,
    };
    const parsed = MemoryRecordKind.schema.safeParse(head);
    if (!parsed.success) return { state: "refused", why: "invalid", detail: parsed.error.issues.map((i) => i.message).join("; ") };
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "record.json"), `${JSON.stringify(head, null, 2)}\n`, "utf8");
    writeFileSync(join(dir, "entries.jsonl"), "", { flag: "a" });
    return { state: "opened", version: this.version(dir) };
  }

  keep(id: string, entry: MemoryEntry): { state: "kept"; version: string } | { state: "none" } {
    const dir = this.dir(id);
    if (!dir || !existsSync(join(dir, "record.json"))) return { state: "none" };
    const e = MemoryEntrySchema.parse({ ...entry, text: entry.text.replace(/\s+/g, " ").trim() });
    appendFileSync(join(dir, "entries.jsonl"), `${JSON.stringify(e)}\n`, "utf8");
    return { state: "kept", version: this.version(dir) };
  }

  recall(id: string): { state: "hit"; record: MemoryRecordView } | { state: "none" } {
    const dir = this.dir(id);
    if (!dir || !existsSync(join(dir, "record.json"))) return { state: "none" };
    const head = JSON.parse(readFileSync(join(dir, "record.json"), "utf8")) as { id: string; title?: string; scope: MemoryScope; about?: string[] };
    const entries: MemoryEntry[] = [];
    for (const line of this.lines(dir)) {
      // A line that is not an entry is skipped, never fatal: one torn write
      // must not cost every other agent its memory.
      try {
        const e = MemoryEntrySchema.safeParse(JSON.parse(line));
        if (e.success) entries.push(e.data);
      } catch {
        // skipped, as above
      }
    }
    return {
      state: "hit",
      record: { id: head.id, title: head.title ?? head.id, scope: head.scope, about: head.about ?? [], entries, version: this.version(dir) },
    };
  }

  private lines(dir: string): string[] {
    const p = join(dir, "entries.jsonl");
    return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim()) : [];
  }

  private version(dir: string): string {
    const h = createHash("sha1").update(readFileSync(join(dir, "record.json"), "utf8"));
    const p = join(dir, "entries.jsonl");
    if (existsSync(p)) h.update(readFileSync(p, "utf8"));
    return h.digest("hex");
  }
}
