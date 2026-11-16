/**
 * `webpage` — a published documentation page, modelled as a graph node that
 * composes other nodes.
 *
 * WHY THIS IS A STRUCTURAL TYPE AND NOT A NEW `BlockKind`.
 *
 * A new block kind costs about thirty files (builder, Zod schema, label
 * prefix, viewer registration, constraint rows, QA criteria). A page is not a
 * new KIND of content; it is a new way of COMPOSING content, like `Chapter`
 * and `Section`. So `WebPage` sits beside them: its children are ordinary
 * `prose` / `table` / `diagram` blocks, and nothing here touches
 * `BLOCK_KINDS`, the `Block` union, its exhaustiveness proof, or the viewer
 * registry.
 *
 * WHAT IT ADDS THAT `Section` DOES NOT HAVE.
 *
 * `Section.blocks` is a bare `string[]` of root names — enough for a paper,
 * where the renderer decides every heading and the output is one PDF. A
 * published web page needs three things a section does not:
 *
 *   - a STABLE ID per node, independent of the heading text. The docs site runs
 *     `heading_anchors: true`, which derives `#extract-structure` from the
 *     heading's words, so retitling a section would break every inbound link,
 *     including the subprocess links `render-bpmn.ts` derives from an asset's
 *     `source`. An explicit id is what the emitter pins with kramdown's
 *     `{: #id }`, and what a graph node's `@id` is minted from.
 *   - an ASSET as a first-class child, with its own title, its own narrative
 *     and its own EDIT TARGET. A BPMN figure's source of truth is the `.bpmn`;
 *     the `.svg` beside it is generated and must never be hand-edited, so an
 *     edit link must not point at the SVG.
 *   - a NAV SLOT: `nav_order` / `parent`, just-the-docs front matter.
 * @graphNode schema
 */

/** Which source file a node's edit link opens, and how it is embedded. */
export type WebPageAssetKind = "bpmn" | "svg";

export interface WebPageAsset {
  kind: WebPageAssetKind;
  /**
   * The asset's SOURCE, repo-root-relative. This is the edit target and the
   * thing a human changes.
   */
  source: string;
  /**
   * The rendered artefact the page embeds, as a path relative to the published
   * page. GENERATED — for `kind: "bpmn"` this is `render-bpmn.ts` output and
   * carries its own "never hand-edit" rule, which is exactly why it is kept
   * separate from `source` rather than inferred from it.
   */
  rendered: string;
  /**
   * Long description for the embed's `alt`. Not optional in practice: these
   * diagrams carry the argument of the page around them, and a reader who
   * cannot see the SVG gets only this.
   */
  alt: string;
  /**
   * The link line under the figure. TWO shapes exist in the corpus today and
   * this models both rather than normalising one into the other:
   *
   *   `[Open the BPMN source](…){: .btn .btn-outline }`          -> "button"
   *   `[BPMN 2.0 source](…) · [full-size SVG](…)` + `{: .bpmn-source }` -> "caption"
   *
   * They are different kramdown constructs, not a style choice: the first is
   * an inline attribute list on a single link, the second a paragraph-level
   * one under a line carrying several. Collapsing them would silently restyle
   * four figures on `content-types.md`, which is a visible change nobody
   * asked for.
   */
  sourceLinks?: { text: string; href: string }[];
  linkStyle?: "button" | "caption";
}

export interface WebPageNode {
  /**
   * Stable identity. Becomes the heading anchor (pinned, not derived from the
   * title), the local part of the node's `@id`, and the fragment that inbound
   * links — including the BPMN subprocess links derived from `asset.source` — resolve against.
   *
   * Changing this is a breaking change to every link that targets it.
   * Changing `title` is not, which is the whole point.
   */
  id: string;
  /** Heading text. Free to change without breaking a link. */
  title?: string;
  /** Heading depth under the page's `# title`. Default 2. */
  level?: 2 | 3;
  /**
   * Narrative that INTRODUCES the asset, emitted before it.
   *
   * Two fields rather than one plus a position flag, because the corpus has
   * sections with prose on BOTH sides of a figure — measured: `The content
   * lifecycle` is 121 characters before and 1321 after, `From corpus to
   * published folio` 128 and 2577. A single block with a before/after switch
   * cannot express those without reordering the page, which is a visible
   * change to a reader and was not asked for.
   */
  lead?: string;
  /**
   * Root name of a block `.ts` + `.md` pair in the page directory, exactly as
   * `Section.blocks` names them. The `.md` is this node's narrative and is the
   * edit target for a narrative node. When the node carries an asset this is
   * the prose AFTER it.
   */
  block?: string;
  /** An asset this node presents, with its own edit target. */
  asset?: WebPageAsset;
}

export interface WebPage {
  /**
   * URL stem. `document-ingestion` publishes to `docs/guides/document-ingestion.md`
   * and thus to `<baseurl>/guides/document-ingestion.html`, which is what existing
   * inbound links already use.
   */
  slug: string;
  title: string;
  /**
   * The page's `# heading`, when it differs from the nav title. Two guides do
   * differ today — the nav says "Writing a document" while the page opens
   * "Writing a document with folio-assistant" — so this is a real distinction
   * in the corpus, not a hypothetical. Omit it and the title is used for both.
   */
  heading?: string;
  /** just-the-docs nav front matter. */
  navOrder?: number;
  /**
   * What this page documents: graph typologies (`library`), or one directory as
   * `<instance>/<id>` where the kind is too general. Emitted into the page's
   * front matter, where the coverage check reads it — the page names the
   * directory, and the directory names no page (#1168 B7c).
   */
  documents?: string[];
  parent?: string;
  /** Ordered children. */
  nodes: WebPageNode[];
  meta?: Record<string, unknown>;
}

/** Builder, matching the `prose()` / `section()` / `chapter()` convention. */
export function webpage(page: WebPage): WebPage {
  return page;
}
