/*
 * questionnaire-form.js: the form view of one Questionnaire on an IG site
 * (skill `fhir-questionnaire-wireframe`, step 2), drawn by the vendored NLM
 * LHC-Forms web component, and the ✍ suggest entry point (step 7).
 *
 * The page carries a `#fa-qform` element naming:
 *   data-json     the Questionnaire's rendered copy, relative to the page;
 *   data-lhc      the vendored LHC-Forms directory, relative to the page;
 *   data-fhir     the FHIR version LHC-Forms reads it as (R4, R4B, R5, STU3).
 * and a `#fa-edit-cfg` JSON block whose `suggest.profiles` names the
 * Questionnaire mode (`questionnaire-mode.js`) for the ✍ suggest runtime's
 * mode registry, and `suggest.builder` / `sw` the self-hosted Form Builder.
 *
 * Nothing is fetched from another origin. Three states, always visible:
 * loading, shown, and could-not-show naming the file and the error.
 */
(function () {
  "use strict";

  var root = document.getElementById("fa-qform");
  if (!root) return;
  var view = root.querySelector(".fa-qform-view");
  var state = root.querySelector(".fa-qform-state");
  var base = location.href.split("#")[0];
  var at = function (rel) { return new URL(rel, base).href; };
  var say = function (t, failed) { state.textContent = t; state.dataset.state = failed ? "failed" : "ok"; };

  var lhc = root.dataset.lhc.replace(/\/?$/, "/");
  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = at(lhc + "webcomponent/styles.css");
  document.head.appendChild(css);

  // In the order the package README gives; each waits for the one before.
  var scripts = ["webcomponent/assets/lib/zone.min.js", "webcomponent/runtime.js", "webcomponent/polyfills.js", "webcomponent/main.js", "fhir/lformsFHIRAll.min.js"];
  var load = function (i) {
    return i === scripts.length
      ? Promise.resolve()
      : new Promise(function (ok, no) {
          var s = document.createElement("script");
          s.src = at(lhc + scripts[i]);
          if (/runtime|polyfills|main/.test(scripts[i])) s.type = "module";
          s.onload = ok;
          s.onerror = function () { no(new Error("could not load " + scripts[i])); };
          document.head.appendChild(s);
        }).then(function () { return load(i + 1); });
  };
  var ready = function () {
    return new Promise(function (ok, no) {
      var t0 = Date.now();
      (function wait() {
        if (window.LForms && window.LForms.Util && window.LForms.Util.addFormToPage) return ok();
        if (Date.now() - t0 > 20000) return no(new Error("LHC-Forms did not start"));
        setTimeout(wait, 50);
      })();
    });
  };

  var original;
  say("Loading the form…");
  Promise.all([
    fetch(at(root.dataset.json)).then(function (r) {
      if (!r.ok) throw new Error(root.dataset.json + ": HTTP " + r.status);
      return r.json();
    }),
    load(0).then(ready),
  ])
    .then(function (got) {
      original = got[0];
      return window.LForms.Util.addFormToPage(original, view, { fhirVersion: root.dataset.fhir || "R4" });
    })
    .then(function () { say(""); })
    .catch(function (e) { say("Could not show the form: " + e.message, true); });

  // ✍ suggest. A ✍ suggest runtime with the mode registry (cat-harness-tools
  // edit-links, `window.faEditLinks`) takes this over: it puts its own ✍ link
  // in this host when a profile serves the block (`data-suggest-mode`, a
  // `.json` source), and this link hands the click to it. Without one, the
  // page opens the mode itself, with the same `ctx` the runtime would give.
  var suggest = root.querySelector(".fa-qform-suggest");
  if (!suggest) return;
  var runtimeLink = function () {
    return window.faEditLinks ? root.querySelector('a[data-fa-link="suggest"]') : null;
  };
  window.addEventListener("load", function () { if (runtimeLink()) suggest.hidden = true; });
  suggest.addEventListener("click", function (e) {
    e.preventDefault();
    var rt = runtimeLink();
    if (rt) { rt.click(); return; }
    var cfgEl = document.getElementById("fa-edit-cfg");
    var cfg = cfgEl ? JSON.parse(cfgEl.textContent) : {};
    var prof = ((cfg.suggest && cfg.suggest.profiles) || []).filter(function (p) { return p && p.id === root.dataset.suggestMode; })[0];
    if (!original || !prof || !cfg.repo) return;
    var host = root.querySelector(".fa-qform-editor");
    if (host.dataset.open) return;
    host.dataset.open = "1";
    var status = document.createElement("p");
    status.className = "fa-qform-status";
    status.setAttribute("role", "status");
    host.appendChild(status);
    var label = root.dataset.block || root.dataset.src || "";
    var why = document.createElement("textarea");
    // The ctx the runtime gives: `text` the BUILT Questionnaire
    // (`data-suggest-text`, not the copy LHC-Forms renders, whose value sets
    // were expanded), `sourcePath` the FSH it was built from, `why` live.
    // `sourceText` is the runtime's read of the repository; the page has none.
    var ctx = {
      text: JSON.stringify(original, null, 2),
      sourcePath: root.dataset.src,
      get why() { return why.value.trim(); },
      src: root.dataset.src || root.dataset.json,
      path: root.dataset.src || root.dataset.json,
      label: label,
      kind: label.split(":")[0],
      repo: cfg.repo,
      branch: cfg.branch || "main",
      config: cfg,
      page: base,
      status: function (m) { status.textContent = String(m); },
    };
    var built = root.dataset.suggestText
      ? fetch(at(root.dataset.suggestText)).then(function (r) {
          if (!r.ok) throw new Error(root.dataset.suggestText + ": HTTP " + r.status);
          return r.text();
        })
      : Promise.resolve(ctx.text);
    Promise.all([import(at(prof.module)), built]).then(function (got) {
      var mode = got[0];
      ctx.text = got[1];
      var ed = mode.open(host, ctx);
      why.className = "fa-qform-why";
      why.rows = 3;
      why.placeholder = "What should change, and why? This becomes the issue's reason.";
      why.setAttribute("aria-label", "Why?");
      var out = document.createElement("div");
      out.className = "fa-qform-findings";
      out.setAttribute("aria-live", "polite");
      var send = document.createElement("button");
      send.type = "button";
      send.textContent = "Check, then open the change request";
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      var close = function () {
        ed.dispose();
        host.textContent = "";
        delete host.dataset.open;
      };
      cancel.addEventListener("click", close);
      send.addEventListener("click", function () {
        Promise.resolve(ed.get()).then(function (after) {
          if (after === ctx.text) { ctx.status("Nothing has changed yet."); return; }
          var findings = mode.check(ctx.text, after, {});
          out.textContent = "";
          findings.forEach(function (f) {
            var p = document.createElement("p");
            p.className = "fa-qform-" + f.severity;
            p.textContent = (f.severity === "error" ? "Error: " : "Warning: ") + f.message;
            out.appendChild(p);
          });
          if (findings.some(function (f) { return f.severity === "error"; })) return;
          var r = mode.issue(ctx.text, after, ctx);
          // As the runtime does: the reader's Why appended when the body lacks it.
          r = { title: r.title, body: mode.withWhy(r.body, ctx.why) };
          var u = mode.issueUrl(cfg.repo, r);
          if (u.clipboard) {
            if (!navigator.clipboard) { ctx.status("Too long for a link, and the clipboard is blocked."); return; }
            navigator.clipboard.writeText(u.clipboard).catch(function () {});
          }
          window.open(u.url, "_blank", "noopener");
          close();
        }).catch(function (err) { ctx.status("Could not read the edit: " + err.message); });
      });
      host.appendChild(why);
      host.appendChild(send);
      host.appendChild(cancel);
      host.appendChild(out);
    }).catch(function (err) {
      host.textContent = "Could not open the editor: " + err.message;
      delete host.dataset.open;
    });
  });
})();
