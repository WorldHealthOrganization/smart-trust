/* The workshop's canvas, written out as an editable, pre-filled PDF (owner,
   2026-11-17): one landscape page per canvas sheet (A3 unless the canvas
   says A4; a sheet that does not fit runs on to another page), each field an
   AcroForm field named by the key its answer is kept under in this browser,
   with that answer as its value (/V). Write-ins are text fields, multi-line
   where the field is; a tick is a check box; a choice and a gap strip's row
   are radio groups. Check boxes and radio buttons carry their appearance
   streams; text fields are drawn by the reader (/NeedAppearances true).

   Written by hand, no library: the PDF is plain objects, an xref table and a
   trailer. Every byte of it is ASCII (text a page draws is WinAnsi, written
   with octal escapes; a field's value is UTF-16BE, written in hex), so a
   string's length is its byte count.

   Pure: `build(model, get)` takes the model the page carries
   (`data-jp-canvas-model`, `canvas-form.ts`) and a function answering a key's
   kept value, and returns the bytes. Loaded as a classic script
   (window.jpCanvasPdf), it wires the page's `[data-jp-canvas-pdf]` buttons;
   required by the tests (module.exports). */
(function (scope) {
  "use strict";

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

  // Landscape, in points.
  var PAPER = { A3: [1190.55, 841.89], A4: [841.89, 595.28] };
  var MARGIN = 36;
  var GUTTER = 18;

  // ── strings ──────────────────────────────────────────────────────────
  // WinAnsi for the characters a page draws; anything else becomes "?".
  var WIN = { 0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02c6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02dc: 152, 0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156, 0x017e: 158, 0x0178: 159 };
  // Symbols the printed sheets use that WinAnsi lacks, as the nearest text.
  var FALLBACK = { "\u2605": "*", "\u2606": "*", "\u2713": "v", "\u2714": "v", "\u2717": "x", "\u2718": "x", "\u25cb": "o", "\u25cf": "*", "\u25a1": "[ ]", "\u2610": "[ ]", "\u2611": "[x]", "\u2612": "[x]", "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21d2": "=>", "\u2264": "<=", "\u2265": ">=", "\u2260": "!=", "\u2212": "-", "\u00a0": " " };
  function winAnsi(s) {
    s = String(s).replace(/[\u2605\u2606\u2713\u2714\u2717\u2718\u25cb\u25cf\u25a1\u2610-\u2612\u2190\u2192\u2194\u21d2\u2264\u2265\u2260\u2212\u00a0]/g, function (ch) {
      return FALLBACK[ch];
    });
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var b = c < 128 || (c >= 160 && c < 256) ? c : WIN[c];
      if (b === undefined) b = 63;
      if (b === 40 || b === 41 || b === 92) out += "\\" + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += "\\" + ("00" + b.toString(8)).slice(-3);
      else out += String.fromCharCode(b);
    }
    return "(" + out + ")";
  }
  // Any text, as a UTF-16BE hex string with its byte-order mark.
  function utf16(s) {
    var h = "FEFF";
    for (var i = 0; i < s.length; i++) h += ("000" + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    return "<" + h + ">";
  }
  // A field name: the key, with "." (the separator of a field's parts) as "_".
  function fieldName(key) {
    return utf16(String(key).replace(/\./g, "_"));
  }
  // A PDF name (an option id is lower-case kebab; anything else is escaped).
  function pdfName(s) {
    return "/" + String(s).replace(/[^A-Za-z0-9_-]/g, function (ch) {
      return "#" + ("0" + ch.charCodeAt(0).toString(16)).slice(-2);
    });
  }
  function num(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  // Helvetica's widths are not carried; an average a little wide wraps safely.
  function width(s, size, bold) {
    return s.length * size * (bold ? 0.56 : 0.52);
  }
  function wrap(s, size, w, bold) {
    var words = String(s || "").split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    words.forEach(function (wd) {
      var next = line ? line + " " + wd : wd;
      if (width(next, size, bold) <= w || !line) line = next;
      else {
        lines.push(line);
        line = wd;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  // ── the document ─────────────────────────────────────────────────────
  function Pdf() {
    this.objs = [null];
  }
  Pdf.prototype.alloc = function () {
    this.objs.push("");
    return this.objs.length - 1;
  };
  Pdf.prototype.set = function (id, body) {
    this.objs[id] = body;
    return id;
  };
  Pdf.prototype.add = function (body) {
    return this.set(this.alloc(), body);
  };
  Pdf.prototype.stream = function (dict, data) {
    return this.add("<< " + dict + " /Length " + data.length + " >>\nstream\n" + data + "\nendstream");
  };
  Pdf.prototype.bytes = function (root, info) {
    var out = "%PDF-1.7\n%âãÏÓ\n";
    var offsets = [];
    for (var i = 1; i < this.objs.length; i++) {
      offsets[i] = out.length;
      out += i + " 0 obj\n" + this.objs[i] + "\nendobj\n";
    }
    var xref = out.length;
    out += "xref\n0 " + this.objs.length + "\n0000000000 65535 f \n";
    for (var j = 1; j < this.objs.length; j++) out += ("000000000" + offsets[j]).slice(-10) + " 00000 n \n";
    out += "trailer\n<< /Size " + this.objs.length + " /Root " + root + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    var b = new Uint8Array(out.length);
    for (var k = 0; k < out.length; k++) b[k] = out.charCodeAt(k) & 0xff;
    return b;
  };

  /**
   * The canvas as PDF bytes. `get(key)` answers the value kept under `key`
   * (null when none).
   */
  function build(model, get, drawings) {
    var pdf = new Pdf();
    var paper = PAPER[model.size] || PAPER.A3;
    var W = paper[0];
    var H = paper[1];
    var nCols = model.size === "A4" ? 2 : 3;
    var colW = (W - 2 * MARGIN - (nCols - 1) * GUTTER) / nCols;

    var catalog = pdf.alloc();
    var pagesId = pdf.alloc();
    var helv = pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    var bold = pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    var zadb = pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>");
    var res = "<< /Font << /F1 " + helv + " 0 R /F2 " + bold + " 0 R >> >>";
    var off = pdf.stream("/Type /XObject /Subtype /Form /BBox [0 0 10 10]", "");
    var appearances = {};
    function onAppearance(radio, size) {
      var k = (radio ? "r" : "c") + size;
      if (!appearances[k]) {
        // ZapfDingbats: "4" a check mark, "l" a filled circle.
        var glyph = radio ? "l" : "4";
        var fs = size * (radio ? 0.6 : 0.8);
        var dx = (size - fs * (radio ? 0.79 : 0.85)) / 2;
        appearances[k] = pdf.stream(
          "/Type /XObject /Subtype /Form /BBox [0 0 " + num(size) + " " + num(size) + "] /Resources << /Font << /ZaDb " + zadb + " 0 R >> >>",
          "q 0 g BT /ZaDb " + num(fs) + " Tf " + num(dx) + " " + num(size * 0.22) + " Td (" + glyph + ") Tj ET Q",
        );
      }
      return appearances[k];
    }

    var pages = [];
    var fields = [];
    var radios = {};
    var page = null;

    function newPage(sheet, cont) {
      page = { id: pdf.alloc(), ops: [], annots: [], col: 0, y: 0, images: {} };
      pages.push(page);
      var y = H - MARGIN;
      text(MARGIN, y - 10, 9, false, model.title + (sheet.label ? " · " + sheet.label : ""), 0.4);
      y -= 34;
      text(MARGIN, y, 20, true, sheet.title + (cont ? " (" + T("continued") + ")" : ""));
      y -= 10;
      if (sheet.intro && !cont) {
        wrap(sheet.intro, 10, W - 2 * MARGIN).forEach(function (l) {
          y -= 13;
          text(MARGIN, y, 10, false, l, 0.25);
        });
      }
      y -= 14;
      page.ops.push("0.8 G 0.5 w " + num(MARGIN) + " " + num(y + 6) + " m " + num(W - MARGIN) + " " + num(y + 6) + " l S");
      page.top = y;
      page.y = y;
    }
    function text(x, y, size, b, s, grey) {
      page.ops.push("BT " + (grey ? num(grey) + " g " : "0 g ") + "/" + (b ? "F2" : "F1") + " " + num(size) + " Tf " + num(x) + " " + num(y) + " Td " + winAnsi(s) + " Tj ET");
    }
    function box(x, y, w, h) {
      page.ops.push("0.55 G 0.6 w " + num(x) + " " + num(y) + " " + num(w) + " " + num(h) + " re S");
    }
    // Room for `h` points in the current column, else the next column, else a new page.
    function room(h, sheet) {
      if (page.y - h >= MARGIN) return;
      if (page.col < nCols - 1) {
        page.col++;
        page.y = page.top;
        return;
      }
      newPage(sheet, true);
    }
    function x0() {
      return MARGIN + page.col * (colW + GUTTER);
    }
    function textField(cell, x, y, w, h) {
      var v = get(cell.key);
      var multi = (cell.lines || 1) > 1;
      box(x, y, w, h);
      var id = pdf.add(
        "<< /Type /Annot /Subtype /Widget /FT /Tx /T " + fieldName(cell.key) + " /TU " + utf16(cell.label) + (v ? " /V " + utf16(v) : "") + " /Rect [" + [x, y, x + w, y + h].map(num).join(" ") + "] /F 4 /P " + page.id + " 0 R" + (multi ? " /Ff 4096" : "") + " /DA (/Helv " + (multi ? "9" : "8") + " Tf 0 g) /MK << /BC [0.55 0.55 0.55] >> >>",
      );
      page.annots.push(id);
      fields.push(id);
    }
    function tickField(cell, x, y, s) {
      var v = get(cell.key);
      box(x, y, s, s);
      var on = onAppearance(Boolean(cell.radio), s);
      var rect = "/Rect [" + [x, y, x + s, y + s].map(num).join(" ") + "] /F 4 /P " + page.id + " 0 R /MK << /BC [0.55 0.55 0.55] >>";
      if (cell.radio) {
        // One radio group per key: the parent field holds the value, each widget is an option.
        var g = radios[cell.key];
        if (!g) {
          g = radios[cell.key] = { id: pdf.alloc(), kids: [], value: v, label: cell.label };
          fields.push(g.id);
        }
        var state = pdfName(cell.value);
        var kid = pdf.add("<< /Type /Annot /Subtype /Widget /Parent " + g.id + " 0 R " + rect + " /AS " + (v === cell.value ? state : "/Off") + " /AP << /N << " + state + " " + on + " 0 R /Off " + off + " 0 R >> >> >>");
        g.kids.push(kid);
        page.annots.push(kid);
        return;
      }
      var checked = v === (cell.value || "1");
      var id = pdf.add("<< /Type /Annot /Subtype /Widget /FT /Btn /T " + fieldName(cell.key) + " /TU " + utf16(cell.label) + " /V " + (checked ? "/Yes" : "/Off") + " /AS " + (checked ? "/Yes" : "/Off") + " " + rect + " /AP << /N << /Yes " + on + " 0 R /Off " + off + " 0 R >> >> >>");
      page.annots.push(id);
      fields.push(id);
    }

    function heading(f, w) {
      var lines = f.label ? wrap(f.label, 9.5, w, true) : [];
      var hint = f.hint ? wrap(f.hint, 8, w) : [];
      return {
        h: lines.length * 12 + hint.length * 10 + 4,
        draw: function (x, y) {
          lines.forEach(function (l) {
            y -= 12;
            text(x, y + 2, 9.5, true, l);
          });
          hint.forEach(function (l) {
            y -= 10;
            text(x, y + 2, 8, false, l, 0.4);
          });
          return y - 4;
        },
      };
    }

    function field(f, sheet) {
      var hd = heading(f, colW);
      if (!f.rows.length) {
        // Words the sheet prints, no answer: the heading alone.
        room(hd.h + 6, sheet);
        page.y = hd.draw(x0(), page.y) - 6;
        return;
      }
      if (!f.heads) {
        // A write-in, or a list of options one per line (an option's write-in under it).
        var cells = f.rows[0].cells;
        var text1 = cells.length === 1 && cells[0].kind === "text";
        var bodyH = text1 ? (cells[0].lines || 1) * 12 + 6 : cells.reduce(function (n, c) {
          return n + (c.kind === "text" ? 18 : wrap(c.label, 9, colW - 16).length * 11 + 3);
        }, 0);
        room(hd.h + bodyH + 10, sheet);
        var y = hd.draw(x0(), page.y);
        if (text1) {
          textField(cells[0], x0(), y - bodyH, colW, bodyH);
          y -= bodyH;
        } else {
          cells.forEach(function (c) {
            if (c.kind === "text") {
              textField(c, x0() + 14, y - 16, colW - 14, 15);
              y -= 18;
              return;
            }
            var ls = wrap(c.label, 9, colW - 16);
            tickField(c, x0(), y - 10, 9);
            ls.forEach(function (l, i) {
              text(x0() + 14, y - 8 - i * 11, 9, false, l);
            });
            y -= ls.length * 11 + 3;
          });
        }
        page.y = y - 10;
        return;
      }
      // A grid or a gap strip: row labels down the left, a column per head.
      // No row-label column when no row has a label (a table whose first column is printed words).
      var labW = f.rows.some(function (r) {
        return r.label;
      }) ? colW * 0.42 : 0;
      var cw = (colW - labW) / f.heads.length;
      var headLines = f.heads.map(function (h) {
        return wrap(h, 7, cw - 4);
      });
      var headH = Math.max.apply(null, headLines.map(function (l) {
        return l.length;
      })) * 8 + 4;
      room(hd.h + headH + 16, sheet);
      var y = hd.draw(x0(), page.y);
      function heads() {
        headLines.forEach(function (ls, i) {
          ls.forEach(function (l, j) {
            text(x0() + labW + i * cw + 2, y - 7 - j * 8, 7, true, l, 0.3);
          });
        });
        y -= headH;
      }
      heads();
      f.rows.forEach(function (r) {
        if (r.group !== undefined) {
          // A heading row (a layer of the architecture map).
          var gl = wrap(r.group, 8, colW - 4);
          var gh = gl.length * 9 + 4;
          if (y - gh < MARGIN) {
            page.y = y;
            room(gh + headH + 4, sheet);
            y = page.y;
            heads();
          }
          gl.forEach(function (l, i) {
            text(x0(), y - 9 - i * 9, 8, true, l, 0.15);
          });
          y -= gh;
          return;
        }
        var ls = wrap(r.label || "", 8, labW - 4);
        var labelLines = r.cells.reduce(function (n, c) {
          return c.kind === "label" ? Math.max(n, wrap(c.label, 7.5, cw - 4).length) : n;
        }, 0);
        var rh = Math.max(ls.length * 9 + 4, labelLines * 8.5 + 4, r.cells.some(function (c) {
          return c.kind === "text";
        }) ? 16 : 13);
        if (y - rh < MARGIN) {
          page.y = y;
          room(rh + headH + 4, sheet);
          y = page.y;
          heads();
        }
        ls.forEach(function (l, i) {
          text(x0(), y - 9 - i * 9, 8, false, l);
        });
        r.cells.forEach(function (c, i) {
          var cx = x0() + labW + i * cw;
          if (c.kind === "text") textField(c, cx + 1, y - rh + 1, cw - 2, rh - 2);
          else if (c.kind === "label") wrap(c.label, 7.5, cw - 4).forEach(function (l, j) {
            text(cx + 2, y - 8.5 - j * 8.5, 7.5, false, l, 0.25);
          });
          else tickField(c, cx + (cw - 9) / 2, y - rh / 2 - 4.5, 9);
        });
        page.ops.push("0.85 G 0.4 w " + num(x0()) + " " + num(y - rh) + " m " + num(x0() + colW) + " " + num(y - rh) + " l S");
        y -= rh;
      });
      page.y = y - 12;
    }

    model.sheets.forEach(function (sheet) {
      newPage(sheet, false);
      sheet.sections.forEach(function (sec) {
        if (sec.title) {
          room(40, sheet);
          text(x0(), page.y - 13, 12, true, sec.title, 0.15);
          page.y -= 22;
        }
        sec.fields.forEach(function (f) {
          field(f, sheet);
        });
      });
      if (sheet.annex && sheet.annex.length) {
        room(60, sheet);
        text(x0(), page.y - 13, 12, true, T("Annex: the journey’s questions for this sheet"), 0.15);
        page.y -= 22;
        sheet.annex.forEach(function (q) {
          field({ label: q.step + " · " + q.label, rows: [{ cells: [{ key: q.key, label: q.label, kind: "text", lines: 3 }] }] }, sheet);
        });
      }
    });

    // The appendix (owner, 2026-11-19): the table's systems, the architecture, then each drawing, with the table's own names.
    var app = model.appendix;
    if (app) {
      // The appendix's tables run the page's full width, in one column.
      nCols = 1;
      colW = W - 2 * MARGIN;
      var named = localNames(app, get);
      var sheetOf = function (title) {
        return { label: T("Appendix"), title: title, sections: [] };
      };
      if (app.systems && app.systems.length) {
        var sys = sheetOf(T("Our systems"));
        newPage(sys, false);
        field(
          {
            label: T("The application components, and our name for each"),
            heads: [T("We have it"), T("Our name")],
            rows: app.systems.map(function (x) {
              return {
                label: x.name,
                cells: [
                  { key: x.have, label: x.name + ": " + T("We have it"), kind: "tick", value: "1" },
                  { key: x.local, label: x.name + ": " + T("Our name"), kind: "text", lines: 1 },
                ],
              };
            }),
          },
          sys,
        );
      }
      if (app.panel) {
        var pan = sheetOf(app.panel.title);
        newPage(pan, false);
        var boxName = function (b) {
          return (b.slug && named[b.slug]) || b.name;
        };
        var prow = app.panel.rows.map(function (r) {
          return {
            label: r.layer,
            cells: r.cells.map(function (c) {
              return { key: "", label: c.map(boxName).join("; "), kind: "label" };
            }),
          };
        });
        field({ label: "", heads: app.panel.countries, rows: prow }, pan);
        if (app.panel.shared) {
          field({ label: app.panel.shared.group, hint: app.panel.shared.members.map(boxName).join("; "), rows: [] }, pan);
        }
      }
      (drawings || []).forEach(function (d, i) {
        var sh = sheetOf(d.title);
        newPage(sh, false);
        var name = "Im" + (i + 1);
        page.images[name] = pdf.stream("/Type /XObject /Subtype /Image /Width " + d.w + " /Height " + d.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode]", d.hex + ">");
        var aw = W - 2 * MARGIN;
        var ah = page.y - MARGIN;
        var sc = Math.min(aw / d.w, ah / d.h);
        var dw = d.w * sc;
        var dh = d.h * sc;
        page.ops.push("q " + num(dw) + " 0 0 " + num(dh) + " " + num(MARGIN + (aw - dw) / 2) + " " + num(page.y - dh) + " cm /" + name + " Do Q");
        if (d.note) text(MARGIN, MARGIN - 14, 8, false, d.note, 0.4);
      });
    }

    Object.keys(radios).forEach(function (k) {
      var g = radios[k];
      pdf.set(g.id, "<< /FT /Btn /Ff 49152 /T " + fieldName(k) + " /TU " + utf16(g.label) + " /V " + (g.value ? pdfName(g.value) : "/Off") + " /Kids [" + g.kids.map(function (id) {
        return id + " 0 R";
      }).join(" ") + "] >>");
    });
    pages.forEach(function (p) {
      var content = pdf.stream("", p.ops.join("\n"));
      var imgs = Object.keys(p.images);
      var pres = imgs.length
        ? "<< /Font << /F1 " + helv + " 0 R /F2 " + bold + " 0 R >> /XObject << " + imgs.map(function (n) {
            return "/" + n + " " + p.images[n] + " 0 R";
          }).join(" ") + " >> >>"
        : res;
      pdf.set(p.id, "<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + num(W) + " " + num(H) + "] /Resources " + pres + " /Contents " + content + " 0 R" + (p.annots.length ? " /Annots [" + p.annots.map(function (id) {
        return id + " 0 R";
      }).join(" ") + "]" : "") + " >>");
    });
    pdf.set(pagesId, "<< /Type /Pages /Count " + pages.length + " /Kids [" + pages.map(function (p) {
      return p.id + " 0 R";
    }).join(" ") + "] >>");
    pdf.set(
      catalog,
      "<< /Type /Catalog /Pages " + pagesId + " 0 R /AcroForm << /Fields [" + fields.map(function (id) {
        return id + " 0 R";
      }).join(" ") + "] /NeedAppearances true /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv " + helv + " 0 R /ZaDb " + zadb + " 0 R >> >> >> >>",
    );
    var info = pdf.add("<< /Title " + utf16(model.title) + " /Producer (journeys viewer) >>");
    return pdf.bytes(catalog, info);
  }

  // The names the table gave its application components (How it works), by element slug.
  function localNames(app, get) {
    var out = {};
    (app.systems || []).forEach(function (x) {
      var v = (get(x.local) || "").trim();
      if (v) out[x.slug] = v;
    });
    return out;
  }
  // The slug of an element page's address, as the viewer keys its marks (`elementSlug`).
  function hrefSlug(href) {
    var seg = String(href || "").replace(/\/(index\.html)?$/, "").split("/").pop() || "";
    return seg.replace(/\.html$/, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }
  function norm(s) {
    return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  // A drawing with every component the table named under its own name: an ArchiMate box by the element page it opens, any other label (a BPMN lane) by its words.
  function renameSvg(svgText, app, named) {
    var doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    var svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return svgText;
    var byName = {};
    (app.systems || []).forEach(function (x) {
      if (named[x.slug]) byName[norm(x.name)] = named[x.slug];
    });
    function words(t) {
      var ts = t.getElementsByTagName("tspan");
      if (!ts.length) return t.textContent;
      return Array.prototype.map.call(ts, function (x) {
        return x.textContent;
      }).join(" ");
    }
    function put(t, v) {
      var ts = t.getElementsByTagName("tspan");
      if (!ts.length) {
        t.textContent = v;
        return;
      }
      ts[0].textContent = v;
      for (var i = ts.length - 1; i > 0; i--) ts[i].parentNode.removeChild(ts[i]);
    }
    Array.prototype.forEach.call(svg.getElementsByTagName("a"), function (a) {
      var v = named[hrefSlug(a.getAttribute("href") || a.getAttributeNS("http://www.w3.org/1999/xlink", "href"))];
      if (!v) return;
      var t = Array.prototype.filter.call(a.getElementsByTagName("text"), function (x) {
        return /(^|\s)av-name(\s|$)/.test(x.getAttribute("class") || "");
      })[0];
      if (t) put(t, v);
    });
    Array.prototype.forEach.call(svg.getElementsByTagName("text"), function (t) {
      var v = byName[norm(words(t))];
      if (v) put(t, v);
    });
    // A drawing with no size of its own takes its viewBox's, so it rasterizes at that size.
    var vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (!svg.getAttribute("width") && vb.length === 4) svg.setAttribute("width", String(vb[2]));
    if (!svg.getAttribute("height") && vb.length === 4) svg.setAttribute("height", String(vb[3]));
    return new XMLSerializer().serializeToString(doc);
  }
  // A drawing as a JPEG, hex for the PDF's ASCIIHexDecode: at most 3000 px wide, on white.
  function raster(svgText) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || 1600;
        var h = img.naturalHeight || 1000;
        var s = Math.min(2, 3000 / w);
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        var g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var bin = atob(c.toDataURL("image/jpeg", 0.88).split(",")[1]);
        var hex = "";
        for (var i = 0; i < bin.length; i++) hex += ("0" + bin.charCodeAt(i).toString(16)).slice(-2);
        resolve({ w: c.width, h: c.height, hex: hex });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("the drawing does not load"));
      };
      img.src = url;
    });
  }
  // Every drawing of the appendix, renamed and rasterized; one that does not load is left out and said so on the last.
  function drawingsOf(app, get) {
    if (!app || !app.figures || !app.figures.length) return Promise.resolve([]);
    var named = localNames(app, get);
    var kind = { archimate: T("ArchiMate view"), bpmn: T("Business process (BPMN)") };
    return Promise.all(
      app.figures.map(function (f) {
        return fetch(f.src)
          .then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.text();
          })
          .then(function (t) {
            return raster(renameSvg(t, app, named));
          })
          .then(function (d) {
            d.title = (kind[f.kind] || "") + ": " + f.title;
            return d;
          })
          .catch(function () {
            return null;
          });
      }),
    ).then(function (ds) {
      return ds.filter(Boolean);
    });
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "canvas";
  }

  // The page: each button writes the PDF from the model beside it and this browser's answers.
  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-jp-canvas-pdf]"), function (b) {
      b.addEventListener("click", function () {
        var holder = b.closest(".jp-cv-pdf") || document;
        var src = holder.querySelector("[data-jp-canvas-model]") || document.querySelector("[data-jp-canvas-model]");
        if (!src) return;
        var model = JSON.parse(src.textContent);
        var get = function (k) {
          try {
            return window.localStorage.getItem("jv:" + k);
          } catch (_e) {
            return null;
          }
        };
        if (b.disabled) return;
        b.disabled = true;
        b.setAttribute("aria-busy", "true");
        drawingsOf(model.appendix, get)
          .catch(function () {
            return [];
          })
          .then(function (drawings) {
            var bytes = build(model, get, drawings);
            var url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            var a = document.createElement("a");
            a.href = url;
            a.download = slug(model.title) + ".pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () {
              URL.revokeObjectURL(url);
            }, 1000);
          })
          .then(
            function () {
              b.disabled = false;
              b.removeAttribute("aria-busy");
            },
            function () {
              b.disabled = false;
              b.removeAttribute("aria-busy");
            },
          );
      });
    });
  }

  var api = { build: build, localNames: localNames, hrefSlug: hrefSlug, renameSvg: renameSvg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    scope.jpCanvasPdf = api;
    if (typeof document !== "undefined") {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
      else wire();
    }
  }
})(this);
