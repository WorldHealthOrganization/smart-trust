/*
 * translation-review.js: a block's translation, in that block's feedback
 * panel (owner, 2026-11-14: "add to the feedback controls (edit, suggest,
 * etc) interface to fixing/adjudication of translation via github issue
 * workflow. should indicate translation status of content block").
 *
 * Every page's blocks get a 🌐 pane in their 📣 panel, source-language pages
 * included (owner, 2026-11-18, ruling 1). It lists every locale's current
 * translation of the block's strings and its status (official / adjudicated /
 * proposed / agent / MT / missing / stale), read from the catalogue's strings
 * projection (`folio-translation-strings/v1`, named by the review projection).
 * Where the site publishes no review it says so plainly and shows what the
 * page itself says (its languages and translation status).
 *
 * On a translated page it also gives the state of the catalogue(s) that
 * translate the block into the page's language; and the controls file the
 * same `translation-adjudication/v1` issue the translation review page files:
 *
 *   - ✓ Translation OK: an `acceptable` verdict for that catalogue and locale.
 *   - ✎ Fix translation: the catalogue's strings whose `#:` reference names
 *     this block's source file, each offering EVERY candidate with its
 *     provenance (source and version, date, author, stale, QA results, the
 *     unofficial default pick) and a box for the reviewer's own text; every
 *     chosen or filled one becomes a suggestion of one `mistranslation` item.
 *     A collaborator's suggestion adjudicates the string; anyone else's is
 *     recorded as a proposal beside the others (owner, 2026-11-18, rulings
 *     2–4; the workflow decides, from the issue author's role).
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
  // A string's status in one locale (cat-harness-tools translation-strings.ts STRING_STATUSES).
  const STRING_TEXT = {
    official: "official",
    adjudicated: "adjudicated by a collaborator",
    proposed: "proposed, not yet adjudicated",
    agent: "agent translation, not reviewed",
    mt: "machine translation, not reviewed",
    missing: "missing: the source text is shown",
    stale: "stale: translates an older source text",
    unattributed: "translated; who made it is not recorded",
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
    // Every page (owner, 2026-11-18): a translated page names what it
    // translates, or is not in the source language; a source page lists the
    // translations of its blocks.
    const translated = !!m.translationSource || m.lang !== "en";
    const src = m.reviewSrc || (m.statusSrc ? m.statusSrc.replace(/index\.json$/, "review.json") : "");
    return { locale: m.lang, translated: translated, src: src, translationSource: m.translationSource || "", meta: m };
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
  // `locale` null: a source-language page, where a row matches whatever its locales.
  const matches = (doc, locale, source, translationSource) => {
    const out = [];
    for (const layer of doc.layers || []) {
      if (locale && (layer.locales || []).indexOf(locale) < 0) continue;
      for (const row of layer.rows || []) {
        const cell = locale ? row.cells && row.cells[locale] : { state: "source" };
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
      "By filing this issue, I (its author) adjudicate the translations below if I am a collaborator of the repository, and otherwise propose them beside the others. The workflow records my GitHub login as the reviewer and opens a pull request; nothing is recorded in anyone else's name.", ""];
    if (here) L.push("Filed from the block **" + here.label + "** on " + here.url, "");
    if (acc.length) { L.push("### Acceptable", ""); acc.forEach((i) => L.push("- [x] `" + i.locale + "` " + code(i.catalogue) + (i.note ? " — " + i.note : ""))); L.push(""); }
    if (mis.length) {
      L.push("### Mistranslations, with suggestions", "");
      mis.forEach((i) => {
        L.push("- `" + i.locale + "` " + code(i.catalogue) + (i.note ? " — " + i.note : ""));
        i.suggestions.forEach((s) => L.push("  - " + (s.choose ? "chooses " : "proposes ") + code(s.msgid) + (s.msgctxt ? " (context " + code(s.msgctxt) + ")" : "") + ": " + code(s.current) + " → " + code(s.suggested) + (s.source ? " (candidate from " + s.source.kind + " " + code(s.source.id) + ")" : "") + (s.reason ? " because " + s.reason : "") + (s.note ? " — " + s.note : "")));
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

  // ── The strings projection (folio-translation-strings/v1): every string, every locale ──
  const stringsCache = {};
  const loadStrings = (doc, root, row) => {
    const cfg = doc.strings;
    if (!cfg || !cfg.base || !row.strings) return Promise.resolve(null);
    const url = root + cfg.base + row.strings;
    if (!stringsCache[url]) {
      stringsCache[url] = fetch(url, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.$schema === cfg.schema && Array.isArray(j.strings) ? j : null))
        .catch(() => null);
    }
    return stringsCache[url];
  };
  const keyOf = (msgctxt, msgid) => (msgctxt || "") + "\u0004" + msgid;

  // ── The rank, the tools layer's rankCandidates restated ──
  // The strings projection arrives ranked (cat-harness-tools
  // scripts/lib/translation-strings.ts), and the pane draws that order. This
  // ranks a bare candidates sidecar the same way, for a site that publishes
  // no projection; a cat-harness-tools test holds the two equal, fixture for
  // fixture. Tiers best first; a QA failure costs QA_PENALTY; a stale
  // candidate (made for another source text) goes last and is never the pick.
  const PICK_TIERS = ["official", "human-adjudicated", "human-proposed", "platform", "agent", "mt"];
  const PLATFORM_IDS = ["weblate", "crowdin", "transifex"];
  const QA_PENALTY = 10;
  const pickTier = (c, chosenText) => {
    const k = c.source.kind;
    if (k === "official") return "official";
    if (chosenText !== undefined && c.text === chosenText) return "human-adjudicated";
    if (k === "human") return "human-proposed";
    if (k === "web-service" && PLATFORM_IDS.indexOf(String(c.source.id).toLowerCase()) >= 0) return "platform";
    if (k === "agent") return "agent";
    return "mt";
  };
  // A check not run is not a failure.
  const qaFailures = (c) => {
    const q = c.qa || {}, out = [];
    if (q.glossary && !q.glossary.pass) out.push("glossary: " + ((q.glossary.missing || []).join(", ") || "terms") + " not translated as the glossary fixes");
    if (q.placeholders && !q.placeholders.pass) out.push("placeholders do not round-trip");
    if (q.roundtrip && !q.roundtrip.pass) out.push("round trip " + Number(q.roundtrip.score).toFixed(2) + " < " + q.roundtrip.threshold);
    return out;
  };
  // `hash`: the string's msgidHash now, sha16(msgctxt U+0004 msgid U+0000 msgid_plural).
  const rankCandidates = (entry, hash) => {
    if (!entry) return [];
    const chosenText = entry.chosen && entry.chosen.how === "adjudicated" ? entry.chosen.text : undefined;
    const ranked = (entry.candidates || []).map((candidate, index) => {
      const tier = pickTier(candidate, chosenText), qa = qaFailures(candidate);
      return { index: index, candidate: candidate, tier: tier, score: PICK_TIERS.indexOf(tier) + (qa.length ? QA_PENALTY : 0), qaFailures: qa, stale: candidate.msgidHash !== undefined && candidate.msgidHash !== hash };
    });
    const at = (x) => x.candidate.source.at || "";
    return ranked.sort((a, b) => Number(a.stale) - Number(b.stale) || a.score - b.score || at(b).localeCompare(at(a)) || a.index - b.index);
  };
  const ofBlock = (proj, source) => (proj.strings || []).filter((x) => !source || (x.sources || []).some((f) => samePath(f, source.src)));
  // A candidate's provenance, in words: source and version, date, author, issue, staleness, QA.
  const provenance = (c) => {
    const p = [];
    if (c.source.version) p.push("version " + c.source.version);
    if (c.source.at) p.push(String(c.source.at).slice(0, 10));
    if (c.source.by) p.push("by " + String(c.source.by).replace(/^github:/, ""));
    if (c.source.issue) p.push("issue #" + c.source.issue);
    if (c.source.kind === "official" && c.exactMatch !== undefined) p.push(c.exactMatch ? "matches the official source exactly" : "not an exact match to the official source");
    if (c.stale) p.push("stale: made for an older source text");
    const qa = c.qa || {};
    if (qa.glossary) p.push(qa.glossary.pass ? "glossary ✓" : "glossary ✗" + (qa.glossary.missing && qa.glossary.missing.length ? ": " + qa.glossary.missing.join(", ") + " missing" : ""));
    if (qa.placeholders) p.push(qa.placeholders.pass ? "placeholders ✓" : "placeholders ✗");
    if (qa.roundtrip && typeof qa.roundtrip.score === "number") p.push("round trip " + qa.roundtrip.score.toFixed(2) + (qa.roundtrip.pass ? " ✓" : " ✗"));
    if (c.current) p.push("current");
    return p;
  };

  let dlg = null;
  const fixDialog = async (doc, m, locale, source, here, root) => {
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
    const picks = {};
    const bare = {};
    const proj = await loadStrings(doc, root || "", m.row);
    if (proj) for (const x of proj.strings) {
      const l = x.locales && x.locales[locale];
      if (!l) continue;
      cands[keyOf(x.msgctxt, x.msgid)] = (l.candidates || []).filter((c) => c && typeof c.text === "string" && c.source);
      if (l.pick) picks[keyOf(x.msgctxt, x.msgid)] = l.pick;
    }
    if (!proj) try {
      const rc = await fetch(url.replace(/\.po$/, issue.candidatesSuffix || ".candidates.json"));
      if (rc.ok) {
        const cf = await rc.json();
        if (cf && cf.$schema === candSchema && Array.isArray(cf.entries)) for (const e of cf.entries) {
          if (e && typeof e.msgid === "string" && Array.isArray(e.candidates))
            bare[keyOf(e.msgctxt, e.msgid)] = { candidates: e.candidates.filter((c) => c && typeof c.text === "string" && c.source && typeof c.source.kind === "string" && typeof c.source.id === "string"), chosen: e.chosen };
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
    // A bare sidecar, ranked here as the projection would have ranked it.
    for (const e of all) {
      const k = keyOf(e.msgctxt, e.msgid);
      if (!bare[k]) continue;
      const ranked = rankCandidates(bare[k], await sha16(k + "\u0000"));
      cands[k] = ranked.map((x) => Object.assign({}, x.candidate, { tier: x.tier, score: x.score, stale: x.stale, qaFailures: x.qaFailures, current: x.candidate.text === e.msgstr }));
    }
    // This block's strings: those whose #: reference names its source file.
    const mine = source ? all.filter((e) => e.refs.some((r) => samePath(r.replace(/:\d+$/, ""), source.src))) : all;
    const kids = [];
    if (hash !== m.cell.hash) kids.push(el("p", { className: "fa-trf-warn", textContent: "This catalogue has changed since the site was built; your suggestions are made against the newest version." }));
    if (!mine.length) {
      kids.push(el("p", { textContent: "No string in this catalogue names this block's source file." }));
      body.replaceChildren(...kids);
      return;
    }
    kids.push(el("p", { textContent: "For each string you find wrong, pick one of the candidate translations (each names its source) or type your own. Leave the others empty. Every suggestion is recorded as a proposal beside the others. Tick \u201cChoose as the translation\u201d to decide: only a collaborator's choice is recorded as the translation; anyone else's stays a proposal." }));
    const list = el("ol", { className: "fa-trf-strings" });
    const boxes = mine.map((e, i) => {
      const id = "fa-trf-s" + i;
      const ta = el("textarea", { id: id, rows: 2 });
      ta.dataset.i = String(i);
      // A choice fills the suggestion and records its source; editing the
      // text makes it the reviewer's own (as the review page does).
      const choices = el("fieldset", { className: "fa-trf-cands" });
      choices.append(el("legend", { textContent: "Candidates" }));
      // Every candidate, the current text included, each with its provenance (owner, 2026-11-18).
      const k = keyOf(e.msgctxt, e.msgid);
      let picked = false;
      for (const c of cands[k] || []) {
        const r = el("input", { type: "radio", name: "fa-trf-cand-" + i });
        r.onchange = () => { ta.value = c.text; ta.dataset.srcText = c.text; ta.dataset.src = JSON.stringify({ kind: c.source.kind, id: c.source.id }); };
        const extra = provenance(Object.assign({}, c, { current: c.current || c.text === e.msgstr }));
        const isPick = !picked && !!picks[k] && picks[k].text === c.text;
        if (isPick) { picked = true; extra.unshift(picks[k].unofficial === false ? "★ default (official)" : "★ default pick (unofficial)"); }
        const lab = el("label", { className: "fa-trf-cand" }, [r, el("span", { lang: locale, textContent: c.text }),
          el("span", { className: "fa-trf-dim", textContent: " \u2014 " + c.source.kind + " " + c.source.id + (extra.length ? " · " + extra.join(" · ") : "") })]);
        if (c.stale) lab.dataset.faTrStale = "true";
        if (c.qaFailures && c.qaFailures.length) lab.dataset.faTrQa = "fail";
        choices.append(lab);
      }
      // "Choose as the translation": recorded only for a collaborator (the workflow decides).
      const chooseId = "fa-trf-choose-" + i;
      const choose = el("input", { type: "checkbox", id: chooseId, className: "fa-trf-choose" });
      const reason = el("input", { type: "text", id: "fa-trf-reason-" + i, className: "fa-trf-reason" });
      ta.choose = choose;
      ta.reason = reason;
      const chooseRow = el("div", { className: "fa-trf-choose-row" }, [
        el("label", { className: "fa-trf-cand", htmlFor: chooseId }, [choose, el("span", { textContent: "Choose as the translation" })]),
        el("label", { htmlFor: "fa-trf-reason-" + i, textContent: "Why (optional)" }),
        reason,
      ]);
      list.append(el("li", {}, [
        el("div", { className: "fa-trf-src" }, [el("span", { className: "fa-trf-dim", textContent: "Source: " }), el("span", { lang: "en", textContent: e.msgid + (e.msgctxt ? " [" + e.msgctxt + "]" : "") })]),
        el("div", { className: "fa-trf-cur" }, [el("span", { className: "fa-trf-dim", textContent: "Now: " }), el("span", { lang: locale, textContent: e.msgstr || "(empty)" }),
          e.fuzzy ? el("span", { className: "fa-trf-dim", textContent: " (machine default, not reviewed)" }) : null]),
        choices.childElementCount > 1 ? choices : null,
        el("label", { htmlFor: id, textContent: "Your suggestion" }),
        ta,
        chooseRow,
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
        if (ta.choose.checked) s.choose = true;
        if (ta.reason.value.trim()) s.reason = ta.reason.value.trim();
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
  // What the page itself says, for a site that publishes no review.
  const pageSays = (facts) => {
    const m = facts.meta || {};
    const out = [];
    const avail = (m.availableLocales || []).filter(Boolean);
    if (avail.length) out.push(el("p", { textContent: "This page is published in: " + avail.join(", ") + "." }));
    if (facts.translated && m.translationStatus) out.push(el("p", { textContent: "This page's translation status: " + m.translationStatus + "." }));
    if (facts.translationSource) out.push(el("p", { className: "fa-trf-dim", textContent: "Translated from " + facts.translationSource + "." }));
    if (!out.length) out.push(el("p", { className: "fa-trf-dim", textContent: "The page names no other language." }));
    return out;
  };
  // Every locale's translation of this block's strings, with its status.
  const HOW_TEXT = { adjudicated: "chosen by ", "auto-official": "auto-picked: exact official match", auto: "auto-picked, unofficial" };
  const everyLocale = async (doc, root, m, source, own) => {
    const box = el("div", { className: "fa-trf-locales" });
    box.append(el("p", { className: "fa-trf-head", textContent: "In every language" }));
    const proj = await loadStrings(doc, root, m.row);
    if (!proj) {
      // No strings projection: the catalogue's state per locale is what there is.
      const ul = el("ul", { className: "fa-trf-list" });
      for (const l of m.layer.locales || []) {
        const c = m.row.cells && m.row.cells[l];
        if (!c) continue;
        const li = el("li", { className: "fa-trf-loc", textContent: l + ": " + statusText(c) });
        li.dataset.faTrLocale = l;
        ul.append(li);
      }
      box.append(ul, el("p", { className: "fa-trf-dim", textContent: "This site publishes no per-string translations for this catalogue." }));
      return box;
    }
    const mine = ofBlock(proj, source);
    if (!mine.length) { box.append(el("p", { textContent: "No string in this catalogue names this block's source file." })); return box; }
    const list = el("ol", { className: "fa-trf-strings fa-trf-every" });
    for (const x of mine) {
      const ul = el("ul", { className: "fa-trf-list" });
      // A translated page: its own locale first, the others collapsed below.
      const all = Object.keys(x.locales || {}).sort();
      const first = own && all.indexOf(own) >= 0 ? [own] : all;
      const rest = own && all.indexOf(own) >= 0 ? all.filter((l) => l !== own) : [];
      const more = rest.length ? el("details", { className: "fa-trf-others" }, [el("summary", { textContent: "Other languages (" + rest.length + ")" })]) : null;
      const moreUl = more ? el("ul", { className: "fa-trf-list" }) : null;
      if (more) more.append(moreUl);
      for (const l of first.concat(rest)) {
        const t = x.locales[l];
        const st = el("span", { className: "fa-trf-state", textContent: STRING_TEXT[t.status] || t.status });
        st.dataset.faTrState = t.status;
        const kids = [el("strong", { textContent: l + " " }), el("span", { lang: l, textContent: t.text || "—" }), " ", st];
        const ch = t.chosen && t.chosen.text === t.text ? t.chosen : null;
        if (ch) {
          const who = ch.how === "adjudicated" ? HOW_TEXT.adjudicated + String(ch.by || "").replace(/^github:/, "") + ", " + String(ch.at).slice(0, 10) + (ch.reason ? ": " + ch.reason : "") : HOW_TEXT[ch.how] || ch.how;
          const sp = el("span", { className: "fa-trf-dim fa-trf-how", textContent: " · " + who });
          sp.dataset.faTrHow = ch.how;
          kids.push(sp);
        }
        if (t.pick && t.pick.text !== t.text) kids.push(el("span", { className: "fa-trf-dim", textContent: " · default pick (" + (t.pick.unofficial === false ? "official" : "unofficial") + "): " + t.pick.text }));
        if ((t.candidates || []).length > 1) kids.push(el("span", { className: "fa-trf-dim", textContent: " · " + t.candidates.length + " candidates" }));
        const li = el("li", { className: "fa-trf-loc" }, kids);
        li.dataset.faTrLocale = l;
        li.dataset.faTrStatus = t.status;
        (first.indexOf(l) >= 0 ? ul : moreUl).append(li);
      }
      if (more) ul.append(el("li", {}, [more]));
      list.append(el("li", {}, [el("div", { className: "fa-trf-src" }, [el("span", { className: "fa-trf-dim", textContent: "Source: " }), el("span", { lang: "en", textContent: x.msgid + (x.msgctxt ? " [" + x.msgctxt + "]" : "") })]), ul]));
    }
    box.append(list);
    return box;
  };
  const render = async (label, inner) => {
    const facts = pageFacts();
    if (!facts) return;
    inner.classList.add("fa-trf");
    inner.replaceChildren(el("p", { className: "fa-trf-dim", textContent: "Loading the translation status…" }));
    const box = inner.closest(".fa-block-panel") && inner.closest(".fa-block-panel").querySelector('.block-actions[data-block="' + CSS.escape(label) + '"]')
      || document.querySelector('.block-actions[data-block="' + CSS.escape(label) + '"]');
    const doc = facts.src ? await load(facts.src) : { absent: true };
    const kids = [];
    const root = facts.src.replace(/assets\/translation-status\/review\.json$/, "");
    if (doc.absent) kids.push(el("p", { textContent: "This site publishes no translation review." }), ...pageSays(facts));
    else if (doc.error) kids.push(el("p", { textContent: "Could not load the translation review (" + doc.error + ")." }), ...pageSays(facts));
    else {
      const source = box ? blockSource(box) : null;
      const found = matches(doc, facts.translated ? facts.locale : null, source, facts.translationSource);
      const here = { label: label, url: location.href.split("#")[0] + "#" + encodeURIComponent(label) };
      if (!found.length) kids.push(el("p", { textContent: "No translation catalogue names this block's source" + (source ? " (" + source.src + ")" : "") + "." }), ...pageSays(facts));
      const list = el("ul", { className: "fa-trf-list" });
      for (const m of found) {
        const c = m.cell;
        const li = el("li", { className: "fa-trf-cat" });
        li.dataset.faTrCatalogue = m.row.catalogue;
        if (facts.translated) {
          const st = el("span", { className: "fa-trf-state", textContent: statusText(c) });
          st.dataset.faTrState = c.state;
          li.dataset.faTrState = c.state;
          li.append(st);
          if (found.length > 1) li.append(el("span", { className: "fa-trf-dim", textContent: " · " + m.row.catalogue }));
          if (c.fuzzy) li.append(el("p", { className: "fa-trf-dim", textContent: c.fuzzy + " string" + (c.fuzzy === 1 ? "" : "s") + " show a machine default that no person has reviewed." }));
          if (c.state === "flagged" && c.flagReason) li.append(el("p", { className: "fa-trf-dim fa-trf-why", textContent: c.flagReason }));
          if (m.layer.repository && ADJUDICABLE.indexOf(c.state) >= 0 && (c.translated || 0) + (c.fuzzy || 0) > 0 && c.hash) {
            const out = el("div", { className: "fa-trf-out" });
            out.setAttribute("aria-live", "polite");
            const ok = el("button", { className: "fa-trf-btn fa-trf-ok", type: "button", textContent: "✓ Translation OK" });
            ok.title = "Say this translation is acceptable: opens a GitHub issue in your name (recorded only for a collaborator)";
            ok.onclick = () => {
              const is = issueOf(doc, m.layer, [{ catalogue: m.row.catalogue, locale: facts.locale, verdict: "acceptable", poHash: c.hash }], here);
              out.replaceChildren(issueControls(is, "translation OK"));
              if (is.url) window.open(is.url, "_blank", "noopener");
            };
            const fix = el("button", { className: "fa-trf-btn fa-trf-fix", type: "button", textContent: "✎ Fix translation" });
            fix.title = "Choose a candidate or suggest better text for this block's strings: opens a GitHub issue in your name";
            fix.onclick = () => fixDialog(doc, m, facts.locale, source, here, root);
            li.append(el("div", { className: "fa-trf-actions" }, [ok, fix]), out);
          } else if (!m.layer.repository && ADJUDICABLE.indexOf(c.state) >= 0) {
            li.append(el("p", { className: "fa-trf-dim", textContent: "This layer declares no repository, so its translation cannot be reviewed from here." }));
          }
        } else {
          li.append(el("span", { className: "fa-trf-dim", textContent: m.row.catalogue }));
          // A source page: a fix per locale that has a catalogue.
          if (m.layer.repository) {
            const acts = el("div", { className: "fa-trf-actions" });
            for (const l of m.layer.locales || []) {
              const cl = m.row.cells && m.row.cells[l];
              if (!cl || cl.state === "none" || !cl.hash) continue;
              const b = el("button", { className: "fa-trf-btn fa-trf-fix", type: "button", textContent: "✎ Fix translation (" + l + ")" });
              b.dataset.faTrLocale = l;
              b.onclick = () => fixDialog(doc, Object.assign({}, m, { cell: cl }), l, source, here, root);
              acts.append(b);
            }
            if (acts.childElementCount) li.append(acts);
          }
        }
        li.append(await everyLocale(doc, root, m, source, facts.translated ? facts.locale : null));
        list.append(li);
      }
      if (found.length) kids.push(list);
      if (doc.reviewPage) {
        const a = el("a", { className: "fa-trf-more", href: root + doc.reviewPage, textContent: "Every translation, and who reviewed it →" });
        kids.push(el("p", {}, [a]));
      }
      kids.push(el("p", { className: "fa-trf-dim", textContent: "Filing the issue makes you, by your GitHub login, the reviewer. A collaborator's choice becomes the translation; anyone else's suggestion is kept as a proposal beside the others." }));
    }
    inner.replaceChildren(...kids);
  };

  // ── Mounting: one 🌐 pane per block on a translated page ──
  const mount = () => {
    const bp = window.faBlockPanel;
    const facts = pageFacts();
    if (!bp || !facts) return false;
    bp.pane(PANE, { icon: "🌐", title: facts.translated ? "Translation (" + facts.locale + ")" : "Translations", render: render });
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
  window.faTranslationReview = { render: render, matches: matches, parsePo: parsePo, issueOf: issueOf, rankCandidates: rankCandidates };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
