/*
 * translation-review.js: a block's translation, in that block's feedback
 * panel (owner, 2026-11-14: "add to the feedback controls (edit, suggest,
 * etc) interface to fixing/adjudication of translation via github issue
 * workflow. should indicate translation status of content block").
 *
 * On a translated page, every block's 📣 panel gets a 🌐 pane: the state of
 * the catalogue(s) that translate the block into the page's language, and two
 * controls that file the same `translation-adjudication/v1` issue the
 * translation review page files:
 *
 *   - ✓ Translation OK: an `acceptable` verdict for that catalogue and locale.
 *   - ✎ Fix translation: the catalogue's strings whose `#:` reference names
 *     this block's source file, each with a box for better text; every filled
 *     box becomes a suggestion of one `mistranslation` item.
 *
 * Where the data comes from (cat-harness-tools, scripts/gen-translation-status.ts):
 * `assets/translation-status/review.json`, `folio-translation-review/v1`, a
 * sibling of the status projection `fa-translation-meta.statusSrc` names. It
 * is fetched when a panel first opens, never at page load. The issue contract
 * (title prefix, label, fence, URL limit) is read from that file too, so this
 * script states none of it; the body is written the way the review page's
 * own script writes it (scripts/lib/translation-review-page.ts), and the
 * workflow reads only its fenced JSON block.
 *
 * Which catalogues are this block's: those whose `sources` (the `#:`
 * references of the catalogue) name the block's source file, `data-src` or
 * the GitHub path of its ✎ edit link. A block with no source of its own falls
 * back to the page's `translationSource`. Nothing is guessed beyond that: no
 * match says so, and links to the review page.
 *
 * Mounted through the block panel's extension point (`window.faBlockPanel`,
 * from edit-links.js, which is loaded before this file). Nothing is written
 * as HTML: every string from the catalogue or the projection is text.
 */
