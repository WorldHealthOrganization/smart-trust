// The HCERT WebAssembly library, for browsers and Node. No dependencies.
//
//   const hcert = await loadHcert(new URL("hcert.wasm", import.meta.url));
//   hcert.call("verify", { hc1, trustPem, now });
//
// Every call takes and returns a plain object; bytes are lower-case hex.
// Key generation and signing use WebCrypto (crypto.subtle), so a private
// key stays a non-extractable CryptoKey in the page and never enters the
// WebAssembly module.

export async function loadHcert(source) {
  let bytes;
  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) bytes = source;
  else if (typeof window === "undefined" && String(source).startsWith("file:")) {
    const { readFile } = await import("node:fs/promises");
    bytes = await readFile(new URL(source));
  } else bytes = await (await fetch(source)).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function call(op, args = {}) {
    const req = enc.encode(JSON.stringify({ op, ...args }));
    const p = x.hcert_alloc(req.length);
    new Uint8Array(x.memory.buffer, p, req.length).set(req);
    const packed = x.hcert_call(p, req.length);
    x.hcert_free(p, req.length);
    const outPtr = Number(packed >> 32n);
    const outLen = Number(packed & 0xffffffffn);
    const text = dec.decode(new Uint8Array(x.memory.buffer, outPtr, outLen));
    x.hcert_free(outPtr, outLen);
    return JSON.parse(text);
  }
  return { call };
}

export const hexOf = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
export const bytesOf = (hex) => new Uint8Array(hex.match(/../g)?.map((h) => parseInt(h, 16)) ?? []);

const ALGS = {
  ES256: { gen: { name: "ECDSA", namedCurve: "P-256" }, sign: { name: "ECDSA", hash: "SHA-256" } },
  PS256: {
    gen: { name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    sign: { name: "RSA-PSS", saltLength: 32 },
  },
};

/** A new key pair; the private key cannot be exported. */
export async function generateKeyPair(alg = "ES256") {
  const k = await crypto.subtle.generateKey(ALGS[alg].gen, false, ["sign", "verify"]);
  return { alg, privateKey: k.privateKey, publicKey: k.publicKey };
}

/** Signs hex bytes; ES256 gives the 64-byte r||s COSE wants. */
export async function sign(keyPair, hex) {
  return hexOf(await crypto.subtle.sign(ALGS[keyPair.alg].sign, keyPair.privateKey, bytesOf(hex)));
}

/**
 * TEST ONLY: a self-signed DSC for the key pair, from the test participant
 * XX, so the page can issue and verify with its own key. It is on no trust
 * list. Returns { der, pem, kid, kidBase64 }.
 */
export async function makeTestDsc(hcert, keyPair, { notBefore, notAfter, extendedKeyUsages = ["vaccinations"], commonName } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const spki = hexOf(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const tbs = hcert.call("testDscTbs", {
    spki, alg: keyPair.alg, country: "XX", commonName: commonName ?? "TEST ONLY demo DSC",
    notBefore: notBefore ?? now - 3600, notAfter: notAfter ?? now + 365 * 86400,
    serial: Math.floor(Math.random() * 2 ** 31), extendedKeyUsages,
  });
  if (!tbs.ok) throw new Error(tbs.error);
  const cert = hcert.call("testDscCertificate", { tbs: tbs.tbs, alg: keyPair.alg, signature: await sign(keyPair, tbs.tbs) });
  if (!cert.ok) throw new Error(cert.error);
  return cert;
}

/** Issues a DVCMin end to end: prepare, sign with WebCrypto, finish. */
export async function issue(hcert, keyPair, dsc, { dvc, iss = "XX", iat, exp }) {
  const prep = hcert.call("prepare", { dvc, iss, iat, exp, alg: keyPair.alg, dsc: dsc.der });
  if (!prep.ok) throw new Error(prep.error);
  const fin = hcert.call("finish", { protected: prep.protected, cwt: prep.cwt, alg: keyPair.alg, dsc: dsc.der, signature: await sign(keyPair, prep.toBeSigned) });
  if (!fin.ok) throw new Error(fin.error);
  return { ...prep, ...fin };
}
