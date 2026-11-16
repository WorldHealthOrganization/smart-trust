// Live demos for the QR Code Generation page: each step of the pipeline, and
// verification, run in the reader's browser by the hcert WebAssembly module.
//
// A page places <div class="hcert-demo" data-demo="NAME"></div> where a
// demo belongs and loads this file as a module. NAME is one of: keys,
// subclaim, payload, cwt, cbor, sign, compress, base45, prefix, qr, verify,
// published. The demos share one state, so editing the payload re-runs
// every later step.
//
// TEST ONLY. The key pair is generated in this browser by WebCrypto, cannot
// be exported, and is gone when the page closes. Its DSC is self-signed by
// test participant XX and is on no trust list, so nothing issued here
// verifies anywhere else.

import { loadHcert, generateKeyPair, makeTestDsc, sign } from "./hcert.js";

const here = new URL(".", import.meta.url);
const STEPS = ["PREFIX", "BASE45", "INFLATE", "COSE", "HEADER", "TRUST_LOOKUP", "SIGNATURE", "KEY_USAGE", "CWT", "TIME", "HCERT", "PAYLOAD"];
const STEP_LABEL = {
  PREFIX: "HC1: prefix", BASE45: "Base45 decode", INFLATE: "ZLIB decompress", COSE: "COSE_Sign1 parse",
  HEADER: "Protected header (alg, kid)", TRUST_LOOKUP: "kid on the trust list", SIGNATURE: "Signature",
  KEY_USAGE: "DSC key usage", CWT: "CWT claims", TIME: "iat and exp", HCERT: "hcert claim", PAYLOAD: "Payload model",
};

const now = () => Math.floor(Date.now() / 1000);
const state = {
  alg: "ES256",
  keys: null,
  dsc: null,
  dvc: {
    n: "Chanthala SOUVANNALATH", dob: "2026-10-21", s: "female", nt: "LAO", gn: "Mali SOUVANNALATH",
    vx: { vp: "a3K3X000006MiiXUAS", dv: "2026-10-21", cn: "Dr Pimchanok WATTANA", is: "org-xxr-provincial-hospital", bo: "HEPB-2026-0914" },
    v: "1.0.0",
  },
  iss: "XX",
  // A DSC the reader pastes, such as XXR's from the GDHCN DEV trust list; shared by verify and published.
  pastedPem: "",
  iat: now(),
  exp: now() + 365 * 86400,
  out: {},
  error: null,
};
const views = new Map();
let hcert;

// ---- small DOM helpers -------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const code = (text, cls = "") => el("pre", { class: `hd-code ${cls}` }, text);
const bytes = (hex) => hex.length / 2;
function hexBlock(label, hex) {
  const short = hex.length > 192;
  const pre = code(short ? hex.slice(0, 192) + "…" : hex, "hd-hex");
  const box = el("div", { class: "hd-field" }, el("div", { class: "hd-label" }, `${label} · ${bytes(hex)} bytes`), pre);
  if (short) {
    box.append(el("button", { type: "button", class: "hd-link", onclick: (e) => { pre.textContent = hex; e.target.remove(); } }, "Show all bytes"));
  }
  return box;
}
const field = (label, ...content) => el("div", { class: "hd-field" }, el("div", { class: "hd-label" }, label), ...content);
const note = (text) => el("p", { class: "hd-note" }, text);
function copyButton(text, label = "Copy") {
  return el("button", { type: "button", class: "hd-link", onclick: async (e) => {
    try { await navigator.clipboard.writeText(text()); e.target.textContent = "Copied"; } catch { e.target.textContent = "Copy failed"; }
    setTimeout(() => (e.target.textContent = label), 1500);
  } }, label);
}
const iso = (t) => new Date(t * 1000).toISOString().replace(".000Z", "Z");

// ---- the pipeline ------------------------------------------------------

function must(r) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

async function newKeys(alg) {
  state.alg = alg;
  state.keys = await generateKeyPair(alg);
  state.dsc = await makeTestDsc(hcert, state.keys, { notBefore: now() - 3600, notAfter: now() + 2 * 365 * 86400 });
}

