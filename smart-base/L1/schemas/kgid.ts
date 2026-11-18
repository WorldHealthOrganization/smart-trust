/**
 * L1 identity and content hashing — a port of WHO smart-kg `tools/kgid.mjs`
 * (main 3f5e477), function for function, so an IRI or a hash minted here is the
 * one smart-kg mints. `test/kgid.test.ts` holds the two to the same outputs.
 *
 * The rule that matters, from smart-kg: L1 content is WHO's, not a DAK's, so
 * L1 IRIs live under one WHO-wide namespace and are built from what WHO prints
 * — the ISBN, the published number — so that two extractions of one guideline
 * yield the same nodes.
 */
import { createHash } from "node:crypto";

export const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");
export const shortHash = (s: string): string => sha256(Buffer.from(s)).slice(0, 12);

export const slug = (s: unknown): string =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const L1_NAMESPACE = "https://smart.who.int/kg/l1";

const IRI_IDENTIFIERS = ["isbn", "iris-handle", "doi", "issn", "url"] as const;

const idValue = (type: string, value: string): string => {
  const v = String(value).trim();
  if (type === "isbn" || type === "issn") return v.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (type === "url") return slug(v.replace(/^[a-z]+:\/\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^www\./i, ""));
  return slug(v);
};

export interface Identifier {
  type: string;
  value: string;
}

export const publicationId = (identifiers: Identifier[]): string => {
  for (const type of IRI_IDENTIFIERS) {
    const found = (identifiers ?? []).find((i) => i.type === type && i.value);
    if (found) return `${L1_NAMESPACE}/publication/${type}-${idValue(type, found.value)}`;
  }
  throw new Error("a publication needs an isbn, iris-handle, doi, issn or url to have a stable IRI");
};

const num = (s: unknown): string => String(s).trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9.\-]/g, "");

export const sectionId = (pub: string, number: string): string => `${pub}/section/${num(number)}`;
export const publicationElementId = (pub: string, label: string, ...parts: string[]): string =>
  [`${pub}/element/${slug(label)}`, ...parts.map((p) => slug(p))].join("/");
export const healthInterventionId = (system: string, code: string): string => `${L1_NAMESPACE}/health-intervention/${slug(system)}-${num(code)}`;
export const referenceEntryId = (artifact: string, number: string): string => `${artifact}/reference/${num(number)}`;
export const citationId = (ns: string, text: string): string => `${ns}/citation/${shortHash(text)}`;

export const normText = (s: unknown): string => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
export const norm = (s: unknown): string => normText(s).toLowerCase();

export const contentText = (node: { properties?: Record<string, unknown> }, fields: string[]): string | null => {
  const parts = fields.map((f) => node.properties?.[f]).filter((v) => v !== undefined && v !== null);
  return parts.length ? parts.map(normText).join("\n") : null;
};

export const contentHash = (text: string): string => sha256(Buffer.from(text, "utf8"));

// ---- L1 content IRIs (smart-kg kgid.mjs, the half the extractor tests need) -------------------
/** By published number; a recommendation with none is content-addressed by its statement. */
export const recommendationId = (pub: string, number: string | null | undefined, statement?: string): string =>
  `${pub}/recommendation/${number ? num(number) : "h-" + shortHash(norm(statement))}`;
export const subRecommendationId = (parent: string, letter: string): string => `${parent}/${num(letter)}`;
export const remarkId = (rec: string, ordinal: number | string): string => `${rec}/remark/${ordinal}`;
export const keyQuestionId = (pub: string, number: string): string => `${pub}/key-question/${num(number)}`;
export const outcomeId = (pub: string, name: string): string => `${pub}/outcome/${slug(name)}`;
export const evidenceId = (pub: string, keyQuestion: string, outcomeName: string): string =>
  `${pub}/evidence/${num(keyQuestion)}/${slug(outcomeName)}`;
export const indicatorId = (pub: string, refNo: string): string => `${pub}/indicator/${num(refNo)}`;
