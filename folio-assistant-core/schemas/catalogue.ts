/**
 * A remote catalogue, modelled in the graph without holding it.
 *
 * @module schemas/catalogue
 * @graphNode schema
 *
 * ## The ask, and why it is not "import IRIS"
 *
 * The owner, 2026-09-20: *"in just the docs rendering, mock up the full iris
 * catalog as having been in the KG (by referenced, not slurped up, its 361.55 GB)"*
 * and *"stub out their hierachy (collections, etc,) and put this in there. as
 * if this is test import."*
 *
 * So the graph carries the SHAPE of a catalogue at full extent while holding
 * bytes for a handful of nodes. Every node declares its
 * {@link module:schemas/materialization} state, and the rendering shows the
 * difference, because a tree that looks the same whether or not the bytes are
 * there is a tree that lies about the corpus.
 *
 * ## Generic, though IRIS is the worked instance
 *
 * DSpace's containment is community → sub-community → collection → item →
 * bitstream, and every one of those words is DSpace's. This type uses
 * `container` and `item` instead, with a `flavour` naming the source system's
 * own word, for the reason `Theme` takes a `kind` rather than splitting into
 * three node types: one vocabulary with a discriminator beats three spellings
 * of "the thing that contains things". An OAI-PMH set, a Zenodo community and
 * a plain S3 prefix are the same shape; only the word differs.
 *
 * The IRIS-specific reading — that a DSpace UUID, a Handle and a WHO govdoc
 * number are three identifier systems with different authority behind them —
 * is in the IRIS catalogue layer's `iris-dspace` skill, where it can be argued
 * with. It is not in this schema, which would make it look like a property of
 * catalogues in general.
 *
 * ## Containment is a PATH, not a parent
 *
 * The measured breadcrumb on the one item this repository has captured is
 * *Home → 7. Regional Office for the … → Regional Office for the W… → Information
 * products*. Four levels, of which two are communities and one a collection,
 * and DSpace permits an item to be mapped into more than one collection. So
 * `parents` is a list of paths, not a single id, and a consumer walking "the"
 * parent of a node is already wrong on real data.
 */
import { z } from "zod";
import { MaterializationSchema } from "./materialization.js";

export const CATALOGUE_SCHEMA_TAG = "folio-catalogue/v1";
export const CATALOGUE_NODE_SCHEMA_TAG = "folio-catalogue-node/v1";

/**
 * What kind of node this is in the containment tree.
 *
 * Two, not five. DSpace's community / sub-community / collection distinction
 * is a rule about what may contain what, not three different kinds of thing —
 * and the rule differs per source system, so encoding it in the union would
 * make the union source-specific. `flavour` keeps the source's own word.
 */
export const CATALOGUE_NODE_KINDS = ["container", "item"] as const;
export type CatalogueNodeKind = (typeof CATALOGUE_NODE_KINDS)[number];

/**
 * A rectangle blanked out of a raster before its bytes were written.
 *
 * In the raster's OWN pixel coordinates, origin top-left, `x1`/`y1` exclusive
 * — the same space `pixelWidth`/`pixelHeight` describe, so a reader needs no
 * second frame of reference and no scale factor.
 *
 * ## `reason` is required, and that is the whole point
 *
 * A blanked rectangle and a publication that never had anything there are
 * indistinguishable in the bytes, and they mean opposite things: one is a
 * decision somebody took, the other is a fact about the document. This
 * repository keeps paying for that shape — a withheld cover rendering
 * identically to an absent one, a red workflow looking exactly like a green
 * one — so the schema refuses a mask that does not say why it exists.
 *
 * It is NOT a redaction primitive for sensitive content. The bytes under a
 * mask are simply overwritten with a flat colour and the source document is
 * untouched, so anyone holding the source can see what was covered. It records
 * *this rendering withheld that region*, nothing stronger.
 */
export const MaskedRegionSchema = z
  .object({
    x0: z.number().int().nonnegative(),
    y0: z.number().int().nonnegative(),
    /** Exclusive. */
    x1: z.number().int().positive(),
    /** Exclusive. */
    y1: z.number().int().positive(),
    /** Why this region is masked, in a person's words. Never generated. */
    reason: z.string().min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    // An empty or inverted rectangle masks nothing while reading as a mask —
    // the declaration would claim a withholding that did not happen.
    if (r.x1 <= r.x0 || r.y1 <= r.y0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `a masked region must have positive area; got x ${r.x0}..${r.x1}, y ${r.y0}..${r.y1}`,
      });
    }
  });
export type MaskedRegion = z.infer<typeof MaskedRegionSchema>;

/**
 * One file belonging to an item.
 *
 * DSpace groups these into BUNDLES ("Original bundle" in the measured record),
 * so an item is not one file and `bitstreams` is not `file`. Size and format
 * are per-bitstream: the 2.68 MB in the record is the PDF's, not the item's.
 */
