#!/usr/bin/env python3
"""Emit an advisory formula-region sidecar (`formula-regions.json`) and score against ground-truth boxes.

Bean `folio-assistant-f0hv` (`cat-harness-tools#131`):
- Reads recorded ScanSSD-style formula detector output (`folio-formula-detections/v1`
  or ScanSSD CSV) and writes `<entry>/formula-regions.json` (`folio-formula-regions/v1`).
- Bounding boxes are stored in the VISIBLE-frame PDF user-space coordinates
  (`[x0, y0, x1, y1]` in 72 DPI points, origin top-left, rotation applied), the
  same coordinate convention `vector-labels.json` uses.
- Advisory only: never transcribes formulas, never modifies `sections/`, and
  nothing in `check-l1-complete.ts` gates promotion on `formula-regions.json`.
- Scans only by default: entries whose sections already carry `text_source: latex`
  (from `latex-math-overlay.py`) are skipped unless `--force` is passed.
- Explicit about absence: when neither recorded detector output nor model
  weights are available, records `status: "undetermined"` and `pages: null`
  with `undetermined_reason` — never a silent empty list (`pages: []`).
- Includes a `score` subcommand (`--benchmark`) that evaluates emitted or
  recorded formula boxes against committed `truth.json` boxes (`IoU >= 0.5`
  and `IoU >= 0.75`, 1-to-1 greedy matching per page).

Usage:
    python3 scripts/pdf-formula-regions.py --entry library/emden76 --detections test/fixtures/formula-regions/tfd-icdar2019v2-emden76/detections.json
    python3 scripts/pdf-formula-regions.py score --detections test/fixtures/formula-regions/tfd-icdar2019v2-emden76/detections.json --truth test/fixtures/formula-regions/tfd-icdar2019v2-emden76/truth.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _benchmark_guard import assert_not_declared_graph_path  # noqa: E402
from _pdf_doc_id import derive_doc_id_from_pdf as _doc_id  # noqa: E402

SCHEMA = "folio-formula-regions/v1"
DETECTIONS_SCHEMA = "folio-formula-detections/v1"
TRUTH_SCHEMA = "folio-formula-truth/v1"
SCORE_SCHEMA = "folio-formula-region-benchmark/v1"
SIDECAR_FILENAME = "formula-regions.json"
DEFAULT_RECORDED_DETECTIONS = "formula-detections.json"

LATEX_TEXT_SOURCE_RE = re.compile(
    r"^\s*text_source\s*:\s*['\"]?latex['\"]?\s*$",
    re.MULTILINE,
)


def undetermined(doc_id: str, reason: str, status: str = "undetermined") -> dict[str, Any]:
    """Return the third-state sidecar (`pages: None` + `undetermined_reason`)."""
    return {
        "$schema": SCHEMA,
        "doc_id": doc_id,
        "status": status,
        "pages": None,
        "undetermined_reason": reason,
    }


def has_latex_math_overlay(entry_dir: Path | None) -> bool:
    """Return True if `<entry_dir>/sections/*.md` or `structure.json` already carries `text_source: latex`."""
    if entry_dir is None or not entry_dir.is_dir():
        return False
    sections_dir = entry_dir / "sections"
    if sections_dir.is_dir():
        for md_path in sorted(sections_dir.glob("*.md")):
            try:
                head = md_path.read_text(encoding="utf-8", errors="replace")[:4096]
            except OSError:
                continue
            if head.startswith("---"):
                end_idx = head.find("\n---", 3)
                frontmatter = head[3:end_idx] if end_idx != -1 else head
                if LATEX_TEXT_SOURCE_RE.search(frontmatter):
                    return True
    structure_path = entry_dir / "structure.json"
    if structure_path.is_file():
        try:
            data = json.loads(structure_path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("text_source") == "latex":
                return True
        except Exception:  # noqa: BLE001
            pass
    return False


def transform_unrotated_to_visible(
    bbox: list[float],
    rotation: int,
    unrotated_size_pt: list[float] | tuple[float, float],
) -> list[float]:
    """Transform an unrotated PDF user-space `[x0, y0, x1, y1]` box into the visible (rotated) frame.

    Matches PyMuPDF's `Rect(bbox) * page.rotation_matrix` convention used by
    `pdf-vector-labels.py`:
    - rotation 0:   (x, y) -> (x, y)
    - rotation 90:  clockwise 90 deg, visible width = H, visible height = W:
                    (x, y) -> (H - y, x)
    - rotation 180: (x, y) -> (W - x, H - y)
    - rotation 270: clockwise 270 deg, visible width = H, visible height = W:
                    (x, y) -> (y, W - x)
    """
    x0, y0, x1, y1 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
    w, h = float(unrotated_size_pt[0]), float(unrotated_size_pt[1])
    rot = rotation % 360
    if rot == 0:
        pts = [(x0, y0), (x1, y1)]
    elif rot == 90:
        pts = [(h - y0, x0), (h - y1, x1)]
    elif rot == 180:
        pts = [(w - x0, h - y0), (w - x1, h - y1)]
    elif rot == 270:
        pts = [(y0, w - x0), (y1, w - x1)]
    else:
        pts = [(x0, y0), (x1, y1)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]


def region_to_visible_pdf_bbox(
    region: dict[str, Any],
    page_obj: dict[str, Any],
    default_dpi: float = 256.0,
) -> list[float] | None:
    """Convert a recorded region's coordinates to visible-frame PDF points `[x0, y0, x1, y1]`."""
    rotation = int(page_obj.get("rotation", 0) or 0)
    frame = str(region.get("coordinate_frame") or page_obj.get("coordinate_frame") or "")

    if "bbox" in region and region["bbox"] is not None:
        raw = [float(v) for v in region["bbox"]]
        if len(raw) != 4:
            return None
        if frame == "unrotated_pt":
            size_pt = page_obj.get("unrotated_page_size_pt") or page_obj.get("page_size_pt")
            if isinstance(size_pt, list) and len(size_pt) == 2:
                raw = transform_unrotated_to_visible(raw, rotation, size_pt)
        x0, y0, x1, y1 = raw
        if x1 <= x0 or y1 <= y0:
            return None
        return [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]

    if "pixel_bbox" in region and region["pixel_bbox"] is not None:
        px = [float(v) for v in region["pixel_bbox"]]
        if len(px) != 4:
            return None
        img_size = page_obj.get("image_size")
        page_size_pt = page_obj.get("page_size_pt")
        if (
            isinstance(img_size, list)
            and len(img_size) == 2
            and isinstance(page_size_pt, list)
            and len(page_size_pt) == 2
            and float(img_size[0]) > 0
            and float(img_size[1]) > 0
        ):
            sx = float(page_size_pt[0]) / float(img_size[0])
            sy = float(page_size_pt[1]) / float(img_size[1])
        else:
            dpi = float(page_obj.get("dpi") or default_dpi)
            sx = sy = 72.0 / dpi
        x0 = px[0] * sx
        y0 = px[1] * sy
        x1 = px[2] * sx
        y1 = px[3] * sy
        if frame == "unrotated_px":
            size_pt = page_obj.get("unrotated_page_size_pt") or page_obj.get("page_size_pt")
            if isinstance(size_pt, list) and len(size_pt) == 2:
                return transform_unrotated_to_visible([x0, y0, x1, y1], rotation, size_pt)
        if x1 <= x0 or y1 <= y0:
            return None
        return [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]

    return None


