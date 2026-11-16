/* The workshop's gap report: the gap-strip answers of every moment, read
   back from this browser and summarised. Pure: it is handed the model the
   discussion page carries (`data-jp-gapreport`) and a function that answers
   a radio group's stored value, and it returns the report; the page draws
   it (present.js), prints it and downloads it as CSV. Per browser only
   (owner, 2026-11-06: "A only" — no import, no merge, no server).

   The scales are the workshop's `assessment.scales`, read generically:
   the FIRST scale says where a capability stands, and its first option is
   "nothing missing" (exists); the SECOND scale, when there is one, says how
   urgent a gap is, in its own order (blocks us now, within 12 months, can
   wait). A gap is a capability whose standing is answered and is not the
   first option. Loaded as a classic script (window.jpGapReport) and
   required by the tests (module.exports). */
(function (scope) {
  "use strict";

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

  function optionIndex(scale, id) {
    if (!scale || id === null || id === undefined) return -1;
    for (var i = 0; i < scale.options.length; i++) if (scale.options[i].id === id) return i;
    return -1;
  }
  function labelOf(scale, id) {
    var i = optionIndex(scale, id);
    return i < 0 ? (id === null || id === undefined ? "" : String(id)) : scale.options[i].label;
  }
  function zero(scale) {
    var c = { total: 0, unrated: 0, byStatus: {} };
    scale.options.forEach(function (o) {
      c.byStatus[o.id] = 0;
    });
    return c;
  }
  function tally(c, status, scale) {
    c.total++;
    if (optionIndex(scale, status) < 0) c.unrated++;
    else c.byStatus[status]++;
  }

  /**
   * model: { status: scale, urgency?: scale, modules: [{id,title}],
   *          items: [{ name: {status, urgency?}, capability: {id,label},
   *                    step: {id,title,href}, module?: id }] }
   * answer(name) → the stored option id, or null.
   */
  function summarise(model, answer) {
    var status = model.status;
    var urgency = model.urgency;
    var moduleOrder = (model.modules || []).map(function (m) {
      return m.id;
    });
    var moduleTitle = {};
    (model.modules || []).forEach(function (m) {
      moduleTitle[m.id] = m.title;
    });
    var rows = model.items.map(function (it, i) {
      var s = answer(it.name.status);
      var u = it.name.urgency ? answer(it.name.urgency) : null;
      return {
        order: i,
        item: it,
        status: optionIndex(status, s) < 0 ? null : s,
        urgency: optionIndex(urgency, u) < 0 ? null : u,
      };
    });
    var isGap = function (r) {
      return r.status !== null && optionIndex(status, r.status) > 0;
    };
    var modRank = function (m) {
      var i = m === undefined || m === null ? -1 : moduleOrder.indexOf(m);
      return i < 0 ? moduleOrder.length : i;
    };
    var urgRank = function (u) {
      var i = optionIndex(urgency, u);
      return i < 0 ? (urgency ? urgency.options.length : 0) : i;
    };

    // Gaps: by urgency (in the scale's order; "not set" last), then by module, then as taught.
    var groups = [];
    var byUrgency = {};
    rows.filter(isGap).forEach(function (r) {
      var k = r.urgency === null ? "" : r.urgency;
      if (!byUrgency[k]) {
        byUrgency[k] = { urgency: r.urgency, label: r.urgency === null ? T("Urgency not set") : labelOf(urgency, r.urgency), rank: urgRank(r.urgency), modules: {} };
        groups.push(byUrgency[k]);
      }
      var m = r.item.module || "";
      (byUrgency[k].modules[m] = byUrgency[k].modules[m] || []).push(r);
    });
    groups.sort(function (a, b) {
      return a.rank - b.rank;
    });
    var gaps = groups.map(function (g) {
      var mods = Object.keys(g.modules).sort(function (a, b) {
        return modRank(a || null) - modRank(b || null);
      });
      return {
        urgency: g.urgency,
        label: g.label,
        modules: mods.map(function (m) {
          return {
            module: m || null,
            title: m ? moduleTitle[m] || m : T("No module"),
            rows: g.modules[m]
              .sort(function (a, b) {
                return a.order - b.order;
              })
              .map(function (r) {
                return {
                  step: r.item.step,
                  capability: r.item.capability,
                  status: r.status,
                  statusLabel: labelOf(status, r.status),
                  urgency: r.urgency,
                  urgencyLabel: r.urgency === null ? "" : labelOf(urgency, r.urgency),
                };
              }),
          };
        }),
      };
    });

    // Counts per moment (in teaching order) and per module (in the workshop's order).
    var perMoment = [];
    var momentAt = {};
    var perModule = [];
    var moduleAt = {};
    var totals = zero(status);
    rows.forEach(function (r) {
      var sk = r.item.step.id;
      if (!momentAt[sk]) {
        momentAt[sk] = { step: r.item.step, counts: zero(status) };
        perMoment.push(momentAt[sk]);
      }
      tally(momentAt[sk].counts, r.status, status);
      var mk = r.item.module || "";
      if (!moduleAt[mk]) {
        moduleAt[mk] = { module: mk || null, title: mk ? moduleTitle[mk] || mk : T("No module"), counts: zero(status) };
        perModule.push(moduleAt[mk]);
      }
      tally(moduleAt[mk].counts, r.status, status);
      tally(totals, r.status, status);
    });
    perModule.sort(function (a, b) {
      return modRank(a.module) - modRank(b.module);
    });
    var gapCount = rows.filter(isGap).length;
    return { gaps: gaps, gapCount: gapCount, perMoment: perMoment, perModule: perModule, totals: totals, statusOptions: status.options };
  }

  function cell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** The gaps as CSV, one row each, in the report's order; `base` makes each step's link absolute. */
  function csv(report, base) {
    var lines = [[T("Urgency"), T("Module"), T("Moment"), T("Moment title"), T("Capability"), T("Where we stand"), T("Link")].join(",")];
    report.gaps.forEach(function (g) {
      g.modules.forEach(function (m) {
        m.rows.forEach(function (r) {
          var href = r.step.href;
          if (base && href && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
            try {
              href = new URL(href, base).href;
            } catch (_e) {
              /* keep it as it is */
            }
          }
          lines.push([g.label, m.module ? m.module + " " + m.title : m.title, r.step.id, r.step.title, r.capability.label, r.statusLabel, href].map(cell).join(","));
        });
      });
    });
    return lines.join("\r\n") + "\r\n";
  }

  var api = { summarise: summarise, csv: csv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else scope.jpGapReport = api;
})(this);