export const BitstreamSchema = z
  .object({
    name: z.string().min(1),
    bundle: z.string().min(1).default("ORIGINAL"),
    bytes: z.number().int().nonnegative().optional(),
    mediaType: z.string().min(1).optional(),
    /**
     * Pixel dimensions, where the bitstream is a raster.
     *
     * A THUMBNAIL bitstream is laid out by a renderer that needs to reserve
     * space before the image loads, and a listing that guesses gets a reflow.
     * Absent is **unmeasured**, never square and never a default: the three
     * WHO IRIS covers are 2:3, 0.705:1 and a scanned page, so any default
     * would be wrong about at least two of them.
     */
    pixelWidth: z.number().int().positive().optional(),
    pixelHeight: z.number().int().positive().optional(),
    /**
     * Regions blanked out of these bytes before they were written.
     *
     * Declared HERE rather than discovered by the renderer, for the reason the
     * whole catalogue works this way: a generator that decided for itself what
     * to blank would blank different things as its heuristics changed, and
     * nothing in the repository would record that it had. The regions are an
     * editorial decision about a specific publication, so they are data.
     *
     * Absent means nothing was masked. An empty array is not a way to say it —
     * it reads as "a mask list somebody emptied", which is a different fact —
     * so the schema takes the field away rather than leaving `[]` behind.
     */
    maskedRegions: z.array(MaskedRegionSchema).nonempty().optional(),
    /** Its own materialisation state. An item may be referenced while one of its bitstreams is materialised — which is exactly the worked example. */
    materialization: MaterializationSchema,
  })
  .strict()
  .superRefine((b, ctx) => {
    // One dimension alone cannot be used by anything that needs a box, and
    // reads as measured. Both or neither.
    if ((b.pixelWidth === undefined) !== (b.pixelHeight === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`pixelWidth` and `pixelHeight` come together: one alone cannot reserve a box, " +
          "and a consumer that reads it will pair it with a guess",
      });
    }
    // A mask is stated in the raster's own pixels, so it needs a raster to be
    // stated in. Without dimensions the coordinates mean nothing checkable and
    // a region could name pixels the file does not have.
    if (b.maskedRegions && (b.pixelWidth === undefined || b.pixelHeight === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`maskedRegions` are in the raster's own pixel coordinates, so the bitstream must also " +
          "declare `pixelWidth`/`pixelHeight` — otherwise the rectangle cannot be checked against anything",
      });
    }
    // Out of bounds is the defect this catches: a region measured on one
    // rendering and left behind when the width changed still LOOKS like a
    // mask, and the part that fell outside is simply not covered any more.
    for (const [i, r] of (b.maskedRegions ?? []).entries()) {
      if (b.pixelWidth !== undefined && b.pixelHeight !== undefined && (r.x1 > b.pixelWidth || r.y1 > b.pixelHeight)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `maskedRegions[${i}] runs to (${r.x1},${r.y1}), outside the declared ` +
            `${b.pixelWidth}x${b.pixelHeight} raster — a mask measured against a different rendering`,
        });
      }
    }
  });
export type Bitstream = z.infer<typeof BitstreamSchema>;

/**
 * A Handle — `<prefix>/<suffix>`, e.g. `10665/332098` — the persistent
 * identifier DSpace mints, resolvable through the global Handle System
 * independently of the host that published it.
 *
 * Bean `08u4`, from the `v048` roast (objections 6 + 7) and `iris-dspace.md`
 * R1: *"Resolve by Handle where one exists… only the Handle is guaranteed
 * outside WHO"*. A host URL like `iris.who.int/handle/10665/332098` carries
 * the Handle but resolves only while that host does; the owner's question was
 * *"what happens if data source goes away"*.
 */
export const HandleSchema = z
  .string()
  .regex(/^\d+(\.\d+)*\/\S+$/, "a Handle is <prefix>/<suffix>, e.g. 10665/332098");

/** The global Handle System resolver: the one address that outlives the publishing host. */
export const HANDLE_RESOLVER = "https://hdl.handle.net/";

/** The resolvable IRI for a Handle. */
export function handleIri(handle: string): string {
  return `${HANDLE_RESOLVER}${handle}`;
}

/**
 * The Handle a host URL carries (`…/handle/<prefix>/<suffix>`), or undefined.
 * Reading, not minting: a URL without `/handle/` yields nothing, never a guess.
 */