def read_pdf_page_geometry(pdf_path: Path | None) -> dict[int, dict[str, Any]]:
    """Read per-page rotation and visible `page_size_pt` from `pdf_path` when available."""
    if pdf_path is None or not pdf_path.is_file():
        return {}
    try:
        import pymupdf
    except ImportError:
        return {}
    try:
        doc = pymupdf.open(pdf_path)
    except Exception:  # noqa: BLE001
        return {}
    out: dict[int, dict[str, Any]] = {}
    for idx in range(doc.page_count):
        page = doc[idx]
        rect = page.rect
        unrot = page.cropbox
        out[idx + 1] = {
            "rotation": int(page.rotation),
            "page_size_pt": [round(float(rect.width), 2), round(float(rect.height), 2)],
            "unrotated_page_size_pt": [round(float(unrot.width), 2), round(float(unrot.height), 2)],
        }
    return out


def build_sidecar_from_detections(
    doc_id: str,
    detections_doc: dict[str, Any],
    pdf_path: Path | None = None,
    min_confidence: float = 0.0,
) -> dict[str, Any]:
    """Convert recorded detector output into a `folio-formula-regions/v1` advisory sidecar."""
    raw_pages = detections_doc.get("pages")
    if raw_pages is None:
        reason = detections_doc.get("undetermined_reason") or (
            "recorded detector output carries pages: null (detector did not complete)"
        )
        return undetermined(doc_id, str(reason))

    if not isinstance(raw_pages, list):
        return undetermined(doc_id, "recorded detector output has invalid 'pages' field")

    prov = detections_doc.get("provenance") if isinstance(detections_doc.get("provenance"), dict) else {}
    default_dpi = float(prov.get("dpi") or 256.0)
    pdf_geom = read_pdf_page_geometry(pdf_path)

    pages_out: list[dict[str, Any]] = []
    seen_pages: set[int] = set()

    for page_obj in raw_pages:
        if not isinstance(page_obj, dict) or "page" not in page_obj:
            continue
        page_num = int(page_obj["page"])
        if page_num in seen_pages:
            return undetermined(doc_id, f"page {page_num} recorded twice in detector output")
        seen_pages.add(page_num)

        geom = pdf_geom.get(page_num, {})
        merged_page_obj = {**geom, **page_obj}
        rotation = int(merged_page_obj.get("rotation", 0) or 0)
        page_size_pt = merged_page_obj.get("page_size_pt")

        regions_out: list[dict[str, Any]] = []
        for reg in page_obj.get("regions", []):
            if not isinstance(reg, dict):
                continue
            conf = float(reg.get("confidence", 1.0))
            if conf < min_confidence:
                continue
            bbox = region_to_visible_pdf_bbox(reg, merged_page_obj, default_dpi=default_dpi)
            if bbox is None:
                continue
            # Advisory region record: bbox + confidence ONLY. Never transcribes.
            regions_out.append({
                "bbox": bbox,
                "confidence": round(conf, 4),
            })

        # Deterministic ordering in the visible frame: top edge, then left edge.
        regions_out.sort(key=lambda r: (r["bbox"][1], r["bbox"][0], r["bbox"][3], r["bbox"][2]))

        page_entry: dict[str, Any] = {
            "page": page_num,
            "rotation": rotation,
            "regions": regions_out,
        }
        if isinstance(page_size_pt, list) and len(page_size_pt) == 2:
            page_entry["page_size_pt"] = [round(float(page_size_pt[0]), 2), round(float(page_size_pt[1]), 2)]
        pages_out.append(page_entry)

    pages_out.sort(key=lambda p: p["page"])

    detector_meta: dict[str, Any] = {
        "name": str(prov.get("detector") or detections_doc.get("detector") or "ScanSSD"),
    }
    for k in ("weights_file", "weights_sha256", "dpi", "conf_threshold", "window", "stride", "post_process"):
        if k in prov:
            detector_meta[k] = prov[k]

    return {
        "$schema": SCHEMA,
        "doc_id": doc_id,
        "status": "determined",
        "advisory": True,
        "detector": detector_meta,
        "pages": pages_out,
    }