(() => {
  if (window.faTranslationReview) return;
  const PANE = "translation";
  const STATE_TEXT = {
    none: "No catalogue in this language",
    empty: "Not translated yet",
    machine: "Machine translation, not reviewed by a person",
    flagged: "Flagged for review",
    reviewed: "Reviewed by a person",
    stale: "Reviewed, but changed since the review",
    official: "Official translation",
  };
  // States a person can adjudicate: the review page's ADJUDICABLE.
  const ADJUDICABLE = ["machine", "flagged", "stale", "reviewed"];
  const el = (tag, props, kids) => {
    const e = Object.assign(document.createElement(tag), props || {});
    for (const k of kids || []) if (k !== null && k !== undefined) e.append(k);
    return e;
  };

  // ── The page: its language, and where the projection is ──
  const meta = () => {
    const n = document.getElementById("fa-translation-meta");
    if (!n) return null;
    try { return JSON.parse(n.textContent); } catch { return null; }
  };
  const pageFacts = () => {
    const m = meta();
    if (!m || !m.lang) return null;
    // A translated page: it names what it translates, or it is not in the
    // source language. The projection decides the rest: a locale with no
    // catalogues shows nothing to adjudicate.
    if (!m.translationSource && m.lang === "en") return null;
    const src = m.reviewSrc || (m.statusSrc ? m.statusSrc.replace(/index\.json$/, "review.json") : "");
    if (!src) return null;
    return { locale: m.lang, src: src, translationSource: m.translationSource || "" };
  };

  let review = null;
  const load = (src) => {
    if (!review) {
      review = fetch(src, { credentials: "same-origin" })
        .then((r) => {
          if (r.status === 404) return { absent: true };
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .catch((e) => { review = null; return { error: e.message }; });
    }
    return review;
  };

  // ── Which catalogues translate this block ──
  const norm = (p) => String(p || "").replace(/^\.?\/+/, "").replace(/[?#].*$/, "");
  const samePath = (a, b) => {
    a = norm(a); b = norm(b);
    return !!a && !!b && (a === b || a.endsWith("/" + b) || b.endsWith("/" + a));
  };
  const GH = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|edit)\/[^/]+\/([^#?]+)/;
  const blockSource = (box) => {
    if (box.dataset.src) return { src: box.dataset.src, repo: box.dataset.repo || "" };
    for (const a of box.querySelectorAll("[data-src], a[data-fa-link], a.ba-edit")) {
      if (a.dataset.src) return { src: a.dataset.src, repo: a.dataset.repo || "" };
      const m = GH.exec(a.getAttribute("href") || "");
      if (m) return { src: m[2].split("/").map(decodeURIComponent).join("/"), repo: m[1] };
    }
    return null;
  };
  const stem = (p) => norm(p).replace(/\.[^./]+$/, "");
  const matches = (doc, locale, source, translationSource) => {
    const out = [];
    for (const layer of doc.layers || []) {
      if ((layer.locales || []).indexOf(locale) < 0) continue;
      for (const row of layer.rows || []) {
        const cell = row.cells && row.cells[locale];
        if (!cell) continue;
        const srcs = row.sources || [];
        const byBlock = source && srcs.some((s) => samePath(s, source.src));
        const byPage = !source && translationSource && srcs.some((s) => samePath(stem(s), translationSource));
        if (byBlock || byPage) out.push({ layer: layer, row: row, cell: cell, sameRepo: !!(source && source.repo && layer.repository && source.repo.toLowerCase() === layer.repository.toLowerCase()) });
      }
    }
    // A block's own repository first, when the projection lists several layers.
    return out.some((m) => m.sameRepo) ? out.filter((m) => m.sameRepo) : out;
  };

  // ── The issue, built the way the review page builds it ──
  const code = (s) => { s = String(s).replace(/\n/g, "⏎"); return s.indexOf("`") >= 0 ? "`` " + s + " ``" : "`" + s + "`"; };
  const issueOf = (doc, layer, items, here) => {
    const cfg = doc.issue || {};
    const p = { $schema: cfg.schema, repository: layer.repository, layer: layer.name, translations: layer.translations, items: items };
    const acc = items.filter((i) => i.verdict === "acceptable"), mis = items.filter((i) => i.verdict !== "acceptable");
    const title = cfg.titlePrefix + " " + layer.name + ": " + [acc.length ? acc.length + " acceptable" : "", mis.length ? mis.length + " mistranslation" + (mis.length === 1 ? "" : "s") : ""].filter(Boolean).join(", ");
    const L = ["Translation review of **" + layer.name + "** (`" + layer.translations + "`), filed from the translation status page.", "",
      "By filing this issue, I (its author) adjudicate the machine translations below. The workflow records my GitHub login as the reviewer and opens a pull request; nothing is recorded in anyone else's name.", ""];
    if (here) L.push("Filed from the block **" + here.label + "** on " + here.url, "");
    if (acc.length) { L.push("### Acceptable", ""); acc.forEach((i) => L.push("- [x] `" + i.locale + "` " + code(i.catalogue) + (i.note ? " — " + i.note : ""))); L.push(""); }
    if (mis.length) {
      L.push("### Mistranslations, with suggestions", "");
      mis.forEach((i) => {
        L.push("- `" + i.locale + "` " + code(i.catalogue) + (i.note ? " — " + i.note : ""));
        i.suggestions.forEach((s) => L.push("  - " + code(s.msgid) + (s.msgctxt ? " (context " + code(s.msgctxt) + ")" : "") + ": " + code(s.current) + " → " + code(s.suggested) + (s.source ? " (candidate from " + s.source.kind + " " + code(s.source.id) + ")" : "") + (s.note ? " — " + s.note : "")));
      });
      L.push("");
    }
    L.push("<details><summary>Machine-readable record (what the workflow reads; please don't edit)</summary>", "", "```" + cfg.fence, JSON.stringify(p, null, 1), "```", "", "</details>");
    const body = L.join("\n");
    const base = "https://github.com/" + layer.repository + "/issues/new?";
    const url = base + new URLSearchParams({ title: title, labels: cfg.label, body: body }).toString();
    return url.length <= (cfg.maxUrl || 7500)
      ? { url: url, title: title, body: body }
      : { short: base + new URLSearchParams({ title: title, labels: cfg.label }).toString(), title: title, body: body };
  };
  // A link that opens the issue, or, past GitHub's URL limit, copy-then-open.
  const issueControls = (is, what) => {
    const wrap = el("div", { className: "fa-trf-issue" });
    if (is.url) {
      const a = el("a", { className: "fa-trf-btn fa-trf-open", href: is.url, target: "_blank", rel: "noopener", textContent: "Open the GitHub issue: " + what });
      wrap.append(a);
      return wrap;
    }
    const ta = el("textarea", { className: "fa-trf-body", value: is.body, rows: 5, readOnly: true });
    ta.setAttribute("aria-label", "The issue text");
    const copy = el("button", { className: "fa-trf-btn", type: "button", textContent: "1. Copy the issue text" });
    copy.onclick = () => {
      const ok = () => { copy.textContent = "1. Copied ✓"; };
      try { navigator.clipboard.writeText(is.body).then(ok, () => { ta.select(); }); } catch { ta.select(); }
    };
    const a = el("a", { className: "fa-trf-btn", href: is.short, target: "_blank", rel: "noopener", textContent: "2. Open the issue and paste" });
    wrap.append(el("p", { textContent: "This review is too long for a link." }), copy, a, ta);
    return wrap;
  };

  // ── The catalogue, read as the review page reads it, with its #: references ──
  const unq = (s) => { const m = /"(.*)"\s*$/.exec(s); return m ? m[1].replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c)) : ""; };
  const parsePo = (text) => {
    const out = [];
    text.split(/\n\s*\n/).forEach((block) => {
      const e = { refs: [] };
      let f = null, obsolete = false;
      block.split("\n").forEach((l) => {
        if (l.indexOf("#~") === 0) obsolete = true;
        if (l.indexOf("#:") === 0) { e.refs.push(...l.slice(2).trim().split(/\s+/).filter(Boolean)); return; }
        if (l.indexOf("#,") === 0) { if (/\bfuzzy\b/.test(l)) e.fuzzy = true; return; }
        if (l.charAt(0) === "#") return;
        const m = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s/.exec(l);
        if (m) { f = m[1] === "msgstr[0]" ? "msgstr" : m[1]; if (/^msgstr\[[1-9]/.test(m[1])) f = "skip"; if (f !== "skip") e[f] = unq(l); return; }
        if (f && f !== "skip" && /^\s*"/.test(l)) e[f] = (e[f] || "") + unq(l);
      });
      if (obsolete || e.msgid === undefined || (e.msgid === "" && e.msgctxt === undefined) || e.msgid_plural !== undefined) return;
      out.push(e);
    });
    return out;
  };
  const sha16 = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  };
  const rawUrl = (layer, locale, catalogue) =>
    "https://raw.githubusercontent.com/" + layer.repository + "/main/" + (layer.translations + "/" + locale + "/" + catalogue + ".po").split("/").map(encodeURIComponent).join("/");

  let dlg = null;
  const fixDialog = async (doc, m, locale, source, here) => {
    if (!dlg) {
      dlg = el("dialog", { className: "fa-trf-dialog" });
      dlg.setAttribute("aria-labelledby", "fa-trf-dialog-title");
      document.body.append(dlg);
    }
    const title = el("h2", { id: "fa-trf-dialog-title", textContent: "Fix the translation (" + locale + ")" });
    const body = el("div", { className: "fa-trf-dialog-body" }, [el("p", { textContent: "Loading the catalogue…" })]);
    const cancel = el("button", { className: "fa-trf-btn", type: "button", textContent: "Cancel" });
    cancel.onclick = () => dlg.close();
    dlg.replaceChildren(title, el("p", { className: "fa-trf-dim", textContent: m.row.catalogue }), body, el("p", { className: "fa-trf-actions" }, [cancel]));
    if (!dlg.open) dlg.showModal();
    let text;
    const url = rawUrl(m.layer, locale, m.row.catalogue);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      text = await r.text();
    } catch (err) {
      body.replaceChildren(el("p", { textContent: "Could not load the catalogue " + url + ": " + err.message }));
      return;
    }
    // Candidate translations from other sources, the sidecar beside the .po
    // (translation-candidates/v1). Absent or unreadable: the reviewer types their own.
    const issue = doc.issue || {};
    const candSchema = issue.candidatesSchema || "translation-candidates/v1";
    const cands = {};
    try {
      const rc = await fetch(url.replace(/\.po$/, issue.candidatesSuffix || ".candidates.json"));
      if (rc.ok) {
        const cf = await rc.json();
        if (cf && cf.$schema === candSchema && Array.isArray(cf.entries)) for (const e of cf.entries) {
          if (e && typeof e.msgid === "string" && Array.isArray(e.candidates))
            cands[(e.msgctxt || "") + "\u0004" + e.msgid] = e.candidates.filter((c) => c && typeof c.text === "string" && c.source && typeof c.source.kind === "string" && typeof c.source.id === "string");
        }
      }
    } catch { /* no candidates */ }
    let hash;
    try { hash = await sha16(text); } catch (err) {
      // crypto.subtle exists only on a secure (https) page.
      body.replaceChildren(el("p", { textContent: "Could not fingerprint the catalogue on this page (" + err.message + "); use the review page instead." }));
      return;
    }
    const all = parsePo(text);
    // This block's strings: those whose #: reference names its source file.
    const mine = source ? all.filter((e) => e.refs.some((r) => samePath(r.replace(/:\d+$/, ""), source.src))) : all;
    const kids = [];
    if (hash !== m.cell.hash) kids.push(el("p", { className: "fa-trf-warn", textContent: "This catalogue has changed since the site was built; your suggestions are made against the newest version." }));
    if (!mine.length) {
      kids.push(el("p", { textContent: "No string in this catalogue names this block's source file." }));
      body.replaceChildren(...kids);
      return;
    }
    kids.push(el("p", { textContent: "For each string you find wrong, pick one of the candidate translations (each names its source) or type your own. Leave the others empty." }));
    const list = el("ol", { className: "fa-trf-strings" });
    const boxes = mine.map((e, i) => {
      const id = "fa-trf-s" + i;
      const ta = el("textarea", { id: id, rows: 2 });
      ta.dataset.i = String(i);
      // A choice fills the suggestion and records its source; editing the
      // text makes it the reviewer's own (as the review page does).
      const choices = el("fieldset", { className: "fa-trf-cands" });
      choices.append(el("legend", { textContent: "Candidates" }));
      for (const c of cands[(e.msgctxt || "") + "\u0004" + e.msgid] || []) {
        if (c.text === e.msgstr) continue;
        const r = el("input", { type: "radio", name: "fa-trf-cand-" + i });
        r.onchange = () => { ta.value = c.text; ta.dataset.srcText = c.text; ta.dataset.src = JSON.stringify({ kind: c.source.kind, id: c.source.id }); };
        choices.append(el("label", { className: "fa-trf-cand" }, [r, el("span", { lang: locale, textContent: c.text }), el("span", { className: "fa-trf-dim", textContent: " \u2014 " + c.source.kind + " " + c.source.id })]));
      }
      list.append(el("li", {}, [
        el("div", { className: "fa-trf-src" }, [el("span", { className: "fa-trf-dim", textContent: "Source: " }), el("span", { lang: "en", textContent: e.msgid + (e.msgctxt ? " [" + e.msgctxt + "]" : "") })]),
        el("div", { className: "fa-trf-cur" }, [el("span", { className: "fa-trf-dim", textContent: "Now: " }), el("span", { lang: locale, textContent: e.msgstr || "(empty)" }),
          e.fuzzy ? el("span", { className: "fa-trf-dim", textContent: " (machine default, not reviewed)" }) : null]),
        choices.childElementCount > 1 ? choices : null,
        el("label", { htmlFor: id, textContent: "Your suggestion" }),
        ta,
      ]));
      return ta;
    });
    const note = el("input", { type: "text", id: "fa-trf-note" });
    const out = el("div", { className: "fa-trf-out" });
    out.setAttribute("aria-live", "polite");
    const go = el("button", { className: "fa-trf-btn fa-trf-primary", type: "button", textContent: "Make the GitHub issue" });
    go.onclick = () => {
      const sugg = [];
      for (const ta of boxes) {
        const v = ta.value.trim();
        if (!v) continue;
        const e = mine[+ta.dataset.i];
        const s = { msgid: e.msgid, current: e.msgstr || "", suggested: v };
        // The candidate's source only while its text is unedited.
        if (ta.dataset.src && ta.dataset.srcText === v) s.source = JSON.parse(ta.dataset.src);
        if (e.msgctxt !== undefined) s.msgctxt = e.msgctxt;
        sugg.push(s);
      }
      if (!sugg.length) { out.replaceChildren(el("p", { className: "fa-trf-warn", textContent: "Type at least one suggestion first." })); return; }
      const item = { catalogue: m.row.catalogue, locale: locale, verdict: "mistranslation", poHash: hash, suggestions: sugg };
      if (note.value.trim()) item.note = note.value.trim();
      out.replaceChildren(issueControls(issueOf(doc, m.layer, [item], here), sugg.length + " suggestion" + (sugg.length === 1 ? "" : "s")));
    };
    kids.push(list, el("p", {}, [el("label", { htmlFor: "fa-trf-note", textContent: "Note (optional) " }), note]), el("p", { className: "fa-trf-actions" }, [go]), out);
    body.replaceChildren(...kids);
    boxes[0].focus();
  };

  // ── The pane ──
  const statusText = (c) => {
    const when = c.at ? " on " + String(c.at).slice(0, 10) : "";
    if (c.state === "reviewed") return c.by ? "Reviewed by " + c.by + when : STATE_TEXT.reviewed;
    if (c.state === "stale") return (c.by ? "Reviewed by " + c.by + when : "Reviewed") + "; changed since the review";
    if (c.state === "official") return STATE_TEXT.official + (c.by ? ", signed off by " + c.by + when : "");
    if (c.state === "machine") return STATE_TEXT.machine + (c.generatedBy ? " (made by " + c.generatedBy + ")" : "");
    return STATE_TEXT[c.state] || c.state;
  };
  const render = async (label, inner) => {
    const facts = pageFacts();
    if (!facts) return;
    inner.classList.add("fa-trf");
    inner.replaceChildren(el("p", { className: "fa-trf-dim", textContent: "Loading the translation status…" }));
    const box = inner.closest(".fa-block-panel") && inner.closest(".fa-block-panel").querySelector('.block-actions[data-block="' + CSS.escape(label) + '"]')
      || document.querySelector('.block-actions[data-block="' + CSS.escape(label) + '"]');
    const doc = await load(facts.src);
    const kids = [];
    const root = facts.src.replace(/assets\/translation-status\/review\.json$/, "");
    if (doc.absent) kids.push(el("p", { textContent: "This site publishes no translation review." }));
    else if (doc.error) kids.push(el("p", { textContent: "Could not load the translation review (" + doc.error + ")." }));
    else {
      const source = box ? blockSource(box) : null;
      const found = matches(doc, facts.locale, source, facts.translationSource);
      const here = { label: label, url: location.href.split("#")[0] + "#" + encodeURIComponent(label) };
      if (!found.length) kids.push(el("p", { textContent: "No translation catalogue names this block's source" + (source ? " (" + source.src + ")" : "") + "." }));
      const list = el("ul", { className: "fa-trf-list" });
      for (const m of found) {
        const c = m.cell;
        const st = el("span", { className: "fa-trf-state", textContent: statusText(c) });
        st.dataset.faTrState = c.state;
        const li = el("li", { className: "fa-trf-cat" }, [st]);
        li.dataset.faTrCatalogue = m.row.catalogue;
        li.dataset.faTrState = c.state;
        if (found.length > 1) li.append(el("span", { className: "fa-trf-dim", textContent: " · " + m.row.catalogue }));
        if (c.fuzzy) li.append(el("p", { className: "fa-trf-dim", textContent: c.fuzzy + " string" + (c.fuzzy === 1 ? "" : "s") + " show a machine default that no person has reviewed." }));
        if (c.state === "flagged" && c.flagReason) li.append(el("p", { className: "fa-trf-dim fa-trf-why", textContent: c.flagReason }));
        if (m.layer.repository && ADJUDICABLE.indexOf(c.state) >= 0 && (c.translated || 0) + (c.fuzzy || 0) > 0 && c.hash) {
          const out = el("div", { className: "fa-trf-out" });
          out.setAttribute("aria-live", "polite");
          const ok = el("button", { className: "fa-trf-btn fa-trf-ok", type: "button", textContent: "✓ Translation OK" });
          ok.title = "Say this translation is acceptable: opens a GitHub issue in your name";
          ok.onclick = () => {
            const is = issueOf(doc, m.layer, [{ catalogue: m.row.catalogue, locale: facts.locale, verdict: "acceptable", poHash: c.hash }], here);
            out.replaceChildren(issueControls(is, "translation OK"));
            if (is.url) window.open(is.url, "_blank", "noopener");
          };
          const fix = el("button", { className: "fa-trf-btn fa-trf-fix", type: "button", textContent: "✎ Fix translation" });
          fix.title = "Suggest better text for this block's strings: opens a GitHub issue in your name";
          fix.onclick = () => fixDialog(doc, m, facts.locale, source, here);
          li.append(el("div", { className: "fa-trf-actions" }, [ok, fix]), out);
        } else if (!m.layer.repository && ADJUDICABLE.indexOf(c.state) >= 0) {
          li.append(el("p", { className: "fa-trf-dim", textContent: "This layer declares no repository, so its translation cannot be reviewed from here." }));
        }
        list.append(li);
      }
      if (found.length) kids.push(list);
      if (doc.reviewPage) {
        const a = el("a", { className: "fa-trf-more", href: root + doc.reviewPage, textContent: "Every translation, and who reviewed it →" });
        kids.push(el("p", {}, [a]));
      }
      kids.push(el("p", { className: "fa-trf-dim", textContent: "Filing the issue makes you, by your GitHub login, the reviewer. A suggestion is recorded as text awaiting review, never as accepted." }));
    }
    inner.replaceChildren(...kids);
  };

  // ── Mounting: one 🌐 pane per block on a translated page ──
  const mount = () => {
    const bp = window.faBlockPanel;
    const facts = pageFacts();
    if (!bp || !facts) return false;
    bp.pane(PANE, { icon: "🌐", title: "Translation (" + facts.locale + ")", render: render });
    const add = (root) => { for (const box of (root || document).querySelectorAll(".block-actions")) if (!box.closest(".fa-block-panel")) bp.icon(box, PANE); };
    add();
    // Boxes made later (a section's box, a block filled after load) get theirs too.
    new MutationObserver((recs) => {
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches(".block-actions")) { if (!n.closest(".fa-block-panel") && !n.querySelector('.ba-ic[data-pane="' + PANE + '"]')) bp.icon(n, PANE); }
        else if (n.querySelector(".block-actions")) add(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
    return true;
  };
  window.faTranslationReview = { render: render, matches: matches, parsePo: parsePo, issueOf: issueOf };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