export function handleFromUrl(url: string | undefined): string | undefined {
  const m = url?.match(/\/handle\/(\d+(?:\.\d+)*\/[^/?#\s]+)/);
  return m?.[1];
}

export const CatalogueNodeSchema = z
  .object({
    $schema: z.literal(CATALOGUE_NODE_SCHEMA_TAG),
    id: z.string().min(1),
    kind: z.enum(CATALOGUE_NODE_KINDS),
    /** The source system's own word for this node — `community`, `collection`, `set`, `prefix`. Display and provenance only; nothing branches on it. */
    flavour: z.string().min(1).optional(),
    title: z.string().min(1),
    /**
     * Containment, as paths from the catalogue root. A LIST, because an item
     * may be mapped into several collections and because the breadcrumb on the
     * one measured item is four levels deep.
     */
    parents: z.array(z.array(z.string().min(1))).default([]),
    /**
     * How many children the SOURCE says this container has — not how many are
     * modelled here. The gap between the two is the whole point of a catalogue
     * by reference, and a renderer that counted `children.length` would report
     * the model's size as the collection's.
     */
    childCountUpstream: z.number().int().nonnegative().optional(),
    /**
     * The node's Handle, where the source mints one — PREFERRED over any host
     * URL for resolution ({@link resolvableIri}). Recorded only when read off
     * the source; never derived for a node that shows none (a DSpace
     * community or collection has a Handle upstream, but none is recorded
     * here until one is read).
     */
    handle: HandleSchema.optional(),
    /** The local library slug, where this item has been ingested. Present iff something under `library/` corresponds. */
    libraryId: z.string().min(1).optional(),
    /** The item's metadata record, by reference to a `folio-dublin-core/v1` file. */
    metadataRef: z.string().min(1).optional(),
    bitstreams: z.array(BitstreamSchema).default([]),
    materialization: MaterializationSchema,
  })
  .strict()
  .superRefine((n, ctx) => {
    if (n.kind === "container" && n.bitstreams.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a container holds nodes, not bitstreams; an item holds bitstreams",
      });
    }
    if (n.libraryId && n.materialization.state !== "materialized") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `node ${n.id} names libraryId "${n.libraryId}" but declares state ` +
          `"${n.materialization.state}". A slug under library/ IS the bytes being here; ` +
          "declaring otherwise makes corpus-grep and the catalogue disagree about what exists",
      });
    }
  });
export type CatalogueNode = z.infer<typeof CatalogueNodeSchema>;

/**
 * Where to resolve a node: its Handle IRI when it has one, else the host URL
 * its materialization (or an ORIGINAL-bearing bitstream) names, else
 * undefined — never a fallback to the host's front page.
 */
export function resolvableIri(n: Pick<CatalogueNode, "handle" | "materialization" | "bitstreams">): string | undefined {
  if (n.handle) return handleIri(n.handle);
  const b = n.bitstreams?.find((x) => (x.materialization?.provenance as { upstream?: string } | undefined)?.upstream);
  return (
    (b?.materialization?.provenance as { upstream?: string } | undefined)?.upstream ??
    (n.materialization?.provenance as { upstream?: string } | undefined)?.upstream
  );
}

/**
 * The catalogue itself.
 *
 * `totalBytesUpstream` and `totalItemsUpstream` are what make a `size` gate
 * answerable. Without them "three items are materialised" is a number with no
 * denominator, and the whole reason this import is by reference — 361.55 GB — is
 * a fact held only in a chat message.
 */
export const CatalogueSchema = z
  .object({
    $schema: z.literal(CATALOGUE_SCHEMA_TAG),
    id: z.string().min(1),
    title: z.string().min(1),
    /** The source system, e.g. `DSpace 7`. */
    system: z.string().min(1),
    baseUrl: z.string().url(),
    /**
     * ITEMS upstream — the things a person cites, not the files they are made of.
     *
     * Distinct from {@link totalFilesUpstream} on purpose. DSpace groups
     * bitstreams into bundles and an item carries several, so the two differ
     * by a factor a catalogue cannot derive: measured on WHO IRIS, 273,559
     * items against 1,057,223 files, a ratio of 3.86. Feeding the file count
     * into this field — which the IRIS catalogue layer did, with a note saying so — makes
     * every completeness fraction read low by that factor.
     */
    totalItemsUpstream: z.number().int().nonnegative().optional(),
    /**
     * FILES upstream, where the source publishes that separately.
     *
     * A size gate's denominator is bytes, and a *coverage* claim's denominator
     * is items; the file count answers neither on its own, which is exactly
     * why it needs its own field rather than the nearest one.
     */
    totalFilesUpstream: z.number().int().nonnegative().optional(),
    totalBytesUpstream: z.number().int().nonnegative().optional(),
    /** How the numbers above were arrived at. A denominator with no provenance is a denominator nobody can check. */
    sizeBasis: z.string().min(1).optional(),
    nodesDir: z.string().min(1).default("nodes"),
    /**
     * What survives if the SOURCE goes away, stated per node kind — not only
     * for bytes already copied (bean `08u4`). The `sourceLoss` GATE is asked
     * only of a materialization; a referenced node never meets it, so without
     * this the answer for 10 of 13 nodes was silence.
     */
    sourceLoss: z
      .object({
        container: z.string().min(1),
        referencedItem: z.string().min(1),
        materializedItem: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type Catalogue = z.infer<typeof CatalogueSchema>;

/** How much of a catalogue is actually here. The three counts are reported separately and never summed into a percentage, because a percentage of an unknown denominator is a number that looks checked. */
export function materializationCensus(nodes: CatalogueNode[]): Record<string, number> {
  const out: Record<string, number> = { unknown: 0, referenced: 0, materialized: 0 };
  for (const n of nodes) out[n.materialization.state] += 1;
  return out;
}
