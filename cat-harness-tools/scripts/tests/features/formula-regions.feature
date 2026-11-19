# scripts/pdf-formula-regions.py is the advisory formula-region arm: it turns recorded ScanSSD detections into a
# formula-regions.json sidecar beside a library entry, and scores detections against ground-truth boxes.
# Each Scenario names the test that executes it.
Feature: Advisory formula regions from recorded detections

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::formula-regions.json_is_registered_in_ENTRY_SIDECARS_as_an_advisory_sidecar
  Scenario: formula-regions.json is a registered entry sidecar
    Then ENTRY_SIDECARS in scripts/check-l1-complete.ts contains "formula-regions.json"

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::reads_recorded_ScanSSD_detections_and_emits_an_advisory_sidecar_in_visible-frame_PDF_coordinates_without_touching_sections/
  Scenario: Recorded ScanSSD detections become an advisory sidecar in PDF points without touching sections
    Given a library entry "emden76" with a pdftotext section "01-page-001.md"
    When the script runs on it with the committed Emden76 detections
    Then it exits 0
    And the section file is byte-for-byte unchanged
    And a "formula-regions.json" sidecar is written with schema "folio-formula-regions/v1", doc_id "emden76", status "determined" and advisory true
    And the detector is "ScanSSD-XYc" with weights file "ssd512GTDB_256_epoch15.pth"
    And it holds 10 pages, each unrotated and 450 by 684 pt
    And every region has only a bbox and a confidence
    And every bbox is well-formed and lies within the 450 by 684 pt page
    And every confidence is between 0.5 and 1.0
    And the regions of a page are ordered top to bottom, then left to right
    And there are 447 regions in all

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::benchmark_scores_committed_ScanSSD_detections_against_TFD-ICDAR2019v2_Emden76_ground-truth_boxes
  Scenario: The benchmark scores the committed ScanSSD detections against the Emden76 ground truth
    Given the committed Emden76 detections and truth fixtures exist
    When the score command writes its report
    Then it exits 0
    And the report's schema is "folio-formula-region-benchmark/v1" with doc_id "tfd-icdar2019v2-emden76"
    And it records the detector weights and source PDF SHA-256 digests
    And at IoU 0.5 it scores 589 ground-truth boxes, 447 detected, 351 TP, 96 FP, 238 FN, precision 0.7852, recall 0.5959, F1 0.6776
    And at IoU 0.75 it scores 278 TP, 169 FP, 311 FN, precision 0.6219, recall 0.472, F1 0.5367

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::transforms_unrotated_PDF_boxes_into_the_visible_rotated_frame_(matching_vector-labels.json)
  Scenario: An unrotated PDF box is transformed into the visible rotated frame
    Given detections for a 595 by 842 pt page rotated 90 degrees with a box [100, 200, 150, 240] in the unrotated frame
    When the script runs on the entry
    Then it exits 0
    And the sidecar page's rotation is 90
    And the box is [602, 100, 642, 150]

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::records_status:_undetermined_and_pages:_null_(never_an_empty_list)_when_no_detector_output_is_available
  Scenario: With no detector output the sidecar records undetermined and null pages
    Given a library entry and no detections
    When the script runs on it
    Then it exits 2
    And the sidecar's status is "undetermined" and its pages are null
    And its undetermined reason says it is "NOT 'the document contains no formulas'"

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::skips_born-digital_entries_whose_sections_already_carry_text_source:_latex_unless_--force_is_passed
  Scenario: A born-digital entry already overlaid from LaTeX is skipped unless forced
    Given a library entry whose section carries "text_source: latex"
    When the script runs on it with the Emden76 detections
    Then it exits 0
    And the sidecar's status is "skipped", its pages are null and its reason mentions "text_source: latex"
    And with "--force" it exits 0 and the sidecar is "determined" with 10 pages

  @test:scripts/tests/formula-regions.test.ts::pdf-formula-regions.py_(cat-harness-tools#131,_bean_f0hv)::score_refuses_to_write_its_benchmark_report_into_a_declared_graph_path
  Scenario: score refuses to write its report into a declared graph path
    Given a directory with an instance.config.json declaring a content graph
    When score is asked to write its report to "library/report.json"
    Then it exits non-zero
    And stderr says "declared graph directory"
