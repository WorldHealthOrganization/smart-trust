# scripts/formula-benchmark.py scores a library entry's text layer against its arXiv LaTeX source, formula by formula,
# section by section, and reads judge verdicts as data for the pairs the string stages miss.
# Each Scenario names the test that executes it.
Feature: The formula benchmark scores a text layer against its LaTeX source

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::a_text_layer_is_scored_formula_by_formula:_exact,_fuzzy_and_missed
  Scenario: A text layer is scored formula by formula as exact, fuzzy or missed
    Given an entry whose "Introduction" text holds three formulas as a text layer prints them
    And a LaTeX source whose "Introduction" holds the same three formulas
    When the benchmark runs
    Then it exits 0
    And the section's result is "scored" with 3 formulas
    And the first two matches are "exact" and the third is not
    And the section's exact recall is about 2/3
    And the report counts 3 formulas

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::the_threshold_decides_fuzzy_against_missed
  Scenario: The threshold decides a fuzzy match against a miss
    Given an entry whose text "x2 + y2 = z3" differs slightly from the source formula "x^2+y^2=z^2"
    When the benchmark runs with threshold 0.2
    Then the match stage is "fuzzy"
    And with threshold 0.05 the match stage is "missed"

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::an_overlaid_section_is_not_scored_against_itself
  Scenario: An overlaid section is not scored against itself
    Given an entry section whose front matter says "text_source: latex"
    When the benchmark runs
    Then the section's result starts with "overlaid"
    And the report counts 0 formulas
    And the recall is null

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::sections_are_paired_by_title,_never_by_position
  Scenario: Sections are paired by title, never by position
    Given an entry section "Rational maps" and a source section "Something else entirely"
    When the benchmark runs
    Then the section's result is "no matching \section"
    And the report counts 0 formulas

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::an_entry_with_no_source_is_skipped_with_a_reason,_not_scored_zero
  Scenario: An entry with no source is skipped with a reason, not scored zero
    Given an entry and no "--source" argument
    When the benchmark runs
    Then it exits 0
    And the entry's status is "skipped"
    And its reason mentions "arxiv-source.py"
    And it has no recall

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark::the_report_is_refused_inside_a_graph_directory
  Scenario: The benchmark refuses to write its report inside a graph directory
    When the benchmark runs with "--json library/formula.json"
    Then it exits non-zero
    And stderr says "declared graph directory"

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark_stage_3_—_judge_verdicts_read_as_data_(#130)::the_queue_holds_only_the_pairs_the_string_stages_did_not_find
  Scenario: The judge queue holds only the pairs the string stages did not find
    Given a text "a/b" for the source formula "\frac{a}{b}" and an exact "x+y"
    When the benchmark writes a judge queue
    Then the queue's schema is "formula-judge-queue/v1"
    And it holds only the formula "\frac{a}{b}"
    And that pair's text_sha256 is a 64-character hex digest

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark_stage_3_—_judge_verdicts_read_as_data_(#130)::a_current_verdict_is_reported_beside_the_string_recall,_uncalibrated_by_default
  Scenario: A current judge verdict is reported beside the string recall, uncalibrated by default
    Given the queued "\frac{a}{b}" pair has an "equivalent" verdict by an agent naming its model
    When the benchmark runs
    Then it exits 0
    And the string recall is about 0.5
    And the judge reports 1 judged, judged recall 1 and combined recall 1
    And the judge is not calibrated
    And stderr says "UNCALIBRATED"
    And a new judge queue is empty

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark_stage_3_—_judge_verdicts_read_as_data_(#130)::a_verdict_on_text_that_has_since_changed_is_stale_and_never_used
  Scenario: A verdict on text that has since changed is stale and never used
    Given the queued pair has an "equivalent" verdict recorded against a different text hash
    When the benchmark runs
    Then the judge reports 1 stale and 0 judged
    And the combined recall stays about 0.5

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark_stage_3_—_judge_verdicts_read_as_data_(#130)::a_verdict_must_name_its_model
  Scenario: A judge verdict must name its model
    Given the queued pair has a verdict whose agent names no model
    When the benchmark runs
    Then it exits non-zero
    And stderr says "must name the model"

  @test:scripts/tests/formula-benchmark.test.ts::formula-benchmark_stage_3_—_judge_verdicts_read_as_data_(#130)::a_held_set_scores_the_judge_against_ground_truth
  Scenario: A held set scores the judge against ground truth
    Given a held set of four pairs where the judge is right on two and wrong on two
    When the benchmark runs with "--held-set"
    Then the judge is calibrated
    And its agreement, precision and recall are each 0.5
