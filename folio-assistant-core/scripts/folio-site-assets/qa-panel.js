// qa-panel: one block's QA report, in a dialog (build-folio-site.ts).
// Loaded by folio-site.js the first time a reader opens a [QA] badge, so a
// page that is only read never downloads it. The report is
// `qa/<chapter>/<block>.json` (folio-site-qa-report/v1, folio-site-blocks.ts):
// each criterion's MOST RECENT verdict, who gave it and when, and whether the
// block's files have changed since (stale). Milnor exposition comes first.
//
// On a preview build that carries `preview-qa.json` beside its pages
// (preview-qa/v1, cat-harness-tools scripts/preview-qa.ts, written by
// stage-local and folio-site-publish), the panel opens with "This change
// (preview)": the tests and gates in the change's dependency cone, each judged
// against main's stored answer, and the main QA report follows below it
// (owner, 2026-11-14). No file (the main site, or an older build) shows the
// main report alone. The report is advisory; the release tier judges merges.
(() => {
  const el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  let dlg = null;
  const dialog = () => {
    if (dlg) return dlg;
    dlg = el("dialog", { class: "qa-dialog", "aria-label": "QA report" });
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    return dlg;
  };
  const bad = (r) => r === "fail" || r === "warn";
  const blob = (s, p) => (s ? `https://github.com/${s.repository}/blob/${s.ref}/${p}` : null);
  const linkOrCode = (s, p) => { const u = blob(s, p); return u ? el("a", { href: u, target: "_blank", rel: "noopener" }, p) : el("code", {}, p); };

  // ── "This change (preview)": the cone run, read once per page ──
  let previewReport;
  const loadPreview = (url) => {
    if (!url) return Promise.resolve(null);
    // Absent (404) or unreadable is "not a preview": the main report alone.
    previewReport ??= fetch(url, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.$schema === "preview-qa/v1" ? j : null))
      .catch(() => null);
    return previewReport;
  };
  const DELTA = { new: "new failure", fixed: "fixed", both: "changed failure", still: "still failing", clean: "clean", unknown: "main unknown" };
  const ORDER = ["new", "both", "unknown", "still", "fixed", "clean"];
  const previewSection = (r) => {
    const sec = el("section", { class: "qa-preview", "aria-label": "This change (preview)" });
    sec.append(el("h3", {}, "This change (preview)"));
    const short = (x) => (x || "").slice(0, 7);
    if (r.notRun || !r.cone) {
      sec.append(el("p", { class: "qa-meta" }, `commit ${short(r.head)} · not run. No cone run is recorded for this commit: label the PR \`preview\` to run the tests and gates in the change's dependency cone, judged against main.`));
      return sec;
    }
    const meta = el("p", { class: "qa-meta" });
    meta.append(`commit ${short(r.head)} against ${r.base} · ${r.main && r.main.available ? `main ${short(r.main.sha) || "answer"}` : "main's answer not stored"}`);
    if (r.run) { meta.append(" · "); meta.append(el("a", { href: r.run, target: "_blank", rel: "noopener" }, "cone run")); }
    sec.append(meta);
    const c = r.counts || {};
    const tests = r.cone.tests.kind === "all" ? "every test (none run here; the release tier runs the suite)" : `${r.cone.tests.files.length} test file(s)`;
    sec.append(el("p", { class: "qa-meta" }, `The cone: ${r.cone.changed.length} changed path(s), ${tests}, ${r.cone.gates.length} gate(s); ${r.cone.outside} gate(s) outside it. ` +
      (ORDER.filter((k) => c[k]).map((k) => `${c[k]} ${DELTA[k]}`).join(", ") || "nothing in the cone to run") + "."));
    if (r.results && r.results.length) {
      const rows = [...r.results].sort((a, b) => ORDER.indexOf(a.delta) - ORDER.indexOf(b.delta));
      const notClean = rows.filter((x) => x.delta !== "clean" && x.delta !== "fixed").length;
      const det = el("details", { class: "qa-group" });
      if (notClean) det.open = true;
      det.append(el("summary", {}, `${rows.length} check(s) in the cone${notClean ? `, ${notClean} not clean against main` : ""}`));
      const tb = el("table");
      const hr = el("tr");
      for (const h of ["vs main", "kind", "check", "here", "main", "findings"]) hr.append(el("th", {}, h));
      tb.append(hr);
      for (const x of rows) {
        const tr = el("tr");
        tr.append(el("td", { class: `delta delta-${x.delta}` }, DELTA[x.delta] || x.delta));
        tr.append(el("td", {}, x.kind));
        tr.append(el("td", {}, x.name));
        tr.append(el("td", {}, x.head));
        tr.append(el("td", {}, x.main));
        const f = [...(x.added || []).map((a) => `+ ${a}`), ...(x.removed || []).map((a) => `− ${a}`)];
        tr.append(el("td", { class: "notes" }, f.join("\n") || x.why || ""));
        tb.append(tr);
      }
      det.append(tb);
      sec.append(det);
    }
    for (const n of r.notes || []) sec.append(el("p", { class: "qa-meta" }, n));
    sec.append(el("p", { class: "qa-meta qa-advisory" }, "Advisory: run because the PR is labelled `preview`. The release tier and merge-guard judge the merge. The main QA report follows."));
    return sec;
  };

  const open = async ({ report, error, title, lean, source, leanStatus, previewUrl }) => {
    const preview = await loadPreview(previewUrl);
    const d = dialog();
    d.replaceChildren();
    const head = el("div", { class: "qa-head" });
    head.append(el("h2", {}, `QA report — ${title}`));
    const x = el("button", { type: "button", class: "qa-close", "aria-label": "Close" }, "✕");
    x.onclick = () => d.close();
    head.append(x);
    d.append(head);
    if (preview) {
      d.append(previewSection(preview));
      d.append(el("h3", { class: "qa-main-h" }, "Main QA"));
    }

    const meta = el("p", { class: "qa-meta" });
    if (error) d.append(error);
    else if (report) {
      const c = report.counts;
      meta.append(`${report.criteria.length} criteria: ${c.pass} pass, ${c.fail} fail, ${c.warn} warn, ${c.na} n/a${c.unknown ? `, ${c.unknown} without a verdict` : ""}; ${c.stale} stale (the block changed since the verdict). Each row is the criterion's most recent review. Sidecar: `);
      report.sidecars.forEach((p, i) => { if (i) meta.append(", "); meta.append(linkOrCode(source, p)); });
    } else meta.append("No QA verdict is recorded for this block.");
    d.append(meta);

    const lp = el("p", { class: "qa-meta" });
    if (lean && lean.path) {
      lp.append("Lean: ", linkOrCode(source, lean.path));
      const build = lean.compiles && lean.compiles !== "unchecked" ? `build ${lean.compiles}` : "build unchecked (no measured compile status)";
      lp.append(` (${lean.via === "ref" ? `via lean.ref ${lean.ref}` : "sibling"}; ${lean.sorry ? "has a sorry" : "no sorry"}${lean.sorryBasis === "text" ? " — read from the text" : ""}; ${build}${leanStatus && leanStatus.measuredAt ? `, measured ${leanStatus.measuredAt}` : ""})`);
      if (lean.error) lp.append(el("code", { class: "qa-err" }, lean.error));
    } else if (lean && lean.expected) {
      lp.append(`Lean: expected for this kind, none found${lean.ref ? ` (lean.ref ${lean.ref} ${lean.refState === "no-resolver" ? "could not be resolved: no Lean packages declared" : "does not resolve"})` : ""}.`);
    } else lp.append("Lean: not expected for this kind.");
    d.append(lp);

    if (report) {
      const groups = [];
      for (const r of report.criteria) {
        let g = groups[groups.length - 1];
        if (!g || g.name !== r.group) groups.push((g = { name: r.group, rows: [] }));
        g.rows.push(r);
      }
      for (const g of groups) {
        const n = g.rows.filter((r) => bad(r.result)).length;
        const det = el("details", { class: "qa-group" + (g.name === "Milnor" ? " milnor" : "") });
        if (g.name === "Milnor" || n) det.open = true;
        det.append(el("summary", {}, `${g.name === "Milnor" ? "Milnor exposition" : g.name} — ${g.rows.length} criteria${n ? `, ${n} not passing` : ""}`));
        const tb = el("table");
        const hr = el("tr");
        for (const h of ["criterion", "result", "reviewer", "date", "notes"]) hr.append(el("th", {}, h));
        tb.append(hr);
        for (const r of g.rows) {
          const tr = el("tr");
          tr.append(el("td", {}, r.id));
          const res = el("td", { class: `res res-${r.result === "n/a" ? "na" : r.result}`, title: r.stale ? `stale: ${(r.changed || []).join(", ")} changed since this review` : r.freshness !== "fresh" ? `freshness ${r.freshness === "unknown" ? "cannot be established" : r.freshness}${r.changed ? " — " + r.changed.join("; ") : ""}` : "" },
            `${r.result}${r.severity && r.result !== "pass" ? ` (${r.severity})` : ""}${r.stale ? " · stale" : r.freshness === "unknown" ? " · ?" : ""}`);
          tr.append(res);
          tr.append(el("td", {}, [r.reviewer, r.by, r.model].filter(Boolean).join(" · ") + (r.history > 1 ? ` (${r.history} reviews)` : "")));
          tr.append(el("td", {}, r.at || ""));
          const nt = el("td", { class: "notes" });
          if (r.notes) { const det2 = el("details"); det2.append(el("summary", {}, r.notes.slice(0, 90) + (r.notes.length > 90 ? "…" : ""))); det2.append(el("div", {}, r.notes)); nt.append(det2); }
          tr.append(nt);
          tb.append(tr);
        }
        det.append(tb);
        d.append(det);
      }
    }
    d.showModal();
  };
  window.folioSiteQa = { open };
})();
