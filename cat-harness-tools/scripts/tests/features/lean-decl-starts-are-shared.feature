# One answer to where a Lean declaration begins: lean-lexer's
# declarationStarts (bean bqrg). Each Scenario names the test that executes it.
Feature: Lean declaration starts come from one lexer

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::every_shape_the_two_patterns_disagreed_about_is_found::all_five,_in_source_order
  Scenario: All five divergent shapes are found in source order
    Given a theorem, an axiom, an unsafe def, an opaque and a dotted def
    When their declaration starts are read
    Then the names are alpha, choice_ax, beta, gamma and Ns.delta in order

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::every_shape_the_two_patterns_disagreed_about_is_found::%s_—_was_missed_by_DECL_RE,_absorbed_into_alpha's_body
  Scenario Outline: A shape the old pattern missed is found
    When the declaration starts of the sample are read
    Then they include <name>

    Examples:
      | shape               | name      |
      | axiom               | choice_ax |
      | opaque              | gamma     |
      | the unsafe modifier | beta      |

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::every_shape_the_two_patterns_disagreed_about_is_found::a_dotted_name_is_NOT_truncated_at_the_dot
  Scenario: A dotted name is not truncated at the dot
    When the declaration starts of the sample are read
    Then they include Ns.delta and not Ns

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::a_missed_keyword_is_ABSORBED,_which_is_why_the_gap_mattered::no_declaration's_body_contains_another_declaration
  Scenario: No declaration's body contains another declaration
    When the sample is split into declarations
    Then no body holds an axiom, opaque, theorem, unsafe def or def keyword

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::a_missed_keyword_is_ABSORBED,_which_is_why_the_gap_mattered::alpha's_body_is_its_own_and_nothing_else
  Scenario: alpha's body is its own
    When the sample is split into declarations
    Then alpha's body is ":= by trivial"

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::a_missed_keyword_is_ABSORBED,_which_is_why_the_gap_mattered::a_body-less_declaration_reports_bodyAt_-1,_which_the_probe_checks
  Scenario: A body-less axiom reports bodyAt -1
    When the sample is split into declarations
    Then the axiom's body is empty and its bodyAt is -1

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::there_is_exactly_one_declaration_pattern::the_scan_found_files_—_otherwise_nothing_below_proves_anything
  Scenario: The scan of this layer's modules found files
    When this layer's non-test .ts files outside node_modules are listed
    Then there are more than 200

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::there_is_exactly_one_declaration_pattern::no_module_outside_the_canonical_one_carries_a_local_pattern_any_more
  Scenario: No module but the canonical lexer carries a local declaration pattern
    When the files whose code lines hold a theorem|lemma|def alternation are found
    Then none of them is other than pipeline/lean-lexer.ts

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::there_is_exactly_one_declaration_pattern::no_other_module_here_carries_its_own,_and_the_list_may_only_shrink
  Scenario: Only the canonical lexer carries a declaration pattern
    When the files whose code lines hold a theorem|lemma|def alternation are found
    Then they are exactly pipeline/lean-lexer.ts

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::there_is_exactly_one_declaration_pattern::...and_it_is_used_from_outside,_so_the_rule_is_not_vacuous
  Scenario: The canonical declarationStarts is used from outside its module
    When the non-test modules other than lean-lexer.ts that mention declarationStarts are found
    Then there is at least one

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::the_corpus_this_was_swept_against_is_not_in_this_repository::no_`.lean`_file_is_tracked_here
  Scenario: No .lean file is in this repository
    When the repository root is scanned for .lean files outside node_modules
    Then there are none

  @test:scripts/tests/lean-decl-starts-are-shared.test.ts::the_corpus_this_was_swept_against_is_not_in_this_repository::so_the_sweep's_results_are_recorded_rather_than_re-run_in_CI
  Scenario: The sweep's results are recorded in the lexer
    When the canonical lexer's source is read
    Then it records the 52,144 declarations and 3,971 files of the sweep
