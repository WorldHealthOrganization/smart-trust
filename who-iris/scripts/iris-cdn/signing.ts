/**
 * Signing and verifying IRIS CDN releases and items, using published
 * standards only:
 *
 *  - the signature is a JWS with a DETACHED payload (RFC 7515 Appendix F):
 *    compact serialization with the payload segment left empty;
 *  - the algorithm is ES256 — ECDSA on P-256 with SHA-256 (RFC 7518 §3.4) —
 *    because the key is subordinate to WHO's signing DID, whose key is P-256
 *    (owner, 2026-10-30). EdDSA (RFC 8037) is still accepted for verification;
 *  - the header's `kid` is a DID URL (W3C DID Core 1.0) naming a
 *    `verificationMethod` whose `publicKeyJwk` (RFC 7517) carries the key;
 *  - the key's trust chain is `x5c` (RFC 7517 §4.7, RFC 7515 §4.1.6): the
 *    leaf certificate holds our key, and the chain ends at a certificate
 *    signed by WHO's key. Publishing the subordinate key and its certificate
 *    is an OFFLINE step (owner, 2026-10-30); nothing here issues certificates;
 *  - the DID method is `did:web`. No GDHCN trust list is assumed: a verifier
 *    resolves the key from the DID document, never from the package, and is
 *    handed its trust anchor(s) explicitly.
 *
 * ECDSA signatures are randomised: signing the same bytes twice gives
 * different signatures. So an unchanged payload must never be re-signed —
 * the caller signs only what the manifest diff says changed.
 */
import { createPublicKey, webcrypto, X509Certificate } from "node:crypto";

const subtle = webcrypto.subtle;

const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.from(s, "base64url"));
const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;

export interface EcPublicJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  /** RFC 7517 §4.7: base64 (not url) DER certificates, leaf first. */
  x5c?: string[];
}

/** RFC 8037 §2: an Ed25519 public key. */
export interface OkpPublicJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  x5c?: string[];
}

export type PublicJwk = EcPublicJwk | OkpPublicJwk;
export type Alg = "ES256" | "EdDSA";

const algOfJwk = (jwk: PublicJwk): Alg => (jwk.kty === "EC" ? "ES256" : "EdDSA");
const webAlg = (alg: Alg): webcrypto.EcKeyImportParams | { name: "Ed25519" } =>
  alg === "ES256" ? { name: "ECDSA", namedCurve: "P-256" } : { name: "Ed25519" };
const signParams = (alg: Alg): webcrypto.EcdsaParams | { name: "Ed25519" } =>
  alg === "ES256" ? { name: "ECDSA", hash: "SHA-256" } : { name: "Ed25519" };

/** The public part only, in a fixed member order. */
function publicPart(jwk: PublicJwk): PublicJwk {
  const x5c = jwk.x5c && jwk.x5c.length > 0 ? { x5c: [...jwk.x5c] } : {};
  return jwk.kty === "EC" ? { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ...x5c } : { kty: "OKP", crv: "Ed25519", x: jwk.x, ...x5c };
}

/**
 * `did:web` → the URL of its DID document, per the did:web method
 * specification: `:` separates path segments, `%3A` encodes a port, and a
 * DID with no path resolves under `/.well-known/`.
 */
