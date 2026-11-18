/**
 * questionnaire-mode.js — the ✍ suggest editor's Questionnaire mode.
 *
 * A mode in the ✍ suggest runtime's registry (cat-harness-tools
 * `EDIT_LINKS_RUNTIME`, `cfg.suggest.profiles[]`; `pipeline/editor-profiles.ts`
 * documents the roles). Skill: fhir-harness `fhir-questionnaire-wireframe`,
 * step 7. It exports the three roles the runtime calls, by these names:
 *
 * - `open(host, ctx)` → `{ get(), dispose() }`. `ctx` is
 *   `{ text, sourceText, sourcePath, why, src, path, label, kind, repo,
 *   branch, config, status(msg) }`; `ctx.text` is the BUILT Questionnaire
 *   JSON (the host's `data-suggest-text`, the `.source.json` the IG compiled
 *   from FSH), `ctx.sourcePath` / `ctx.sourceText` the FSH it was built from,
 *   `ctx.why` the reader's reason as it stands (a live getter), and
 *   `ctx.config.suggest` carries the site's Form Builder (`builder`), its
 *   service worker (`sw`), the FSH `source` and the IG's `slug`. The panel in `host` asks which side was
 *   edited (the Questionnaire, or its L2 wireframe), opens the self-hosted
 *   NLM Form Builder in a window and keeps its hand-back, and offers a
 *   raw-JSON fallback. `get()` is awaited on Submit, never polled;
 *   `dispose()` closes the builder window.
 * - `check(before, after, opts)` → `[{ severity, message, line? }]`. Errors
 *   are syntax only and block Submit; warnings report only what the edit
 *   introduces (`checkSuggestion` in `check-wireframe-questionnaire`).
 * - `issue(before, after, ctx)` → `{ title, body }`: everything in the body
 *   (an RFC 6902 JSON Patch over the built Questionnaire, a before/after item
 *   table, the side that was edited and the FSH source link) but the
 *   reader's Why, which the host appends as `**Why:**` (the runtime does so
 *   when a mode's body lacks it), and NO `template`: GitHub ignores `body` when `template=` names an
 *   issue form, so the patch would be lost. The `questionnaire-change.yml`
 *   form stays for people filing by hand.
 *
 * What `open` learns (which side, the builder's round-trip of the original)
 * reaches `check` and `issue` through the session it keeps per `ctx`.
 *
 * A plain ES module with no build step and no dependency but the vendored
 * NLM tools the page already serves. Under a runtime without the registry the
 * form page's loader (`templates/ig-pages/questionnaire-form.js`) opens it
 * itself, with the same `ctx`, appends the Why with `withWhy` as the runtime
 * does, and builds the issue link with `issueUrl`.
 */
import { checkSuggestion } from "./check-wireframe-questionnaire.js";

/** GitHub answers 414 above about 8 KB of URL; the ✍ runtime's cap, which `issueUrl` mirrors. */
export const URL_CAP = 7000;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const esc = (s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * An RFC 6902 patch turning `a` into `b`. Objects are compared key by key,
 * arrays index by index (a trailing add or remove, a replace in between), so
 * a changed item's text is one `replace`, not the whole item list.
 */
export function jsonPatch(a, b, path = "") {
  if (same(a, b)) return [];
  if (isObj(a) && isObj(b)) {
    const ops = [];
    for (const k of Object.keys(a)) if (!(k in b)) ops.push({ op: "remove", path: `${path}/${esc(k)}` });
    for (const k of Object.keys(b)) {
      if (!(k in a)) ops.push({ op: "add", path: `${path}/${esc(k)}`, value: b[k] });
      else ops.push(...jsonPatch(a[k], b[k], `${path}/${esc(k)}`));
    }
    return ops;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const ops = [];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) ops.push(...jsonPatch(a[i], b[i], `${path}/${i}`));
    for (let i = n; i < b.length; i++) ops.push({ op: "add", path: `${path}/${i}`, value: b[i] });
    // Removed from the end backwards, so each index is still valid when applied.
    for (let i = a.length - 1; i >= n; i--) ops.push({ op: "remove", path: `${path}/${i}` });
    return ops;
  }
  return [{ op: "replace", path: path || "", value: b }];
}