async function run() {
  const o = {};
  state.error = null;
  try {
    o.subclaims = must(hcert.call("subclaims")).subclaims;
    o.payload = must(hcert.call("assemblePayload", { dvc: state.dvc }));
    o.cwt = must(hcert.call("buildCwt", { payload: o.payload.cbor, iss: state.iss, iat: state.iat, exp: state.exp, subclaim: o.payload.subclaim }));
    o.cbor = must(hcert.call("cborDeterministic", { cbor: o.cwt.cwt }));
    o.prep = must(hcert.call("prepare", { dvc: state.dvc, iss: state.iss, iat: state.iat, exp: state.exp, alg: state.alg, dsc: state.dsc.der }));
    o.signature = await sign(state.keys, o.prep.toBeSigned);
    o.cose = must(hcert.call("finish", { protected: o.prep.protected, cwt: o.prep.cwt, alg: state.alg, dsc: state.dsc.der, signature: o.signature }));
    o.zlib = must(hcert.call("compress", { data: o.cose.cose }));
    o.b45 = must(hcert.call("base45Encode", { data: o.zlib.data }));
    o.hc1 = must(hcert.call("prefix", { text: o.b45.text })).hc1;
  } catch (e) {
    state.error = e.message;
  }
  state.out = o;
  for (const [name, root] of views) render(name, root);
}

// ---- the demos ---------------------------------------------------------