export function didWebUrl(did: string): string {
  const m = /^did:web:([^#?]+)$/.exec(did);
  if (!m) throw new Error(`not a did:web DID: ${did}`);
  const [host, ...path] = m[1].split(":").map(decodeURIComponent);
  if (!host) throw new Error(`did:web has no host: ${did}`);
  // Refused, never repaired: a decoded host is a DNS name with an optional
  // port, and each path part is one plain segment.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::[0-9]{1,5})?$/.test(host)) throw new Error(`did:web host is not a host name: ${did}`);
  for (const seg of path) {
    if (!/^[A-Za-z0-9._~-]+$/.test(seg) || seg === "." || seg === "..") throw new Error(`did:web path segment is not plain: ${did}`);
  }
  return path.length === 0 ? `https://${host}/.well-known/did.json` : `https://${host}/${path.join("/")}/did.json`;
}

/**
 * `JsonWebKey` is the W3C Controlled Identifiers 1.0 type (a Recommendation);
 * `JsonWebKey2020` is the form WHO's own signing DID uses today. Both carry a
 * `publicKeyJwk`, and the verifier accepts either.
 */
export type VmType = "JsonWebKey" | "JsonWebKey2020";

export interface DidDocument {
  "@context": string[];
  id: string;
  controller?: string;
  verificationMethod: { id: string; type: VmType; controller: string; publicKeyJwk: PublicJwk }[];
  assertionMethod?: string[];
}

const CONTEXT: Record<VmType, string> = {
  JsonWebKey: "https://www.w3.org/ns/cid/v1",
  JsonWebKey2020: "https://w3id.org/security/suites/jws-2020/v1",
};

/**
 * Build the DID document for `did` from its keys, in a fixed order so that
 * re-publishing it with the same keys writes the same bytes. Keep retired
 * keys listed (out of `assertionMethod`) for as long as anything they signed
 * is served.
 */
export function didDocument(
  did: string,
  keys: { fragment: string; jwk: PublicJwk; active: boolean }[],
  opts: { type?: VmType; controller?: string } = {},
): DidDocument {
  didWebUrl(did);
  const type = opts.type ?? "JsonWebKey";
  const sorted = [...keys].sort((a, b) => (a.fragment < b.fragment ? -1 : 1));
  return {
    "@context": ["https://www.w3.org/ns/did/v1", CONTEXT[type]],
    id: did,
    ...(opts.controller ? { controller: opts.controller } : {}),
    verificationMethod: sorted.map((k) => ({ id: `${did}#${k.fragment}`, type, controller: opts.controller ?? did, publicKeyJwk: publicPart(k.jwk) })),
    assertionMethod: sorted.filter((k) => k.active).map((k) => `${did}#${k.fragment}`),
  };
}

export async function generateKeyPair(alg: Alg = "ES256"): Promise<{ privateKey: webcrypto.CryptoKey; publicJwk: PublicJwk }> {
  const pair = (await subtle.generateKey(webAlg(alg), true, ["sign", "verify"])) as webcrypto.CryptoKeyPair;
  const jwk = (await subtle.exportKey("jwk", pair.publicKey)) as { x: string; y?: string };
  const publicJwk: PublicJwk = alg === "ES256" ? { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y! } : { kty: "OKP", crv: "Ed25519", x: jwk.x };
  return { privateKey: pair.privateKey, publicJwk };
}

/** Import a private key from its JWK, e.g. from the `IRIS_CDN_SIGNING_JWK` secret. */
export async function importPrivateJwk(jwk: (EcPublicJwk | OkpPublicJwk) & { d: string }): Promise<webcrypto.CryptoKey> {
  const { x5c: _x5c, ...bare } = jwk;
  return subtle.importKey("jwk", bare, webAlg(algOfJwk(jwk)), false, ["sign"]);
}

const algOfKey = (key: webcrypto.CryptoKey): Alg => (key.algorithm.name === "ECDSA" ? "ES256" : "EdDSA");

/** Sign `payload`; returns `<header>..<signature>`. `x5c`, if given, rides in the header. */
export async function signDetached(payload: string, key: webcrypto.CryptoKey, kid: string, opts: { x5c?: string[] } = {}): Promise<string> {
  if (!/^did:web:[^#]+#.+$/.test(kid)) throw new Error(`kid must be a did:web DID URL with a fragment: ${kid}`);
  const alg = algOfKey(key);
  const header = b64url(utf8(JSON.stringify({ alg, kid, ...(opts.x5c ? { x5c: opts.x5c } : {}) })));
  const input = utf8(`${header}.${b64url(utf8(payload))}`);
  // WebCrypto's ECDSA output is r||s (IEEE P1363), which is what JWS ES256 uses.
  const sig = new Uint8Array(await subtle.sign(signParams(alg), key, input));
  return `${header}..${b64url(sig)}`;
}

export type ChainState = "verified" | "absent" | "not-checked";

/**
 * Check an `x5c` chain: the leaf certificate's key must BE `jwk`, each
 * certificate must be signed by the next, every one must be in its validity
 * period at `at`, every non-leaf must be a CA, and the last must be signed by
 * one of `anchors` (e.g. WHO's signing DID key). Returns why it fails, or null.
 */
export function chainProblem(x5c: string[], jwk: PublicJwk, anchors: PublicJwk[], at: Date = new Date()): string | null {
  if (x5c.length === 0) return "empty x5c";
  let certs: X509Certificate[];
  try {
    certs = x5c.map((b64) => new X509Certificate(Buffer.from(b64, "base64")));
  } catch {
    return "x5c holds something that is not a DER certificate";
  }
  const leafJwk = certs[0].publicKey.export({ format: "jwk" }) as { x?: string; y?: string };
  if (leafJwk.x !== jwk.x || (jwk.kty === "EC" && leafJwk.y !== jwk.y)) return "leaf certificate does not hold the signing key";
  for (const [i, c] of certs.entries()) {
    if (at < new Date(c.validFrom) || at > new Date(c.validTo)) return `certificate ${i} is outside its validity period`;
    if (i > 0 && !c.ca) return `certificate ${i} is not a CA`;
    if (i + 1 < certs.length && !c.verify(certs[i + 1].publicKey)) return `certificate ${i} is not signed by certificate ${i + 1}`;
  }
  const last = certs[certs.length - 1];
  const signedByAnchor = anchors.some((a) => {
    const { x5c: _x, ...bare } = a;
    try {
      return last.verify(createPublicKey({ key: bare, format: "jwk" }));
    } catch {
      return false;
    }
  });
  return signedByAnchor ? null : "chain does not end at a trust anchor";
}

export type Verdict =
  | { state: "verified"; kid: string; chain: ChainState }
  | { state: "failed"; reason: string }
  /** The key could not be obtained. Not the same as a bad signature. */
  | { state: "unknown"; reason: string };

/**
 * Verify a detached JWS over `payload` against the DID document `doc`
 * (already resolved by the caller from `didWebUrl`, so this stays offline and
 * testable). The key must be listed under `assertionMethod` when the
 * document has one. With `anchors`, an `x5c` chain on the key (or in the
 * header) must end at one of them, and a key with no `x5c` fails; without
 * anchors, a chain is reported `not-checked`, never `verified`. With
 * `expectDid`, a `kid` outside that DID fails.
 */
export async function verifyDetached(payload: string, jws: string, doc: DidDocument | null, opts: { anchors?: PublicJwk[]; at?: Date; expectDid?: string } = {}): Promise<Verdict> {
  const parts = jws.split(".");
  if (parts.length !== 3 || parts[1] !== "") return { state: "failed", reason: "not a detached compact JWS" };
  let header: { alg?: string; kid?: string; crit?: unknown; x5c?: string[] };
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
  } catch {
    return { state: "failed", reason: "header is not JSON" };
  }
  if (header.alg !== "ES256" && header.alg !== "EdDSA") return { state: "failed", reason: `unsupported alg ${header.alg}` };
  if (header.crit !== undefined) return { state: "failed", reason: "crit header not supported" };
  const kid = header.kid;
  if (!kid) return { state: "failed", reason: "no kid" };
  if (opts.expectDid !== undefined && !kid.startsWith(`${opts.expectDid}#`)) return { state: "failed", reason: `kid ${kid} is not a key of the expected DID ${opts.expectDid}` };
  if (!doc) return { state: "unknown", reason: `DID document for ${kid} not available` };
  if (!kid.startsWith(`${doc.id}#`)) return { state: "failed", reason: `kid ${kid} is not a key of ${doc.id}` };
  if (doc.assertionMethod && !doc.assertionMethod.includes(kid)) return { state: "failed", reason: `${kid} is not an assertionMethod` };
  const vm = doc.verificationMethod.find((v) => v.id === kid);
  if (!vm) return { state: "failed", reason: `${kid} not in verificationMethod` };
  if (algOfJwk(vm.publicKeyJwk) !== header.alg) return { state: "failed", reason: `alg ${header.alg} does not match the ${vm.publicKeyJwk.kty} key` };
  const { x5c: _x5c, ...bare } = vm.publicKeyJwk;
  const key = await subtle.importKey("jwk", bare, webAlg(header.alg), false, ["verify"]);
  const input = utf8(`${parts[0]}.${b64url(utf8(payload))}`);
  if (!(await subtle.verify(signParams(header.alg), key, fromB64url(parts[2]), input))) return { state: "failed", reason: "signature does not match" };

  const x5c = vm.publicKeyJwk.x5c ?? header.x5c;
  let chain: ChainState = "absent";
  // With anchors, a key must prove its chain: no x5c is a refusal, not a pass.
  if (!x5c && opts.anchors && opts.anchors.length > 0) return { state: "failed", reason: "x5c: no certificate chain, but a trust anchor is required" };
  if (x5c) {
    if (opts.anchors && opts.anchors.length > 0) {
      const problem = chainProblem(x5c, vm.publicKeyJwk, opts.anchors, opts.at);
      if (problem) return { state: "failed", reason: `x5c: ${problem}` };
      chain = "verified";
    } else chain = "not-checked";
  }
  return { state: "verified", kid, chain };
}