/**
 * The `linkId` of the deepest item a patch path runs through, read in the
 * document the path addresses (`before` for replace and remove, `after` for
 * add). RFC 6902 §4 ignores members an operation does not define, so the
 * annotation rides on the operation itself.
 */
export function linkIdAt(doc, path) {
  let node = doc;
  let linkId;
  for (const raw of path.split("/").slice(1)) {
    const k = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (node === undefined || node === null) break;
    node = node[k];
    if (isObj(node) && typeof node.linkId === "string") linkId = node.linkId;
  }
  return linkId;
}

/** The patch, each operation annotated with the item it touches. */
export function annotatedPatch(before, after) {
  return jsonPatch(before, after).map((op) => {
    const linkId = linkIdAt(op.op === "add" ? after : before, op.path) ?? linkIdAt(after, op.path);
    return linkId ? { ...op, linkId } : op;
  });
}

/** Every item, depth first, by linkId. */
function itemsById(q) {
  const m = new Map();
  const walk = (items) => {
    for (const it of items ?? []) {
      if (it.linkId !== undefined) m.set(it.linkId, it);
      walk(it.item);
    }
  };
  walk(q?.item);
  return m;
}

const cell = (s) => (s === undefined || s === "" ? "—" : String(s).replace(/\s+/g, " ").replace(/\|/g, "\\|"));
const summary = (it) =>
  it === undefined
    ? undefined
    : [it.type, it.text, it.required ? "required" : undefined, it.repeats ? "repeats" : undefined, it.enableWhen?.length ? `enableWhen ${it.enableWhen.map((e) => e.question).join(", ")}` : undefined]
        .filter(Boolean)
        .join(" · ");

/** A readable before/after table of the items that changed, as Markdown. */
export function itemTable(before, after) {
  const a = itemsById(before);
  const b = itemsById(after);
  const rows = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id);
    const y = b.get(id);
    if (x && y && same({ ...x, item: undefined }, { ...y, item: undefined })) continue;
    rows.push(`| \`${cell(id)}\` | ${cell(summary(x))} | ${cell(summary(y))} |`);
  }
  if (!rows.length) return "No item changed (the change is to the Questionnaire's own elements; see the patch).";
  return ["| linkId | before | after |", "|---|---|---|", ...rows].join("\n");
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * What `open` shares with `check` and `issue`: per `ctx` (the runtime hands
 * `issue` the same object it gave `open`), and the latest open one for
 * `check`, which is given no `ctx`. Each holds the text it was opened on, so
 * a call about other text never reads it.
 */
const sessions = new WeakMap();
let last = null;
const sessionOf = (ctx, before) => {
  const s = (ctx && typeof ctx === "object" && sessions.get(ctx)) || last;
  return s && s.text === before ? s : undefined;
};
/**
 * The baseline an edit is measured against: the Form Builder's own
 * round-trip of the original when it sent one, so its normalisations are not
 * reported as the reviewer's; else `before` as given.
 */
const baseline = (before, s) => (s && s.roundTrip() ? JSON.stringify(s.roundTrip(), null, 2) : before);

/**
 * Findings on a suggested edit, in the runtime's shape
 * `[{ severity: "error" | "warning", message, line? }]`; an error blocks
 * Submit. Only what the edit introduces is reported. `opts.wireframe` is the
 * L2 wireframe's HTML when the Questionnaire was derived from one; the
 * runtime's `opts.kg` is not read.
 */
export function check(before, after, opts = {}) {
  const r = checkSuggestion(baseline(before, sessionOf(undefined, before)), after, { wireframe: opts.wireframe });
  return [...r.errors.map((message) => ({ severity: "error", message })), ...r.warnings.map((message) => ({ severity: "warning", message }))];
}