def extract_formula_regions(
    doc_id: str,
    entry_dir: Path | None = None,
    pdf_path: Path | None = None,
    detections_path: Path | None = None,
    force: bool = False,
    min_confidence: float = 0.0,
) -> dict[str, Any]:
    """Produce the `formula-regions.json` payload for an entry or PDF."""
    if not force and has_latex_math_overlay(entry_dir):
        out = undetermined(
            doc_id,
            "entry already carries text_source: latex sections from latex-math-overlay.py; "
            "formula-region detection is for scans without LaTeX source (pass --force to override)",
            status="skipped",
        )
        out["skipped_reason"] = "born-digital entry with text_source: latex overlay"
        return out

    resolved_det = detections_path
    if resolved_det is None and entry_dir is not None:
        candidate = entry_dir / DEFAULT_RECORDED_DETECTIONS
        if candidate.is_file():
            resolved_det = candidate

    if resolved_det is None:
        return undetermined(
            doc_id,
            "no recorded detector output (--detections) or local ScanSSD weights provided. "
            "This is NOT 'the document contains no formulas': supply recorded detector output "
            "or run ScanSSD to record detections first.",
        )

    if not resolved_det.is_file():
        return undetermined(
            doc_id,
            f"recorded detector output {resolved_det} does not exist. "
            "This is NOT 'the document contains no formulas'.",
        )

    try:
        detections_doc = json.loads(resolved_det.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return undetermined(doc_id, f"could not parse detector output {resolved_det.name}: {exc}")

    return build_sidecar_from_detections(
        doc_id=doc_id,
        detections_doc=detections_doc,
        pdf_path=pdf_path,
        min_confidence=min_confidence,
    )


def bbox_iou(a: list[float], b: list[float]) -> float:
    """Compute Intersection-over-Union of two `[x0, y0, x1, y1]` boxes."""
    ix0 = max(float(a[0]), float(b[0]))
    iy0 = max(float(a[1]), float(b[1]))
    ix1 = min(float(a[2]), float(b[2]))
    iy1 = min(float(a[3]), float(b[3]))
    iw = max(0.0, ix1 - ix0)
    ih = max(0.0, iy1 - iy0)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    area_a = max(0.0, float(a[2]) - float(a[0])) * max(0.0, float(a[3]) - float(a[1]))
    area_b = max(0.0, float(b[2]) - float(b[0])) * max(0.0, float(b[3]) - float(b[1]))
    union = area_a + area_b - inter
    return inter / union if union > 0.0 else 0.0


def match_page_boxes(
    pred_regions: list[dict[str, Any]],
    gt_regions: list[dict[str, Any]],
    iou_threshold: float,
) -> dict[str, Any]:
    """Greedy 1-to-1 matching between predicted and ground-truth boxes on a single page."""
    candidates: list[tuple[float, float, int, int]] = []
    for p_idx, pred in enumerate(pred_regions):
        p_box = pred["bbox"]
        p_conf = float(pred.get("confidence", 1.0))
        for g_idx, gt in enumerate(gt_regions):
            g_box = gt["bbox"]
            iou = bbox_iou(p_box, g_box)
            if iou >= iou_threshold:
                candidates.append((iou, p_conf, p_idx, g_idx))

    # Sort highest IoU first, breaking ties by confidence then index.
    candidates.sort(key=lambda t: (-t[0], -t[1], t[2], t[3]))
    matched_p: set[int] = set()
    matched_g: set[int] = set()
    matched_ious: list[float] = []

    for iou, _conf, p_idx, g_idx in candidates:
        if p_idx not in matched_p and g_idx not in matched_g:
            matched_p.add(p_idx)
            matched_g.add(g_idx)
            matched_ious.append(iou)

    tp = len(matched_p)
    detected = len(pred_regions)
    gt_count = len(gt_regions)
    fp = detected - tp
    fn = gt_count - tp
    precision = tp / detected if detected > 0 else (1.0 if gt_count == 0 else 0.0)
    recall = tp / gt_count if gt_count > 0 else 1.0
    f1 = (2.0 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    mean_iou = (sum(matched_ious) / len(matched_ious)) if matched_ious else 0.0

    return {
        "gt": gt_count,
        "detected": detected,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "mean_matched_iou": round(mean_iou, 4),
    }


def score_against_truth(
    detections_or_sidecar: dict[str, Any],
    truth_doc: dict[str, Any],
    iou_threshold: float = 0.5,
    min_confidence: float = 0.0,
) -> dict[str, Any]:
    """Score a `folio-formula-regions/v1` sidecar or `folio-formula-detections/v1` fixture against `truth.json`."""
    doc_id = str(truth_doc.get("doc_id") or detections_or_sidecar.get("doc_id") or "unknown")
    if detections_or_sidecar.get("$schema") != SCHEMA:
        sidecar = build_sidecar_from_detections(
            doc_id=doc_id,
            detections_doc=detections_or_sidecar,
            min_confidence=min_confidence,
        )
    else:
        sidecar = detections_or_sidecar

    if sidecar.get("pages") is None:
        raise ValueError(
            f"cannot score undetermined sidecar for {doc_id}: {sidecar.get('undetermined_reason')}"
        )

    pred_by_page: dict[int, list[dict[str, Any]]] = {}
    for p in sidecar.get("pages", []):
        regs = [
            r for r in p.get("regions", [])
            if float(r.get("confidence", 1.0)) >= min_confidence
        ]
        pred_by_page[int(p["page"])] = regs

    gt_by_page: dict[int, list[dict[str, Any]]] = {}
    truth_prov = truth_doc.get("provenance") if isinstance(truth_doc.get("provenance"), dict) else {}
    truth_dpi = float(truth_prov.get("dpi") or 256.0)
    for p in truth_doc.get("pages", []):
        page_num = int(p["page"])
        gt_regs: list[dict[str, Any]] = []
        for reg in p.get("regions", []):
            bbox = region_to_visible_pdf_bbox(reg, p, default_dpi=truth_dpi)
            if bbox is not None:
                gt_regs.append({"bbox": bbox})
        gt_by_page[page_num] = gt_regs

    all_pages = sorted(set(pred_by_page.keys()) | set(gt_by_page.keys()))

    def evaluate_at(thresh: float) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        per_page: list[dict[str, Any]] = []
        tot_gt = 0
        tot_det = 0
        tot_tp = 0
        weighted_iou_sum = 0.0
        for p_num in all_pages:
            res = match_page_boxes(
                pred_by_page.get(p_num, []),
                gt_by_page.get(p_num, []),
                iou_threshold=thresh,
            )
            tot_gt += res["gt"]
            tot_det += res["detected"]
            tot_tp += res["tp"]
            weighted_iou_sum += res["mean_matched_iou"] * res["tp"]
            per_page.append({"page": p_num, **res})

        tot_fp = tot_det - tot_tp
        tot_fn = tot_gt - tot_tp
        prec = tot_tp / tot_det if tot_det > 0 else (1.0 if tot_gt == 0 else 0.0)
        rec = tot_tp / tot_gt if tot_gt > 0 else 1.0
        f1 = (2.0 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        mean_iou = (weighted_iou_sum / tot_tp) if tot_tp > 0 else 0.0
        summary = {
            "iou_threshold": thresh,
            "pages": len(all_pages),
            "gt": tot_gt,
            "detected": tot_det,
            "tp": tot_tp,
            "fp": tot_fp,
            "fn": tot_fn,
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "mean_matched_iou": round(mean_iou, 4),
        }
        return summary, per_page

    primary_summary, per_page_primary = evaluate_at(iou_threshold)
    fine_summary, _ = evaluate_at(0.75)

    return {
        "$schema": SCORE_SCHEMA,
        "doc_id": doc_id,
        "detector": sidecar.get("detector", {}),
        "truth_provenance": truth_doc.get("provenance", {}),
        "iou_threshold": iou_threshold,
        "summary": primary_summary,
        "fine_iou_075": fine_summary,
        "pages": per_page_primary,
    }


def summarise(sidecar: dict[str, Any]) -> str:
    pages = sidecar.get("pages")
    status = sidecar.get("status", "undetermined" if pages is None else "determined")
    if pages is None:
        return f"{status.upper()} — {sidecar.get('undetermined_reason', 'no reason given')}"
    total_regions = sum(len(p.get("regions", [])) for p in pages)
    pages_with_math = sum(1 for p in pages if p.get("regions"))
    return (
        f"{len(pages)} page(s) inspected, {total_regions} formula region(s) across "
        f"{pages_with_math} page(s) (advisory)"
    )


def run_score_cli(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        prog="pdf-formula-regions.py score",
        description="Score formula-region detections against ground-truth boxes",
    )
    ap.add_argument(
        "--detections",
        type=Path,
        required=True,
        help="path to formula-regions.json or detections.json",
    )
    ap.add_argument(
        "--truth",
        type=Path,
        required=True,
        help="path to ground-truth truth.json",
    )
    ap.add_argument(
        "--iou",
        type=float,
        default=0.5,
        help="IoU threshold for a true positive match (default: 0.5)",
    )
    ap.add_argument(
        "--min-confidence",
        type=float,
        default=0.0,
        help="optional confidence filter applied before scoring",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="optional path to write benchmark JSON report (guarded against declared graph paths)",
    )
    ap.add_argument("--json", action="store_true", help="emit JSON report to stdout")
    args = ap.parse_args(argv)

    det_doc = json.loads(args.detections.read_text(encoding="utf-8"))
    truth_doc = json.loads(args.truth.read_text(encoding="utf-8"))
    report = score_against_truth(
        detections_or_sidecar=det_doc,
        truth_doc=truth_doc,
        iou_threshold=args.iou,
        min_confidence=args.min_confidence,
    )

    if args.output is not None:
        assert_not_declared_graph_path(str(args.output), os.getcwd())
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    s = report["summary"]
    line = (
        f"{report['doc_id']} (IoU>={s['iou_threshold']}): "
        f"gt={s['gt']} det={s['detected']} tp={s['tp']} "
        f"P={s['precision']:.4f} R={s['recall']:.4f} F1={s['f1']:.4f}"
    )
    print(line, file=sys.stderr if args.json else sys.stdout)
    if args.json:
        print(json.dumps(report, indent=2))
    return 0


def run_emit_cli(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        prog="pdf-formula-regions.py",
        description=__doc__.split("\n")[0],
    )
    ap.add_argument("pdf", type=Path, nargs="?", default=None, help="optional PDF path")
    ap.add_argument(
        "--entry",
        type=Path,
        default=None,
        help="target library/<slug> entry directory (overrides -o/<doc-id>)",
    )
    ap.add_argument(
        "-o",
        "--out",
        type=Path,
        default=Path("library"),
        help="library root when --entry is not given; writes <out>/<doc-id>/formula-regions.json",
    )
    ap.add_argument(
        "--detections",
        type=Path,
        default=None,
        help="recorded detector output JSON (folio-formula-detections/v1)",
    )
    ap.add_argument(
        "--doc-id",
        type=str,
        default=None,
        help="explicit document ID (defaults to entry dir name or derived from PDF)",
    )
    ap.add_argument(
        "--min-confidence",
        type=float,
        default=0.0,
        help="minimum confidence threshold (default: 0.0)",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="emit formula regions even when the entry already carries text_source: latex sections",
    )
    ap.add_argument("--dry-run", action="store_true", help="report without writing formula-regions.json")
    ap.add_argument("--json", action="store_true", help="emit the sidecar JSON to stdout")
    args = ap.parse_args(argv)

    if args.pdf is not None and not args.pdf.exists():
        print(f"{args.pdf}: no such file", file=sys.stderr)
        return 1

    if args.doc_id:
        doc_id = args.doc_id
    elif args.entry is not None:
        doc_id = args.entry.name
    elif args.pdf is not None:
        doc_id = _doc_id(str(args.pdf))
    elif args.detections is not None and args.detections.is_file():
        try:
            det_data = json.loads(args.detections.read_text(encoding="utf-8"))
            doc_id = str(det_data.get("doc_id") or "unknown")
        except Exception:  # noqa: BLE001
            doc_id = "unknown"
    else:
        print("must provide --entry, a PDF path, or --detections", file=sys.stderr)
        return 1

    entry_dir = args.entry if args.entry is not None else (args.out / doc_id)

    sidecar = extract_formula_regions(
        doc_id=doc_id,
        entry_dir=entry_dir,
        pdf_path=args.pdf,
        detections_path=args.detections,
        force=args.force,
        min_confidence=args.min_confidence,
    )

    label = args.pdf.name if args.pdf is not None else doc_id
    print(f"{label}: {summarise(sidecar)}", file=sys.stderr if args.json else sys.stdout)
    if args.json:
        print(json.dumps(sidecar, ensure_ascii=False))

    if args.dry_run:
        if sidecar.get("status") == "skipped":
            return 0
        return 0 if sidecar["pages"] is not None else 2

    target = entry_dir / SIDECAR_FILENAME
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  wrote {target}", file=sys.stderr if args.json else sys.stdout)

    if sidecar.get("status") == "skipped":
        return 0
    return 0 if sidecar["pages"] is not None else 2


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if args and args[0] == "score":
        return run_score_cli(args[1:])
    if args and args[0] == "emit":
        return run_emit_cli(args[1:])
    return run_emit_cli(args)


if __name__ == "__main__":
    sys.exit(main())
