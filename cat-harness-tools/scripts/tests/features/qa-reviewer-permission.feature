# check:qa-reviewer-permission: a QA verdict's reviewer is permitted,
# forbidden or unresolved, never two of those collapsed into one. The fixture
# declares actor "qc-reviewer" holding qa-reporting and "author" holding
# content-authoring. Each Scenario names the test that executes it.
Feature: A QA verdict is written only by an actor permitted to report it

  @test:scripts/tests/qa-reviewer-permission.test.ts::reviewerOutcome_—_three_states,_never_two::an_actor_holding_the_permission_is_permitted
  Scenario: An actor holding qa-reporting is permitted
    Then a reviewer whose actor is "qc-reviewer" is "permitted"

  @test:scripts/tests/qa-reviewer-permission.test.ts::reviewerOutcome_—_three_states,_never_two::an_actor_WITHOUT_it_is_forbidden_—_the_producer_writing_its_own_verdict
  Scenario: An actor without qa-reporting is forbidden
    Then a reviewer whose actor is "author" is "forbidden"

  @test:scripts/tests/qa-reviewer-permission.test.ts::reviewerOutcome_—_three_states,_never_two::no_actor_named_is_UNRESOLVED,_not_permitted
  Scenario: No actor named is unresolved
    Then a script reviewer naming no actor is "unresolved"

  @test:scripts/tests/qa-reviewer-permission.test.ts::reviewerOutcome_—_three_states,_never_two::an_actor_naming_nothing_declared_is_UNRESOLVED,_not_forbidden
  Scenario: An actor naming nothing declared is unresolved
    Then a reviewer whose actor is "qc-reviewr" is "unresolved"

  @test:scripts/tests/qa-reviewer-permission.test.ts::reviewerOutcome_—_three_states,_never_two::a_missing_reviewer_is_unresolved
  Scenario: A missing reviewer is unresolved
    Then an absent reviewer is "unresolved"

  @test:scripts/tests/qa-reviewer-permission.test.ts::scan::a_permitted_entry_produces_no_finding;_forbidden_and_unresolved_both_do
  Scenario: Permitted entries are not findings; forbidden and unresolved are
    Given a sidecar with a permitted, a forbidden and an unresolved entry
    When the results are scanned
    Then the findings' outcomes are "forbidden" and "unresolved"

  @test:scripts/tests/qa-reviewer-permission.test.ts::scan::a_could-not-dispatch_record_is_exempt_—_the_owner's_ruling,_structurally_identified
  Scenario: A could-not-dispatch record is exempt
    Given a could-not-dispatch entry whose reviewer's actor is "author"
    When the results are scanned
    Then there are no findings

  @test:scripts/tests/qa-reviewer-permission.test.ts::scan::the_exemption_cannot_be_claimed_by_asserting_it
  Scenario: The could-not-dispatch exemption cannot be claimed by its words
    Given an n/a entry by "author" whose notes say "Could not dispatch: trust me" without the structural marker
    When the results are scanned
    Then the only finding is "forbidden"

  @test:scripts/tests/qa-reviewer-permission.test.ts::report_—_what_is_baselined_and_what_never_is::a_forbidden_outcome_is_NEVER_silenced_by_the_baseline
  Scenario: A forbidden outcome is never silenced by the baseline
    Given a forbidden finding whose key is in the baseline
    When the report is made
    Then it lists one forbidden finding

  @test:scripts/tests/qa-reviewer-permission.test.ts::report_—_what_is_baselined_and_what_never_is::a_baselined_unresolved_reviewer_is_not_novel
  Scenario: A baselined unresolved reviewer is not novel
    Given an unresolved finding whose key is in the baseline
    When the report is made
    Then nothing is novel

  @test:scripts/tests/qa-reviewer-permission.test.ts::report_—_what_is_baselined_and_what_never_is::a_NEW_unresolved_reviewer_is_novel_—_the_backlog_cannot_grow_quietly
  Scenario: A new unresolved reviewer is novel
    Given an unresolved finding and an empty baseline
    When the report is made
    Then one finding is novel

  @test:scripts/tests/qa-reviewer-permission.test.ts::report_—_what_is_baselined_and_what_never_is::an_entry_that_stops_matching_is_reported_stale_—_the_file_can_only_shrink
  Scenario: A baseline entry that stops matching is stale
    Given no findings and a baseline holding "unresolved:gone.ts"
    When the report is made
    Then "unresolved:gone.ts" is reported stale

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_checker/adjudicator_split_enforces_itself::the_adjudicator_may_rule;_the_checker_may_not
  Scenario: The adjudicator may rule and the checker may not
    Given the shipped actor declarations
    Then actor "untainted-adjudicator" is "permitted"
    And actor "untainted-checker" is "forbidden"

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_checker/adjudicator_split_enforces_itself::NEITHER_holds_content-authoring_—_the_producer_never_writes_the_verdict
  Scenario: Neither untainted actor holds content-authoring
    Then neither "untainted-adjudicator" nor "untainted-checker" holds "content-authoring"

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_checker/adjudicator_split_enforces_itself::a_checker's_`n/a`_witness_is_exempt_—_the_honest_half_must_not_fail_the_gate
  Scenario: A checker's n/a witness is exempt
    Given a sidecar with an n/a entry marked role "checker" by "untainted-checker"
    When the results are scanned with the fixture's actors
    Then there are no findings

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_checker/adjudicator_split_enforces_itself::a_checker_emitting_a_REAL_verdict_is_forbidden_—_the_defect_worth_catching
  Scenario: A checker emitting a real verdict is caught
    # Gap: the scan of the checker's "pass" reports "unresolved", not "forbidden", because the fixture's actors lack untainted-checker; "forbidden" is asserted only for reviewerOutcome against the shipped declarations, never for a scanned verdict.
    Given a sidecar with a "pass" entry marked role "checker" by "untainted-checker"
    Then against the shipped declarations actor "untainted-checker" is "forbidden"
    And scanning the sidecar with the fixture's actors reports one "unresolved" finding

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_checker/adjudicator_split_enforces_itself::the_exemption_cannot_be_claimed_without_the_structural_marker
  Scenario: The checker exemption needs the structural marker
    Given an n/a entry by "author" whose notes claim to be a checker witness, with no role marker
    When the results are scanned
    Then the only finding is "forbidden"

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_population_travels_with_the_verdict_(bean_`c8uq`)::an_ABSENT_results_tree_examines_nothing,_and_says_it_was_absent
  Scenario: An absent results tree examines nothing and says so
    When a results directory that does not exist is scanned with counts
    Then there are no findings, 0 examined, and present is false

  @test:scripts/tests/qa-reviewer-permission.test.ts::the_population_travels_with_the_verdict_(bean_`c8uq`)::permitted_entries_are_counted_as_examined,_though_they_are_not_findings
  Scenario: Permitted entries are counted as examined
    Given a sidecar with a permitted entry and an unresolved script entry
    When the results are scanned with counts
    Then present is true, 2 are examined, and the only finding is "unresolved"

  @test:scripts/tests/qa-reviewer-permission.test.ts::absentCorpusIsNotOurs_—_whose_derived_corpus_is_absent::a_content_root_with_the_tree_absent:_not_ours,_not_applicable
  Scenario: An absent corpus in a content root is not ours
    Given a root with no gates workflow and the results tree absent
    Then the absent corpus is not ours

  @test:scripts/tests/qa-reviewer-permission.test.ts::absentCorpusIsNotOurs_—_whose_derived_corpus_is_absent::a_harness_root_with_the_tree_absent:_ours,_still_could_not_determine
  Scenario: An absent corpus in a harness root is ours
    Given a root holding .github/workflows/code-quality-gates.yml and the results tree absent
    Then the absent corpus is ours

  @test:scripts/tests/qa-reviewer-permission.test.ts::absentCorpusIsNotOurs_—_whose_derived_corpus_is_absent::a_present_tree_is_judged_in_either_root
  Scenario: A present tree is judged in either root
    Given the results tree present
    Then it is ours in a content root and in a harness root

  @test:scripts/tests/qa-reviewer-permission.test.ts::absentCorpusIsNotOurs_—_whose_derived_corpus_is_absent::the_reason_says_what_was_and_was_not_examined
  Scenario: The not-owned reason says what was and was not examined
    When the reason is made for "cat-harness/test/results" with 3 baselined ids and 8 attested entries
    Then it says the tree "is absent and this is a content root"
    And "3 baselined reviewer id(s) were not evaluated and none is stale"
    And "8 attested entr(y/ies) were examined and none is forbidden"