/**
 * The line of `sourceText` that declares the Questionnaire `id`
 * (`Instance: <id>`), 1-based, or undefined.
 */
export function instanceLine(sourceText, id) {
  if (typeof sourceText !== "string" || !id) return undefined;
  const i = sourceText.split(/\r?\n/).findIndex((l) => l.trim().split(/\s+/).join(" ") === `Instance: ${id}`);
  return i < 0 ? undefined : i + 1;
}

/**
 * The issue body with the reader's Why appended as `**Why:**`, exactly as the
 * ✍ runtime appends it to a mode's body: only when there is one and the body
 * does not already carry it. The form page's loader uses it when no runtime
 * with the mode registry is on the page.
 */
export function withWhy(body, why) {
  const w = String(why ?? "").trim();
  return w && body.indexOf(w) < 0 ? `${body}\n\n**Why:**\n${w}\n` : body;
}

/** A file in the IG repository, as a GitHub link (a `#L12` anchor kept). */
function sourceLink(source, repo, branch) {
  if (!repo) return `\`${source}\``;
  const [path, anchor] = source.split("#");
  return `[${source}](https://github.com/${repo}/blob/${branch}/${path.split("/").map(encodeURIComponent).join("/")}${anchor ? `#${anchor}` : ""})`;
}

/**
 * The change request, `{ title, body }`, with no `template` (see the module
 * comment). The runtime's `ctx` is read for `repo`, `branch`, `sourcePath`
 * (else `config.suggest.source`), `sourceText` (to anchor the source link on
 * the `Instance:` line) and `config.suggest.slug`; the side edited comes from
 * the session `open` keeps, unless `ctx.edited` says. The reader's Why is
 * not written here: the host appends it (`withWhy`). `ctx.page` is the form
 * page's URL.
 */
export function issue(before, after, ctx = {}) {
  const s = sessionOf(ctx, before);
  const base = baseline(before, s);
  const a = parse(base) ?? {};
  const b = parse(after) ?? {};
  const cfg = ctx.config?.suggest ?? {};
  const repo = ctx.repo ?? ctx.config?.repo;
  const branch = ctx.branch ?? ctx.config?.branch ?? "main";
  const given = ctx.sourcePath ?? ctx.source ?? cfg.source;
  const slug = ctx.slug ?? cfg.slug;
  const page = ctx.page ?? (typeof location === "object" && location ? String(location.href).split("#")[0] : undefined);
  const id = b.id ?? a.id ?? "?";
  const ref = b.url ?? a.url ?? `Questionnaire/${id}`;
  const edited = (ctx.edited ?? s?.edited()) === "wireframe" ? "wireframe" : "questionnaire";
  const line = given && !given.includes("#") ? instanceLine(ctx.sourceText, id) : undefined;
  const source = given && line ? `${given}#L${line}` : given;
  const patch = JSON.stringify(annotatedPatch(a, b), null, 2);
  const items = itemTable(a, b);
  const findings = ctx.findings ?? check(base, after);
  const body = [
    `**Questionnaire:** ${ref}`,
    `**Edited:** ${edited === "wireframe" ? "the L2 wireframe — bring the Questionnaire in line with it" : "the Questionnaire — bring the L2 wireframe in line with it"}`,
    ...(source ? [`**Source:** ${sourceLink(source, repo, branch)}`] : []),
    ...(page ? [`**Page:** ${page}`] : []),
    "",
    "### Items, before and after",
    "",
    items,
    "",
    "### JSON Patch (RFC 6902) over the built Questionnaire",
    "",
    "```json",
    patch,
    "```",
    ...(findings.length ? ["", "### Checker warnings (they do not block)", "", ...findings.map((f) => `- ${f.severity}: ${f.message}`)] : []),
    "",
    "_Filed with the ✍ suggest editor's Questionnaire mode; the `questionnaire-change` form asks for the same by hand._",
  ].join("\n");
  return { title: `Suggested edit${slug ? ` [${slug}]` : ""}: Questionnaire/${id}`, body };
}

