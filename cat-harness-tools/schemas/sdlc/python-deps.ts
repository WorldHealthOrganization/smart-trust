/**
 * The Python packages this repository's scripts need — declared once.
 *
 * E.g. `pdf-structure.py` imports `pymupdf`, `pdf-ocr.py` shells to
 * tesseract, image extraction wants `pypdf` + `Pillow`. A Python tool can only
 * be tested in CI if CI installs its backend, so every such need is declared
 * here.
 *
 * ## Authoritative here, `requirements*.txt` generated
 *
 * The TypeScript is definitional and the published artefact is downstream
 * (`directory-conventions` §"What lives in the `schemas` graph"). A flat
 * `requirements.txt` cannot carry which import name a distribution provides,
 * or why a declared package has no import at all, so it is the OUTPUT, not
 * the source.
 *
 * ## Two tiers
 *
 * | set | wheels | size |
 * |---|---|---|
 * | `lean` | 12 wheels | **144 MB** |
 * | `lean` + `extended` | 16 wheels | **467 MB** |
 *
 * `extended` is `camelot-py` and what it pulls transitively (numpy, pandas,
 * OpenCV), for ONE script — `pdf-tables.py` — so it is installed separately.
 * The sizes were measured with a warm cache; a cold CI runner pays more.
 *
 * The table predates the OPUS-MT runner's entries (`transformers`, `torch`,
 * `sentencepiece`, 2026-11-14), each of which states its own wheel size; with
 * them, `extended` is dominated by `torch`, not `camelot-py`.
 *
 * @module schemas/python-deps
 * @graphNode schema
 */
import { z } from "zod";

/**
 * Which install set a package belongs to.
 *
 * - `lean` — installed in CI. Everything a gate can exercise.
 * - `extended` — declared, NOT installed in CI, with `why` saying what it
 *   costs. A path needing one of these is a path CI cannot test, and the arm
 *   that needs it must say so rather than pretend otherwise.
 */
export const DEP_TIERS = ["lean", "extended"] as const;
export type DepTier = (typeof DEP_TIERS)[number];

export const PythonDepSchema = z
  .object({
    /** The distribution name pip installs, e.g. `pdfminer.six`. */
    distribution: z.string().min(1),
    /**
     * The module name Python imports, when it differs from the distribution.
     *
     * `PyYAML` imports as `yaml`, `pdfminer.six` as `pdfminer`, `camelot-py`
     * as `camelot`. Without this mapping a checker comparing imports to
     * declarations reports three false gaps, which is how such a checker gets
     * switched off.
     */
    imports: z.string().min(1).optional(),
    tier: z.enum(DEP_TIERS),
    /**
     * Why this is declared — and for a `transitive` entry, why it has no
     * import of its own.
     */
    why: z.string().min(1),
    /**
     * Nothing imports it directly; it is required by something that does.
     *
     * `Pillow` is the case: `pypdf` refuses image extraction without it and
     * raises at the point of use, so it is a real requirement that no `import`
     * statement will ever reveal. Stated, so "declared and unimported" is
     * distinguishable from dead weight — which is what the checker would
     * otherwise have to guess.
     */
    transitive: z.boolean().optional(),
  })
  .refine((d) => d.transitive !== true || /require|need|pull|without/i.test(d.why), {
    message: "a transitive entry's `why` must say what requires it — otherwise it reads as dead weight",
    path: ["why"],
  });

export type PythonDep = z.infer<typeof PythonDepSchema>;

/**
 * Every Python package this repository's scripts need.
 *
 * Derived from a real scan, not from memory: `check-python-deps.ts` parses
 * every `scripts/**‌/*.py` and compares. Adding a script that imports
 * something new fails that check until it is declared here.
 */
