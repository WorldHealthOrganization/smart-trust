/* The journeys viewer's presentation script (cat-harness-tools
   scripts/journeys/present.ts). Dependency-free. Every page is complete
   without it; it adds what a facilitator does in a room:
   - ← / PageUp and → / PageDown: the previous and next moment (the page's
     <link rel="prev|next">);
   - W: reveal the "What if…"; T: show or hide what is under the hood;
   - presenter mode: the presenter's note and the facilitator cue, on or off,
     remembered in this browser;
   - the gap strip's answers, remembered in this browser only;
   - zoom on a BPMN drawing;
   - the device frame on or off, remembered in this browser;
   - a device screen's state switch (a valid card, a tampered one), and
     ?state=<id> to open on one;
   - the journey map's Focus on, its two toggles, and a click on a column;
   - tabs (the ArchiMate views, the payload drawer), the drawer, Inspect JSON
     and Copy;
   - the discussion's gap list, read from the gap strips' answers;
   - an old VaxLink address (#/walkthrough/J3b, #/map, #/personas/khamla,
     #/how/gdhcn, #/discuss, #/sheets, #/demo/S4) opens that view. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.documentElement;

  // The page's catalogue for the words this script writes (`journeys/locales.ts`); English without one.
  var I18N = (function () {
    try {
      var n = typeof document !== "undefined" && document.getElementById("jv-i18n");
      return n ? JSON.parse(n.textContent) : {};
    } catch (_e) {
      return {};
    }
  })();
  function T(s) {
    return I18N[s] || s;
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (_e) {
      return null;
    }
    return null;
  }
  function each(sel, fn) {
    Array.prototype.forEach.call(doc.querySelectorAll(sel), fn);
  }
  function linkHref(rel) {
    var l = doc.querySelector('link[rel="' + rel + '"]');
    return l ? l.getAttribute("href") : null;
  }

  function setPresenter(on) {
    root.setAttribute("data-presenter", on ? "on" : "off");
    store("jp:presenter", on ? "on" : "off");
  }

  function toggleWhatIf() {
    each("[data-jp-whatif]", function (s) {
      s.classList.toggle("is-open");
    });
  }

  function setHood(show) {
    var hood = doc.querySelector("[data-jp-hood]");
    var btn = doc.querySelector("[data-jp-hood-toggle]");
    if (!hood || !btn) return;
    hood.hidden = !show;
    btn.classList.toggle("is-on", show);
    btn.setAttribute("aria-expanded", String(show));
    store("jp:hood", show ? "on" : "off");
  }

  function zoom(box) {
    var fig = box.querySelector(".jv-bpmn");
    if (!fig) return;
    Array.prototype.forEach.call(box.querySelectorAll("[data-jp-zoom]"), function (b) {
      b.addEventListener("click", function () {
        var z = b.getAttribute("data-jp-zoom");
        if (z === "full") {
          if (fig.requestFullscreen) fig.requestFullscreen();
          return;
        }
        Array.prototype.forEach.call(box.querySelectorAll("[data-jp-zoom]"), function (x) {
          x.classList.toggle("is-on", x === b);
        });
        fig.classList.toggle("is-fit", z === "fit");
        if (z !== "fit") fig.style.setProperty("--z", z);
      });
    });
  }

  function remember(input) {
    var key = "jv:" + input.name;
    if (store(key) === input.value) input.checked = true;
    input.addEventListener("change", function () {
      if (input.checked) store(key, input.value);
    });
  }

  var VIEWS = { overview: 1, walkthrough: 1, map: 1, personas: 1, how: 1, discuss: 1, sheets: 1, demo: 1 };
  function oldAddress() {
    if (!doc.body.classList.contains("jp-overview")) return;
    var m = /^#\/([a-z]+)(?:\/([^/]+))?\/?$/.exec(location.hash);
    if (!m || !VIEWS[m[1]] || m[1] === "overview") return;
    location.replace("../" + m[1] + "/" + (m[2] ? encodeURIComponent(decodeURIComponent(m[2])) + "/" : ""));
  }

  function journeyMap(map) {
    var focus = null;
    function lanes(fn) {
      Array.prototype.forEach.call(map.querySelectorAll('[data-row="lane"]'), fn);
    }
    each("[data-jp-focus]", function (b) {
      b.addEventListener("click", function () {
        focus = b.getAttribute("data-jp-focus") || null;
        each("[data-jp-focus]", function (x) {
          x.classList.toggle("is-on", x === b);
        });
        lanes(function (r) {
          r.classList.toggle("is-dim", focus !== null && r.getAttribute("data-actor") !== focus);
        });
      });
    });
    each("[data-jp-show]", function (c) {
      c.addEventListener("change", function () {
        var g = c.getAttribute("data-jp-show");
        Array.prototype.forEach.call(map.querySelectorAll('[data-jp-group="' + g + '"]'), function (r) {
          r.hidden = !c.checked;
        });
      });
    });
    function select(col) {
      Array.prototype.forEach.call(map.querySelectorAll("[data-col]"), function (c) {
        c.classList.toggle("is-sel", c.getAttribute("data-col") === col);
      });
      each("[data-jp-panel]", function (p) {
        p.hidden = p.getAttribute("data-jp-panel") !== col;
      });
    }
    map.addEventListener("click", function (ev) {
      var c = ev.target.closest("[data-col]");
      if (!c) return;
      // A link inside a column still opens; a click elsewhere in it inspects that moment.
      if (ev.target.closest("a") && !ev.target.closest("[data-jp-col]")) return;
      if (ev.target.closest("[data-jp-col]")) ev.preventDefault();
      select(c.getAttribute("data-col"));
    });
    select("0");
  }

  function tabs(root) {
    function show(id) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-jp-tab]"), function (b) {
        var on = b.getAttribute("data-jp-tab") === id;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", String(on));
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-jp-pane]"), function (p) {
        p.hidden = p.getAttribute("data-jp-pane") !== id;
      });
    }
    Array.prototype.forEach.call(root.querySelectorAll("[data-jp-tab]"), function (b) {
      b.addEventListener("click", function () {
        show(b.getAttribute("data-jp-tab"));
      });
    });
    return show;
  }

  // highlightJson of present.ts, the same rule: keep the two alike.
  function esc(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function highlightJson(json) {
    var re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;
    var out = "";
    var last = 0;
    var m;
    while ((m = re.exec(json)) !== null) {
      out += esc(json.slice(last, m.index));
      if (m[1] !== undefined) out += m[2] !== undefined ? '<span class="jp-j-key">' + esc(m[1]) + "</span>" + esc(m[2]) : '<span class="jp-j-str">' + esc(m[1]) + "</span>";
      else if (m[3] !== undefined) out += '<span class="jp-j-num">' + m[3] + "</span>";
      else if (m[4] !== undefined) out += '<span class="jp-j-lit">' + m[4] + "</span>";
      else out += '<span class="jp-j-pun">' + esc(m[5]) + "</span>";
      last = m.index + m[0].length;
    }
    return out + esc(json.slice(last));
  }

  function drawer(d) {
    var pick = tabs(d);
    var bar = d.querySelector("[data-jp-drawer-toggle]");
    var body = d.querySelector(".jp-drawer-body");
    // A view page's panes name their JSON (data-jp-src) instead of carrying
    // it: one shared file per example, fetched and coloured when shown.
    // Opened from disk (file://) a browser refuses the fetch, so the pane
    // links the file instead: the browser opens a local JSON file itself.
    function offline(pre, why) {
      var src = pre.getAttribute("data-jp-src");
      var code = pre.querySelector("code");
      code.textContent = why + " ";
      var a = doc.createElement("a");
      a.href = src;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "jp-json-open";
      a.textContent = T("Open") + " " + src.replace(/^.*\//, "");
      code.appendChild(a);
    }
    function load() {
      if (body.hidden) return;
      var pre = d.querySelector("[data-jp-pane]:not([hidden]) pre[data-jp-src]");
      if (!pre || pre.hasAttribute("data-jp-loading")) return;
      if (location.protocol === "file:") {
        offline(pre, T("This page is open from disk, so the JSON is in its own file:"));
        return;
      }
      pre.setAttribute("data-jp-loading", "");
      fetch(pre.getAttribute("data-jp-src"))
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        })
        .then(function (json) {
          pre.querySelector("code").innerHTML = highlightJson(json);
          pre.removeAttribute("data-jp-src");
        })
        .catch(function () {
          offline(pre, T("Could not load this payload here."));
        })
        .then(function () {
          pre.removeAttribute("data-jp-loading");
        });
    }
    function show(id) {
      pick(id);
      load();
    }
    Array.prototype.forEach.call(d.querySelectorAll("[data-jp-tab]"), function (b) {
      b.addEventListener("click", load);
    });
    function open(on) {
      body.hidden = !on;
      bar.setAttribute("aria-expanded", String(on));
      load();
    }
    bar.addEventListener("click", function () {
      open(body.hidden);
    });
    each("[data-jp-inspect]", function (b) {
      b.addEventListener("click", function () {
        show(b.getAttribute("data-jp-inspect"));
        open(true);
        d.scrollIntoView({ block: "end" });
      });
    });
    var copy = d.querySelector("[data-jp-copy]");
    if (copy) {
      copy.addEventListener("click", function () {
        var pane = d.querySelector("[data-jp-pane]:not([hidden]) pre");
        if (!pane || pane.hasAttribute("data-jp-src") || !navigator.clipboard) return;
        navigator.clipboard.writeText(pane.textContent).then(function () {
          copy.textContent = T("Copied");
          setTimeout(function () {
            copy.textContent = T("Copy");
          }, 1500);
        });
      });
    }
  }

  // The gap report on the discussion page: the gap strip's answers in this
  // browser, summarised by assets/gap-report.js, drawn, printed and downloaded.
  function gapReport(g) {
    var lib = window.jpGapReport;
    var src = g.querySelector("[data-jp-gapreport-model]");
    if (!src) return;
    // gap-report.js is deferred after this script; DOMContentLoaded waits for every deferred script.
    if (!lib) {
      if (!g.hasAttribute("data-jp-waited")) {
        g.setAttribute("data-jp-waited", "");
        doc.addEventListener("DOMContentLoaded", function () {
          gapReport(g);
        });
      }
      return;
    }
    var model;
    try {
      model = JSON.parse(src.textContent);
    } catch (_e) {
      return;
    }
    var body = g.querySelector("[data-jp-gapreport-body]");
    var report = null;
    function el(tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    }
    function answer(name) {
      return store("jv:" + name);
    }
    function stepLink(step) {
      var a = el("a", "jp-revisit");
      a.href = step.href;
      a.title = step.title;
      a.appendChild(el("b", null, step.id));
      a.appendChild(el("span", null, step.title));
      return a;
    }
    function countsTable(caption, rows, head) {
      var t = el("table", "jp-gr-counts");
      t.appendChild(el("caption", null, caption));
      var tr = el("tr");
      tr.appendChild(el("th", null, head));
      report.statusOptions.forEach(function (o) {
        tr.appendChild(el("th", null, o.label));
      });
      tr.appendChild(el("th", null, T("Not rated")));
      var thead = el("thead");
      thead.appendChild(tr);
      t.appendChild(thead);
      var tb = el("tbody");
      rows.forEach(function (r) {
        var row = el("tr");
        var th = el("th");
        th.scope = "row";
        if (r.link) th.appendChild(r.link);
        else th.textContent = r.label;
        row.appendChild(th);
        report.statusOptions.forEach(function (o, i) {
          var n = r.counts.byStatus[o.id];
          row.appendChild(el("td", n && i > 0 ? "is-gap" : null, String(n)));
        });
        row.appendChild(el("td", "jp-gr-unrated", String(r.counts.unrated)));
        tb.appendChild(row);
      });
      t.appendChild(tb);
      return t;
    }
    function draw() {
      report = lib.summarise(model, answer);
      body.textContent = "";
      g.querySelector("[data-jp-gap-count]").textContent = String(report.gapCount);
      g.querySelector("[data-jp-gap-none]").hidden = report.gapCount > 0;
      report.gaps.forEach(function (u) {
        var sec = el("section", "jp-gr-urgency" + (u.urgency === null ? " is-unset" : ""));
        var n = 0;
        u.modules.forEach(function (m) {
          n += m.rows.length;
        });
        sec.appendChild(el("h4", "jp-gr-u", u.label + " (" + n + ")"));
        u.modules.forEach(function (m) {
          sec.appendChild(el("h5", "jp-gr-m", (m.module ? m.module + " · " : "") + m.title));
          var ul = el("ul", "jp-gr-rows");
          m.rows.forEach(function (r) {
            var li = el("li");
            li.appendChild(stepLink(r.step));
            li.appendChild(el("span", "jp-gr-cap", r.capability.label));
            li.appendChild(el("b", "jp-gr-st jp-gr-st-" + r.status, r.statusLabel));
            ul.appendChild(li);
          });
          sec.appendChild(ul);
        });
        body.appendChild(sec);
      });
      var grid = el("div", "jp-gr-grid");
      grid.appendChild(
        countsTable(
          T("Per moment"),
          report.perMoment.map(function (x) {
            return { link: stepLink(x.step), counts: x.counts };
          }),
          T("Moment"),
        ),
      );
      grid.appendChild(
        countsTable(
          T("Per module"),
          report.perModule.map(function (x) {
            return { label: (x.module ? x.module + " · " : "") + x.title, counts: x.counts };
          }),
          T("Module"),
        ),
      );
      body.appendChild(grid);
    }
    var print = g.querySelector("[data-jp-report-print]");
    if (print) {
      print.addEventListener("click", function () {
        root.classList.add("jp-print-report");
        window.print();
      });
      window.addEventListener("afterprint", function () {
        root.classList.remove("jp-print-report");
      });
    }
    var csvBtn = g.querySelector("[data-jp-report-csv]");
    if (csvBtn) {
      csvBtn.addEventListener("click", function () {
        var text = lib.csv(report || lib.summarise(model, answer), location.href);
        var url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
        var a = el("a");
        a.href = url;
        a.download = "gap-report.csv";
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      });
    }
    var clear = g.querySelector("[data-jp-gap-clear]");
    if (clear) {
      clear.addEventListener("click", function () {
        model.items.forEach(function (it) {
          [it.name.status, it.name.urgency].forEach(function (k) {
            if (!k) return;
            try {
              window.localStorage.removeItem("jv:" + k);
            } catch (_e) {
              /* storage unavailable */
            }
          });
        });
        draw();
      });
    }
    // Another tab answering the gap strip updates this one.
    window.addEventListener("storage", function (ev) {
      if (ev.key && ev.key.indexOf("jv:") === 0) draw();
    });
    draw();
  }

  // Write-ins and ticks kept in this browser (jv:<name>), as the gap strip keeps its
  // ratings: a journey question's answer is one key on the walkthrough and the lab.
  function keepText(el) {
    var key = "jv:" + el.name;
    var v = store(key);
    if (v !== null) el.value = v;
    el.addEventListener("input", function () {
      store(key, el.value);
    });
  }
  function keepCheck(el) {
    var key = "jv:" + el.name;
    var v = store(key);
    if (v !== null) el.checked = v === "1";
    el.addEventListener("change", function () {
      store(key, el.checked ? "1" : "0");
    });
  }
  function forget(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_e) {
      /* storage unavailable */
    }
  }

  // A step's timer: one click starts it, another stops it.
  function timer(b) {
    var label = b.querySelector("span");
    var start = label.textContent;
    var mins = Number(b.getAttribute("data-jp-timer"));
    var t = null;
    function show(left) {
      var m = Math.floor(left / 60);
      var sec = left % 60;
      label.textContent = T("Stop") + " · " + m + ":" + (sec < 10 ? "0" : "") + sec;
    }
    b.addEventListener("click", function () {
      if (t) {
        clearInterval(t);
        t = null;
        b.classList.remove("is-on", "is-up");
        label.textContent = start;
        return;
      }
      var end = Date.now() + mins * 60000;
      b.classList.add("is-on");
      b.classList.remove("is-up");
      show(mins * 60);
      t = setInterval(function () {
        var left = Math.max(0, Math.round((end - Date.now()) / 1000));
        show(left);
        if (left === 0) {
          clearInterval(t);
          t = null;
          b.classList.remove("is-on");
          b.classList.add("is-up");
          label.textContent = T("Time’s up · restart");
        }
      }, 1000);
    });
  }

  // The lab: one step at a time, chosen by its tab, the address (#lab-<id>) or
  // the last one this browser showed; the aside shows the use case as it is now.
  function lab(box) {
    var ws = box.getAttribute("data-jp-lab");
    var steps = box.querySelectorAll("[data-jp-lab-step]");
    var tabs = doc.querySelectorAll("[data-jp-lab-tab]");
    function show(id, scroll) {
      var found = false;
      Array.prototype.forEach.call(steps, function (s) {
        var on = s.getAttribute("data-jp-lab-step") === id;
        s.hidden = !on;
        found = found || on;
      });
      if (!found) return show(steps[0].getAttribute("data-jp-lab-step"), scroll);
      Array.prototype.forEach.call(tabs, function (t) {
        var on = t.getAttribute("data-jp-lab-tab") === id;
        t.classList.toggle("is-on", on);
        if (on) t.setAttribute("aria-current", "step");
        else t.removeAttribute("aria-current");
      });
      store("jp:lab:" + ws, id);
      if (history.replaceState) history.replaceState(null, "", "#lab-" + id);
      if (scroll) {
        var nav = doc.querySelector(".jp-lab-tabs");
        if (nav) nav.scrollIntoView({ block: "start" });
      }
      if (id === "summary" || box.querySelector('[data-jp-lab-step="' + id + '"] [data-jp-lab-summary]')) drawSummary();
    }
    Array.prototype.forEach.call(doc.querySelectorAll("[data-jp-lab-tab], [data-jp-lab-go]"), function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        show(a.getAttribute("data-jp-lab-tab") || a.getAttribute("data-jp-lab-go"), a.hasAttribute("data-jp-lab-go"));
      });
    });
    var m = /^#lab-(.+)$/.exec(location.hash);
    show(m ? m[1] : store("jp:lab:" + ws) || steps[0].getAttribute("data-jp-lab-step"), false);

    // The aside: the statement's first line and the ticked use cases.
    var text = box.querySelector("[data-jp-usecase]");
    var shown = box.querySelector("[data-jp-usecase-show]");
    var ticks = box.querySelector("[data-jp-usecase-ticks]");
    function aside() {
      if (text && shown) shown.textContent = (text.value.split("\n")[0] || T("No use case agreed yet. Agree one together in step 1.")).trim();
      if (!ticks) return;
      ticks.textContent = "";
      Array.prototype.forEach.call(box.querySelectorAll(".jp-uc input:checked"), function (c) {
        var pill = doc.createElement("span");
        pill.className = "jp-pill";
        pill.textContent = c.parentNode.querySelector("b").textContent;
        ticks.appendChild(pill);
      });
    }
    box.addEventListener("input", aside);
    box.addEventListener("change", aside);
    aside();

    // The summary: every step's answers, read back from this browser.
    var src = box.querySelector("[data-jp-lab-model]");
    var out = box.querySelector("[data-jp-lab-summary]");
    var model = [];
    try {
      model = src ? JSON.parse(src.textContent) : [];
    } catch (_e) {
      model = [];
    }
    function value(it) {
      var v = store("jv:" + it.name);
      if (v === null && it.value !== undefined) v = it.value;
      if (it.type === "choice") {
        var o = (it.options || []).filter(function (x) {
          return x.id === v;
        })[0];
        return { raw: v, text: o ? o.label : "", index: o ? it.options.indexOf(o) : -1 };
      }
      if (it.type === "check") return { raw: v, text: v === "1" ? "✓" : "" };
      return { raw: v, text: (v || "").trim() };
    }
    function rows() {
      var r = [];
      model.forEach(function (sec) {
        sec.items.forEach(function (it) {
          var v = value(it);
          if (v.text) r.push({ sec: sec, it: it, v: v });
        });
      });
      return r;
    }
    function el(tag, cls, t) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (t !== undefined) n.textContent = t;
      return n;
    }
    function drawSummary() {
      if (!out) return;
      out.textContent = "";
      var any = false;
      model.forEach(function (sec) {
        var block = el("section", "jp-lab-sum-sec");
        block.appendChild(el("h4", null, sec.n + ". " + sec.label));
        var dl = el("dl");
        var ticked = {};
        var counts = {};
        var worst = [];
        sec.items.forEach(function (it) {
          var v = value(it);
          if (!v.text) return;
          if (it.type === "check") {
            var g = it.group || sec.label;
            (ticked[g] = ticked[g] || []).push(it.label);
            return;
          }
          if (it.type === "choice") {
            var gname = it.group || sec.label;
            var c = (counts[gname] = counts[gname] || { opts: it.options, n: {} });
            c.n[v.raw] = (c.n[v.raw] || 0) + 1;
            if (v.index === it.options.length - 1) worst.push(it.label);
            return;
          }
          dl.appendChild(el("dt", null, it.label));
          var dd = el("dd");
          v.text.split("\n").forEach(function (line, i) {
            if (i) dd.appendChild(el("br"));
            dd.appendChild(doc.createTextNode(line));
          });
          dl.appendChild(dd);
        });
        Object.keys(ticked).forEach(function (g) {
          dl.appendChild(el("dt", null, g));
          dl.appendChild(el("dd", null, ticked[g].join(" · ")));
        });
        Object.keys(counts).forEach(function (g) {
          var c = counts[g];
          dl.appendChild(el("dt", null, g));
          dl.appendChild(
            el(
              "dd",
              null,
              c.opts
                .filter(function (o) {
                  return c.n[o.id];
                })
                .map(function (o) {
                  return c.n[o.id] + " " + o.label;
                })
                .join(" · "),
            ),
          );
        });
        if (worst.length) {
          var last = sec.items.filter(function (i) {
            return i.type === "choice";
          })[0];
          dl.appendChild(el("dt", null, last ? last.options[last.options.length - 1].label : T("Not yet")));
          dl.appendChild(el("dd", null, worst.join(" · ")));
        }
        if (dl.childNodes.length) {
          any = true;
          block.appendChild(dl);
        } else block.appendChild(el("p", "jp-small", T("Nothing written yet.")));
        out.appendChild(block);
      });
      if (!any) out.insertBefore(el("p", "jp-small", T("Nothing written yet. Work through the steps; what the table writes appears here.")), out.firstChild);
    }
    var printBtn = box.querySelector("[data-jp-lab-print]");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        drawSummary();
        root.classList.add("jp-print-lab");
        window.print();
      });
      window.addEventListener("afterprint", function () {
        root.classList.remove("jp-print-lab");
      });
    }
    var csvBtn = box.querySelector("[data-jp-lab-csv]");
    if (csvBtn) {
      csvBtn.addEventListener("click", function () {
        function q(x) {
          return '"' + String(x).replace(/"/g, '""') + '"';
        }
        var lines = [[T("Step"), T("Item"), T("Answer")].map(q).join(",")];
        rows().forEach(function (r) {
          lines.push([r.sec.n + ". " + r.sec.label, r.it.group ? r.it.group + ": " + r.it.label : r.it.label, r.v.text].map(q).join(","));
        });
        var url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }));
        var a = el("a");
        a.href = url;
        a.download = ws + "-summary.csv";
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      });
    }
    window.addEventListener("storage", function (ev) {
      if (ev.key && ev.key.indexOf("jv:") === 0) drawSummary();
    });
    drawSummary();
  }

  // Reset Simulation (VaxLink's second bar): forget what this browser keeps for the
  // workshop (the gap strip's answers, jv:<workshop>:…) and for the viewer (the
  // presenter's and the hood's choices, jp:…), then start again at the overview.
  function reset(b) {
    b.addEventListener("click", function () {
      if (!window.confirm(T("Reset the simulation? This forgets the room's answers and choices kept in this browser."))) return;
      var ws = "jv:" + b.getAttribute("data-jp-reset") + ":";
      try {
        var drop = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (k && (k.indexOf(ws) === 0 || k.indexOf("jp:") === 0)) drop.push(k);
        }
        drop.forEach(function (k) {
          window.localStorage.removeItem(k);
        });
      } catch (_e) {
        /* storage unavailable: nothing kept */
      }
      window.location.href = b.getAttribute("data-jp-reset-to");
    });
  }

  // A device screen's states: every state is in the page, one shown at a time.
  function states(sw) {
    var fig = doc.querySelector('[data-screen="' + sw.getAttribute("data-ds-switch") + '"]');
    if (!fig) return;
    function show(id) {
      var found = false;
      Array.prototype.forEach.call(sw.querySelectorAll("[data-ds-show]"), function (b) {
        var on = b.getAttribute("data-ds-show") === id;
        if (on) found = true;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      if (!found) return false;
      [fig, sw].forEach(function (box) {
        Array.prototype.forEach.call(box.querySelectorAll("[data-ds-state]"), function (x) {
          x.hidden = x.getAttribute("data-ds-state") !== id;
        });
      });
      return true;
    }
    Array.prototype.forEach.call(sw.querySelectorAll("[data-ds-show]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-ds-show");
        show(id);
        try {
          var u = new URL(window.location.href);
          if (b === sw.querySelector("[data-ds-show]")) u.searchParams.delete("state");
          else u.searchParams.set("state", id);
          window.history.replaceState(null, "", u.toString());
        } catch (_e) {
          /* no URL API: the switch still works */
        }
      });
    });
    var m = /[?&]state=([a-z0-9-]+)/.exec(window.location.search);
    if (m) show(m[1]);
    sw.hidden = false;
  }

  function init() {
    oldAddress();
    each("[data-ds-switch]", states);
    // VaxLink's frame toggle: the device's bezel on or off, the screen alone.
    each("[data-jp-frame]", function (b) {
      var dev = doc.querySelector("[data-jp-stage] .ds-device");
      if (!dev) return;
      function set(on) {
        dev.classList.toggle("is-bare", !on);
        b.setAttribute("aria-pressed", String(on));
        store("jp:frame", on ? "on" : "off");
      }
      if (store("jp:frame") === "off") set(false);
      b.addEventListener("click", function () {
        set(b.getAttribute("aria-pressed") !== "true");
      });
      b.hidden = false;
    });
    each("[data-jp-reset]", reset);
    // The device demo's Expand: the device, full screen.
    each("[data-jp-expand]", function (b) {
      var stage = doc.querySelector("[data-jp-stage]");
      if (!stage || !stage.requestFullscreen) {
        b.hidden = true;
        return;
      }
      b.addEventListener("click", function () {
        stage.requestFullscreen();
      });
    });
    each("[data-jp-presenter]", function (b) {
      b.addEventListener("click", function () {
        setPresenter(root.getAttribute("data-presenter") !== "on");
      });
    });
    each("[data-jp-dismiss]", function (b) {
      b.addEventListener("click", function () {
        setPresenter(false);
      });
    });
    each("[data-jp-reveal]", function (b) {
      b.addEventListener("click", function () {
        b.closest("[data-jp-whatif]").classList.add("is-open");
      });
    });
    each("[data-jp-hood-toggle]", function (b) {
      b.addEventListener("click", function () {
        setHood(!b.classList.contains("is-on"));
      });
    });
    if (store("jp:hood") === "off") setHood(false);
    each(".jp-proc", zoom);
    each("input[data-jv-store]", remember);
    each("[data-jv-text]", keepText);
    each("input[data-jv-check]", keepCheck);
    each("[data-jp-text-reset]", function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-jp-text-reset");
        var t = doc.getElementsByName(name)[0];
        if (!t) return;
        forget("jv:" + name);
        t.value = t.defaultValue;
        t.dispatchEvent(new Event("input", { bubbles: true }));
        forget("jv:" + name);
      });
    });
    each("[data-jp-timer]", timer);
    each("[data-jp-lab]", lab);
    each("[data-jp-map]", journeyMap);
    each(".jp-am", tabs);
    each("[data-jp-drawer]", drawer);
    // An ArchiMate drawing in an <object> takes its own proportions once it loads.
    each("object[data-jp-fit]", function (o) {
      function fit() {
        try {
          var svg = o.contentDocument && o.contentDocument.documentElement;
          var vb = svg && svg.viewBox && svg.viewBox.baseVal;
          if (vb && vb.width && vb.height) {
            o.style.aspectRatio = vb.width + " / " + vb.height;
            o.style.minHeight = "0";
          }
        } catch (_e) {
          /* another origin: keep the default height */
        }
      }
      o.addEventListener("load", fit);
      fit();
    });
    each("[data-jp-gapreport]", gapReport);
    each("[data-jv-print]", function (b) {
      b.addEventListener("click", function () {
        window.print();
      });
    });
    doc.addEventListener("keydown", function (ev) {
      var t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      var go = null;
      if (ev.key === "ArrowRight" || ev.key === "PageDown") go = linkHref("next");
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") go = linkHref("prev");
      else if (ev.key === "w" || ev.key === "W") toggleWhatIf();
      else if (ev.key === "t" || ev.key === "T") {
        var b = doc.querySelector("[data-jp-hood-toggle]");
        if (b) setHood(!b.classList.contains("is-on"));
      }
      if (go) {
        ev.preventDefault();
        location.href = go;
      }
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