const DEMOS = {
  keys() {
    const k = state.dsc;
    const algSelect = el("select", { "aria-label": "Signature algorithm" },
      el("option", { value: "ES256", selected: state.alg === "ES256" }, "ES256 (ECDSA P-256), primary"),
      el("option", { value: "PS256", selected: state.alg === "PS256" }, "PS256 (RSASSA-PSS 2048), secondary"));
    const button = el("button", { type: "button", class: "hd-button", onclick: async () => {
      button.disabled = true;
      button.textContent = "Generating…";
      await newKeys(algSelect.value);
      await run();
    } }, "Generate a new key pair");
    return [
      el("div", { class: "hd-row" }, algSelect, button),
      field("Document Signer Certificate (self-signed, TEST ONLY)", code(k.pem, "hd-short"), copyButton(() => k.pem, "Copy the PEM")),
      field("kid: the first 8 bytes of the DSC's SHA-256", code(`${k.kid}   (base64 ${k.kidBase64})`)),
      note("The private key was generated by your browser (WebCrypto) and cannot be exported. Every demo below signs with it. Its DSC belongs to test participant XX and is on no trust list, so a certificate made here verifies only on this page."),
    ];
  },

  subclaim() {
    const rows = (state.out.subclaims ?? []).map((s) =>
      el("tr", { class: s.key === -6 ? "hd-selected" : "" }, el("td", {}, String(s.key)), el("td", {}, s.name), el("td", {}, s.key < 0 ? "development" : "WHO-assigned")));
    return [
      el("table", { class: "hd-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Subclaim"), el("th", {}, "Payload"), el("th", {}, "Range"))), el("tbody", {}, rows)),
      note("The demos below use -6, DVCMin. The library refuses a development subclaim unless the issuer opts in, and this page opts in."),
    ];
  },

  payload: {
    controls() {
      const area = el("textarea", { class: "hd-edit", rows: 16, spellcheck: "false", "aria-label": "DVC payload, JSON" }, JSON.stringify(state.dvc, null, 2));
      const status = el("div", { class: "hd-status", role: "status" });
      area.addEventListener("input", () => {
        try {
          state.dvc = JSON.parse(area.value);
          status.textContent = "";
          clearTimeout(area._t);
          area._t = setTimeout(run, 300);
        } catch (e) {
          status.textContent = `Not JSON yet: ${e.message}`;
        }
      });
      return [field("Edit the payload. Every later step re-runs.", area, status)];
    },
    outputs() {
      const p = state.out.payload;
      if (!p) return [note(`The payload is incomplete: ${state.error}`)];
      const issues = p.issues.length
        ? el("ul", { class: "hd-issues" }, p.issues.map((i) => el("li", {}, `${i.path || "(root)"}: ${i.message}`)))
        : note("No issues against the DVCMin rules (FHIR types, alpha-3 nt, is or cn present).");
      return [issues, field("The payload as CBOR, diagnostic notation", code(p.diagnostic)), hexBlock("The payload as CBOR", p.cbor)];
    },
  },

  cwt: {
    controls() {
      const input = (label, key, type = "number") => el("label", { class: "hd-inline" }, label, el("input", {
        type, value: String(state[key]), oninput: (e) => {
          state[key] = type === "number" ? Number(e.target.value) : e.target.value;
          clearTimeout(e.target._t);
          e.target._t = setTimeout(run, 300);
        },
      }));
      return [el("div", { class: "hd-row" }, input("iss (1)", "iss", "text"), input("iat (6)", "iat"), input("exp (4)", "exp"))];
    },
    outputs() {
      const c = state.out.cwt;
      return [
        note(`iat ${iso(state.iat)} · exp ${iso(state.exp)}. Both must fall inside the DSC's validity, or the issuer refuses.`),
        c && field("CWT claim set, diagnostic notation", code(c.diagnostic)),
      ];
    },
  },

  cbor() {
    const c = state.out.cbor;
    return c && [
      hexBlock("CWT claim set, deterministic CBOR (RFC 8949 4.2.1)", c.cbor),
      note("Decoding and re-encoding these bytes gives the same bytes: keys sorted, shortest lengths, text NFC-normalised."),
    ];
  },

  sign() {
    const p = state.out.prep;
    const c = state.out.cose;
    return p && [
      field("Protected header", code(p.protectedDiagnostic)),
      field("Sig_structure: the bytes the key signs", code(p.toBeSignedDiagnostic)),
      hexBlock(`Signature from your key (${state.alg}${state.alg === "ES256" ? ", r || s" : ""})`, state.out.signature ?? ""),
      c && field("COSE_Sign1, tag 18", code(c.coseDiagnostic)),
      c && hexBlock("COSE_Sign1", c.cose),
      note(state.alg === "ES256"
        ? "WebCrypto returns ECDSA as the 64-byte r || s that COSE wants. JCA and OpenSSL return DER, which must be converted first."
        : "Each PS256 signature is randomised, so signing again gives different bytes. ES256 here is randomised too."),
    ];
  },

  compress() {
    const z = state.out.zlib;
    return z && [hexBlock(`ZLIB, ${z.inputBytes} bytes in, ${z.outputBytes} out`, z.data)];
  },

  base45() {
    const b = state.out.b45;
    return b && [field(`Base45 · ${b.text.length} characters`, code(b.text, "hd-wrap"))];
  },

  prefix() {
    const h = state.out.hc1;
    return h && [field(`The HC1 string · ${h.length} characters`, code(h, "hd-wrap"), copyButton(() => h, "Copy the HC1 string"))];
  },

  qr() {
    const h = state.out.hc1;
    if (!h) return null;
    const q = hcert.call("qrSvg", { text: h });
    if (!q.ok) return [note(`No QR symbol: ${q.error}`)];
    const svg = new DOMParser().parseFromString(q.svg, "image/svg+xml").documentElement;
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `QR code of the HC1 string above, version ${q.version}, error correction ${q.errorCorrection}`);
    svg.setAttribute("class", "hd-qr");
    return [
      field(`QR symbol · version ${q.version} (${q.modules} × ${q.modules} modules) · error correction ${q.errorCorrection} · Alphanumeric mode`, svg),
      note("TEST ONLY: signed by this page's own key, so it verifies only on this page. Scan it with a phone and paste the text into the verifier below. Rendered in your browser by the qrcode crate (pinned, MIT/Apache-2.0)."),
    ];
  },

  verify(root) {
    const s = root._s ??= { hc1: null, trust: "page", time: "now" };
    const hc1 = el("textarea", { class: "hd-edit", rows: 5, spellcheck: "false", "aria-label": "HC1 string to verify" }, s.hc1 ?? state.out.hc1 ?? "");
    const trust = el("select", { "aria-label": "Trust list" },
      el("option", { value: "page", selected: s.trust === "page" }, "Trust this page's DSC"),
      el("option", { value: "pasted", selected: s.trust === "pasted" }, "Trust a DSC I paste (PEM)"),
      el("option", { value: "none", selected: s.trust === "none" }, "Trust nothing"));
    const pem = pemBox();
    const result = el("div");
    const go = async () => {
      s.hc1 = hc1.value.trim();
      s.trust = trust.value;
      pem.hidden = s.trust !== "pasted";
      const trustPem = s.trust === "page" ? state.dsc.pem : s.trust === "pasted" ? state.pastedPem : "";
      const r = hcert.call("verify", { hc1: s.hc1, trustPem, now: now() });
      result.replaceChildren(...verdict(r).filter(Boolean));
    };
    const tamper = el("button", { type: "button", class: "hd-link", onclick: () => {
      const t = hc1.value;
      const i = Math.floor(t.length * 0.6);
      const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
      const c = alphabet[(alphabet.indexOf(t[i]) + 7) % 45];
      hc1.value = t.slice(0, i) + c + t.slice(i + 1);
      go();
    } }, "Change one character");
    const forge = el("button", { type: "button", class: "hd-link", onclick: () => {
      // Re-encode the same COSE_Sign1 with its last signature byte changed:
      // every layer decodes, and only the signature check can catch it.
      const layers = hcert.call("decodeLayers", { hc1: hc1.value.trim() });
      if (!layers.ok) return result.replaceChildren(note(`Decode it first: ${layers.error}`));
      const flipped = layers.cose.slice(0, -2) + (parseInt(layers.cose.slice(-2), 16) ^ 1).toString(16).padStart(2, "0");
      const z = hcert.call("compress", { data: flipped });
      hc1.value = hcert.call("prefix", { text: hcert.call("base45Encode", { data: z.data }).text }).hc1;
      go();
    } }, "Change one signature byte");
    const reset = el("button", { type: "button", class: "hd-link", onclick: () => { hc1.value = state.out.hc1; go(); } }, "Use the string made above");
    hc1.addEventListener("input", () => { clearTimeout(hc1._t); hc1._t = setTimeout(go, 300); });
    trust.addEventListener("change", go);
    pem.addEventListener("pem", go);
    queueMicrotask(go);
    return [field("HC1 string", hc1), el("div", { class: "hd-row" }, trust, tamper, forge, reset), pem, result];
  },

  published(root) {
    const out = el("div");
    const pem = pemBox();
    const show = ([vector, did, signer]) => {
      // XXR's DSC as the DEV trust list published it, trusted only once the
      // document's proof verifies against WHO's signing DID (STT-TRU-006),
      // unless the reader pastes another DSC.
      const pasted = state.pastedPem.trim();
      const signerDid = JSON.parse(signer).id;
      const rows = [];
      let proofFailed = null;
      for (const [name, c] of Object.entries(vector.certificates)) {
        const layers = hcert.call("decodeLayers", { hc1: c.hc1 });
        const r = hcert.call("verify", pasted ? { hc1: c.hc1, trustPem: pasted, now: now() } : { hc1: c.hc1, trustDid: did, trustDidSigner: signer, now: now() });
        if (!pasted && !r.ok && r.error.startsWith("DID document proof invalid")) proofFailed = r.error;
        const result = !r.ok ? `✗ ${r.error}` : r.status === "verified" ? "✓ verified" : `✗ ${r.step} ${r.reason}`;
        rows.push(el("tr", {}, el("td", {}, name), el("td", {}, result), el("td", {}, layers.kidBase64 ?? ""),
          el("td", {}, `${c.iss} · ${c.payload.n}, ${c.payload.vx.vp}, ${c.payload.vx.bo}`)));
      }
      out.replaceChildren(el("table", { class: "hd-table" },
        el("thead", {}, el("tr", {}, el("th", {}, "Certificate"), el("th", {}, "Result"), el("th", {}, "kid"), el("th", {}, "Issuer and payload, as published"))), el("tbody", {}, rows)),
        note(pasted
          ? "Verified in your browser against the DSC you pasted, with the same code as the verification demo above. Clear the box to go back to the trust list's DSC."
          : proofFailed
            ? `Not verified. XXR's DSC DID document from https://tng-cdn-dev.who.int/v2/trustlist/-/XXR/DSC/did.json carries a proof that did not verify against the WHO signing DID ${signerDid} (${proofFailed}), so its key was not trusted and the certificates were not checked.`
            : `Verified in your browser against XXR's DSC (kid ${vector.kid_base64}) as the GDHCN DEV trust list published it at https://tng-cdn-dev.who.int/v2/trustlist/-/XXR/DSC/did.json, retrieved on 2026-10-22 and bundled with this demo. Before its key was trusted, the document's JsonWebSignature2020 proof was verified against the WHO signing DID ${signerDid}, also bundled. A real verifier fetches both each time, which is the only way to know the key is still trusted. Paste a different DSC below to verify against that instead.`));
    };
    const load = () => Promise.all([xxr(), xxrDsc(), whoSigner()]).then(show).catch((e) => out.replaceChildren(note(`The published example could not be loaded: ${e.message}`)));
    pem.hidden = false;
    pem.addEventListener("pem", load);
    load();
    return [out, pem];
  },
};