export const PYTHON_DEPS: readonly PythonDep[] = [
  {
    distribution: "pymupdf",
    tier: "lean",
    why: "The PDF backend for `pdf-structure.py` and `pdf-pages.py` — embedded outline, page text, page count. The single most load-bearing dependency here and the one nothing declared.",
  },
  {
    distribution: "pypdf",
    tier: "lean",
    why: "`pdf-extract.py`, `pypdf_safe.py` and `_pypdf_compat.py`. Also the image-extraction path, which is why Pillow is below.",
  },
  {
    distribution: "pillow",
    imports: "PIL",
    tier: "lean",
    why: "Required by `pypdf` for image extraction: without it `page.images` raises `ImportError: pillow is required` at the point of use, while `len(page.images)` quietly returns 0 — a false zero measured 2026-09-19 while scoping `d5f1`. Also imported directly by `image-reuse.py`, which needs WebP decoding to match an ingested image against theme art (bean `scfh`).",
  },
  {
    distribution: "pdfplumber",
    tier: "lean",
    why: "`_pypdf_compat.py`'s second backend, so a document one reader cannot open is not simply refused.",
  },
  {
    distribution: "pdfminer.six",
    imports: "pdfminer",
    tier: "lean",
    why: "`pdf-extract.py`. The distribution name differs from the import name, which is exactly what `imports` exists for.",
  },
  {
    distribution: "lxml",
    tier: "lean",
    why: "Both translation extract/inject scripts — XML with namespaces, which `xml.etree` handles poorly enough to matter here.",
  },
  {
    distribution: "requests",
    tier: "lean",
    why: "The five translation scripts that reach Crowdin, Launchpad and Weblate.",
  },
  {
    distribution: "PyYAML",
    imports: "yaml",
    tier: "lean",
    why: "`translation_config.py`. Imports as `yaml`.",
  },
  {
    distribution: "cryptography",
    tier: "lean",
    why: "`pypdf_safe.py`. Present system-wide in this container, which is precisely why it went undeclared in the first draft of this list — the checker caught it, and 'it happens to be installed here' is how an undeclared dependency is born.",
  },
  {
    distribution: "cffi",
    tier: "lean",
    transitive: true,
    why: "Required by `cryptography`'s Rust bindings: without it, importing `cryptography` raises `ModuleNotFoundError: _cffi_backend` and then PANICS under pyo3 — a failure at IMPORT time, before any code runs. Measured 2026-09-19 in this container while scoping `d5f1`; installing `cffi` was what made `pypdf` usable at all.",
  },
  {
    distribution: "camelot-py",
    imports: "camelot",
    tier: "extended",
    why: "`pdf-tables.py` only. 912 KB itself, but it pulls numpy, pandas and OpenCV — 323 MB measured 2026-09-20, more than the whole lean set. Kept out of CI for that reason alone; the script is live (two skills document it, bean `fj94` has 38 tests) and this is a cost statement, not a deprecation.",
  },
  {
    distribution: "vosk",
    tier: "extended",
    why: "`meeting-recording.py transcribe` only: an offline second transcript of a recorded walkthrough, to compare with the meeting tool's own (skill `crdm-recorded-walkthrough`). Imported inside that one subcommand, so the other four run without it. The wheel is 7.2 MB (vosk 0.3.45, measured 2026-10-06), and it needs a speech model the caller supplies on top. Extended because nothing in CI transcribes, so CI should not pay for it.",
  },
  {
    distribution: "transformers",
    tier: "extended",
    why: "`translation/opus_mt_runner.py` only: runs the Helsinki-NLP OPUS-MT Marian models (CC-BY 4.0) locally for `translate-pot.ts --engine opus-mt` and `translation-candidates.ts --engine opus-mt`, open machine translation with no freemium API quota (owner, 2026-11-14). Imported inside `main()`, so an empty request needs no model. The wheel is 13.3 MB (transformers 5.23.0, PyPI, 2026-11-14), but it needs `torch` below, and each OPUS-MT model is a further download on first use. Extended because nothing in CI translates; the TypeScript side is tested with a fake engine.",
  },
  {
    distribution: "torch",
    tier: "extended",
    transitive: true,
    why: "The tensor backend `transformers` needs to run a Marian model in `translation/opus_mt_runner.py` (`return_tensors=\"pt\"`). Never imported by name; declared because `transformers` does not install it. The heaviest entry here: the manylinux x86_64 wheel alone is 539.2 MB (torch 2.15.0, cp312, PyPI, 2026-11-14), before any CUDA libraries it pulls.",
  },
  {
    distribution: "sentencepiece",
    tier: "extended",
    transitive: true,
    why: "`MarianTokenizer` in `translation/opus_mt_runner.py` loads the OPUS-MT `.spm` vocabularies with it, and `transformers` does not install it. Never imported by name. 1.7 MB (sentencepiece 0.2.3, cp312 manylinux wheel, PyPI, 2026-11-14).",
  },
  {
    distribution: "anthropic",
    tier: "extended",
    why: "`pdf-ocr.py --vision-digits` only: an opt-in fallback that asks a vision model to re-read the number words Tesseract is unsure of on Arabic-script pages (10665-94830-per, owner 2026-11-15). Imported inside `anthropic_ask`, so a run without the flag needs neither it nor credentials. The wheel is 2.3 MB (anthropic 2.8.0, py3-none-any, PyPI, 2026-11-15) and pulls httpx, pydantic and jiter. Extended because CI never calls a remote model; the tests drive the fallback with a fake `ask`.",
  },
];

/** The module name an entry provides — `imports` when given, else the distribution. */
export function importNameOf(d: PythonDep): string {
  return d.imports ?? d.distribution;
}

export function depsForTier(tier: DepTier): readonly PythonDep[] {
  return PYTHON_DEPS.filter((d) => d.tier === tier);
}

/**
 * The generated requirements file for a tier, relative to the TOOL LAYER's
 * root — see `scripts/gen-python-deps.ts` there, which writes it.
 *
 * THE ONE PLACE THE LOCATION IS WRITTEN. The pair sat at the repository root
 * until 2026-10-06 (bean `ar1s`, phase 3: tooling leaves the root before the
 * repo split) and now lives in the tool layer's declared `python/` directory,
 * whose declaration describes it. CI installs the lean file from the checkout
 * root; dependabot's pip `directory:` names the same place.
 */
export const REQUIREMENTS_DIR = "python";

export function requirementsPath(tier: DepTier): string {
  return `${REQUIREMENTS_DIR}/${tier === "lean" ? "requirements.txt" : "requirements-extended.txt"}`;
}