/**
 * The `issues/new` URL for a change request, as the ✍ runtime builds it
 * (`openIssue`): title and body prefilled, `template` only when given; above
 * `URL_CAP` the body is carried on the clipboard and the link opens a stub.
 * The runtime builds its own; the form page's loader uses this one when no
 * runtime with the mode registry is on the page.
 */
export function issueUrl(repo, r) {
  const q = { title: r.title, body: r.body ?? "" };
  if (r.template) q.template = r.template;
  const full = `https://github.com/${repo}/issues/new?${new URLSearchParams(q)}`;
  if (full.length <= URL_CAP) return { url: full };
  return { url: `https://github.com/${repo}/issues/new?${new URLSearchParams({ title: r.title, body: "The suggested change is on the clipboard: paste it here." })}`, clipboard: r.body };
}

/**
 * The NLM Form Builder hand-back protocol (formbuilder-lhcforms API.md): the
 * host opens the builder with `referrer`, waits for `initialized`, posts
 * `initialQuestionnaire`, then receives `updateQuestionnaire`, `closed`,
 * `canceled` or `aborted`. Pure: `state` in, `{ state, reply }` out, so it is
 * tested without a window.
 */
export function builderStep(state, data, questionnaire) {
  switch (data?.type) {
    case "initialized":
      return { state: { ...state, status: "editing" }, reply: { type: "initialQuestionnaire", questionnaire } };
    // The builder's first version, sent before any edit, is its round-trip
    // of the original: the baseline a change is measured against, so its own
    // normalisations are not reported as the reviewer's.
    case "updateQuestionnaire":
      return { state: { ...state, status: "editing", latest: data.questionnaire ?? state.latest, roundTrip: state.roundTrip ?? data.questionnaire } };
    case "closed":
      return { state: { ...state, status: "closed", latest: data.questionnaire ?? state.latest, roundTrip: state.roundTrip ?? data.questionnaire } };
    case "canceled":
      return { state: { ...state, status: "canceled" } };
    case "aborted":
      return { state: { ...state, status: "aborted", error: String(data.error ?? "the Form Builder stopped") } };
    default:
      return { state };
  }
}

/** The builder's URL with the parameters its API reads. */
export function builderUrl(builder, referrer, fhirVersion = "R4") {
  const u = new URL(builder, referrer);
  u.searchParams.set("referrer", referrer);
  u.searchParams.set("fhirVersion", fhirVersion);
  return u.href;
}

const STATUS = {
  idle: "Not edited yet.",
  opening: "Opening the Form Builder…",
  editing: "Editing in the Form Builder. Changes arrive here as you make them.",
  closed: "The Form Builder was closed; its last version is kept.",
  canceled: "The Form Builder was cancelled; nothing from it is kept.",
  aborted: "The Form Builder stopped",
  blocked: "The browser blocked the Form Builder window. Allow pop-ups for this site, or edit the JSON below.",
};

/**
 * The editor, in `host`. `ctx.text` is the built Questionnaire as JSON;
 * `ctx.config.suggest` may name the self-hosted Form Builder (`builder`),
 * the service worker it needs (`sw`) and the FHIR version LHC-Forms reads
 * (`fhirVersion`); `ctx.status(msg)` is where progress is said, else a line
 * in the panel. Returns `{ get, dispose }`.
 */