// The page's two certificates (section 12.6), XXR's DSC DID document as the
// GDHCN DEV trust list served it, and the WHO signing DID document that signs
// it, all copied beside this script by bundle-demo.sh.
const bundled = (file, read) => fetch(new URL(file, here)).then((r) => {
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  return read(r);
});
let xxrPromise, xxrDscPromise, whoSignerPromise;
const xxr = () => (xxrPromise ??= bundled("dvc-qr-example-XXR.json", (r) => r.json()));
const xxrDsc = () => (xxrDscPromise ??= bundled("XXR-DSC-did.json", (r) => r.text()));
const whoSigner = () => (whoSignerPromise ??= bundled("WHO-signing-did.json", (r) => r.text()));

// One pasted DSC, shared by every demo that offers it; each box fires "pem" when it changes.
const pemBoxes = new Set();
function pemBox() {
  const ta = el("textarea", { class: "hd-edit", rows: 4, spellcheck: "false", placeholder: "-----BEGIN CERTIFICATE-----", "aria-label": "Document Signing Certificate to trust, PEM" }, state.pastedPem);
  const box = field("DSC to trust (PEM)", ta);
  pemBoxes.add(box);
  ta.addEventListener("input", () => {
    clearTimeout(ta._t);
    ta._t = setTimeout(() => {
      state.pastedPem = ta.value;
      for (const b of pemBoxes) {
        const t = b.querySelector("textarea");
        if (t !== ta) t.value = ta.value;
        b.dispatchEvent(new Event("pem"));
      }
    }, 300);
  });
  return box;
}

function verdict(r) {
  if (!r.ok) return [note(r.error)];
  const failedAt = r.status === "failed" ? STEPS.indexOf(r.step) : STEPS.length;
  const list = el("ol", { class: "hd-steps" }, STEPS.map((s, i) => el("li", {
    class: i < failedAt ? "hd-pass" : i === failedAt ? "hd-fail" : "hd-skip",
  }, el("span", { class: "hd-mark", "aria-hidden": "true" }, i < failedAt ? "✓" : i === failedAt ? "✗" : "–"), ` ${STEP_LABEL[s]}`,
    i === failedAt ? el("span", { class: "hd-detail" }, ` ${r.reason}: ${r.detail}`) : null)));
  const summary = r.status === "verified"
    ? el("div", { class: "hd-verdict hd-ok" }, `Verified. Issued by ${r.iss ?? "(no iss)"}, signed by the DSC with kid ${r.kid}, carrying ${r.entries.map((e) => `subclaim ${e.subclaim}${e.keyUsageAuthorised ? "" : " (not authorised by the DSC's key usage)"}`).join(" and ")}.`)
    : el("div", { class: "hd-verdict hd-bad" }, `Not verified: stopped at ${STEP_LABEL[r.step]} (${r.reason}).`);
  const shown = (e) => e.payload ?? e.payloadVhlink ?? e.payloadDiagnostic;
  return [summary, list, ...(r.entries ?? []).map((e) => field(`Payload under subclaim ${e.subclaim}, read only after the signature verified`, code(typeof shown(e) === "string" ? shown(e) : JSON.stringify(shown(e), null, 2)))),
    ...(r.diagnostics ?? []).map((d) => note(d))];
}

function render(name, root) {
  const demo = DEMOS[name];
  const body = root.querySelector(".hd-body");
  if (name === "verify" || name === "published") {
    // Their own inputs drive them; they render once.
    if (!root._done) body.replaceChildren(...demo(root).filter(Boolean));
    root._done = true;
    return;
  }
  if (typeof demo === "object") {
    // Controls are made once, so editing them keeps the cursor; outputs re-render.
    if (!root._outputs) {
      root._outputs = el("div");
      body.replaceChildren(...demo.controls().filter(Boolean), root._outputs);
    }
    root._outputs.replaceChildren(...demo.outputs().filter(Boolean));
    return;
  }
  if (state.error && name !== "keys") {
    body.replaceChildren(note(`This step did not run: ${state.error}`));
    return;
  }
  body.replaceChildren(...(demo(root) ?? []).filter(Boolean));
}

async function main() {
  const roots = [...document.querySelectorAll(".hcert-demo[data-demo]")];
  for (const root of roots) {
    root.replaceChildren(el("div", { class: "hd-head" }, "Live in your browser"), el("div", { class: "hd-body" }, note("Loading…")));
  }
  try {
    hcert = await loadHcert(new URL("hcert.wasm", here));
    await newKeys("ES256");
  } catch (e) {
    for (const root of roots) root.querySelector(".hd-body").replaceChildren(note(`The demo could not start: ${e.message}. It needs WebAssembly and WebCrypto.`));
    return;
  }
  for (const root of roots) if (DEMOS[root.dataset.demo]) views.set(root.dataset.demo, root);
  await run();
}

main();