export function open(host, ctx = {}) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const text = String(ctx.text ?? "");
  const original = parse(text);
  if (!isObj(original) || original.resourceType !== "Questionnaire") throw new Error(`${ctx.src ?? "the block"} is not a Questionnaire as JSON`);
  const cfg = ctx.config?.suggest ?? {};
  const here = win.location.href.split("#")[0];
  // The worker that answers the Form Builder's cross-site calls from this
  // site, registered now so it controls the builder from its first load (the
  // builder's own page registers it too, and reloads, when it does not).
  if (cfg.builder && cfg.sw && win.navigator?.serviceWorker)
    win.navigator.serviceWorker.register(new URL(cfg.sw.url, here).href, { scope: new URL(cfg.sw.scope, here).href }).catch(() => {});
  let state = { status: "idle", latest: undefined };
  let raw = false;
  let rawSeed = "";
  let child = null;

  const el = (tag, props = {}, kids = []) => {
    const e = doc.createElement(tag);
    Object.assign(e, props);
    for (const k of kids) e.append(k);
    return e;
  };
  const side = (v, label) => el("label", {}, [el("input", { type: "radio", name: "fa-q-edited", value: v, checked: v === "questionnaire" }), ` ${label}`]);
  const own = typeof ctx.status === "function" ? null : el("p", { className: "fa-q-status", textContent: STATUS.idle });
  if (own) own.setAttribute("role", "status");
  const say = (m) => (own ? (own.textContent = m) : ctx.status(m));
  const textarea = el("textarea", { className: "fa-q-raw", rows: 16, hidden: true, spellcheck: false });
  textarea.setAttribute("aria-label", "The Questionnaire as JSON");
  const builderBtn = el("button", { type: "button", textContent: "Open in the Form Builder", disabled: !cfg.builder });
  const rawBtn = el("button", { type: "button", textContent: "Edit the JSON" });
  const panel = el("div", { className: "fa-q-mode" }, [
    el("fieldset", {}, [el("legend", { textContent: "What did you edit?" }), side("questionnaire", "the Questionnaire"), " ", side("wireframe", "its L2 wireframe")]),
    el("p", {}, [builderBtn, " ", rawBtn]),
    ...(cfg.builder ? [] : [el("p", { className: "fa-q-note", textContent: "The Form Builder is not served on this site; edit the JSON instead." })]),
    ...(own ? [own] : []),
    textarea,
  ]);
  host.append(panel);
  if (!own) say(STATUS.idle);

  const show = () => say(state.status === "aborted" ? `${STATUS.aborted}: ${state.error}` : STATUS[state.status]);
  const onMessage = (e) => {
    if (!child || e.source !== child) return;
    const { state: next, reply } = builderStep(state, e.data, original);
    state = next;
    if (reply) child.postMessage(reply, e.origin);
    if (state.latest) textarea.value = rawSeed = JSON.stringify(state.latest, null, 2);
    show();
  };
  win.addEventListener("message", onMessage);

  builderBtn.addEventListener("click", () => {
    child = win.open(builderUrl(cfg.builder, here, cfg.fhirVersion), "fa-formbuilder");
    state = { ...state, status: child ? "opening" : "blocked" };
    show();
  });
  rawBtn.addEventListener("click", () => {
    raw = !raw;
    textarea.hidden = !raw;
    rawBtn.textContent = raw ? "Hide the JSON" : "Edit the JSON";
    if (raw && !textarea.value) textarea.value = rawSeed = JSON.stringify(state.latest ?? original, null, 2);
  });

  const session = {
    text,
    roundTrip: () => state.roundTrip,
    edited: () => panel.querySelector('input[name="fa-q-edited"]:checked')?.value ?? "questionnaire",
  };
  sessions.set(ctx, session);
  last = session;

  return {
    /**
     * The edited Questionnaire as JSON text: the raw JSON when it was edited,
     * else the builder's latest when it differs from its round-trip, else
     * `ctx.text` unchanged, so an untouched editor reads as no change.
     */
    get() {
      if (raw && textarea.value.trim() && textarea.value !== rawSeed) return textarea.value;
      if (state.latest && !same(state.latest, state.roundTrip)) return JSON.stringify(state.latest, null, 2);
      return text;
    },
    /** Runs on Submit, Cancel, ✕ and Esc: the builder window is closed. */
    dispose() {
      win.removeEventListener("message", onMessage);
      if (child && !child.closed) child.close();
      child = null;
      panel.remove();
      if (last === session) last = null;
    },
  };
}
