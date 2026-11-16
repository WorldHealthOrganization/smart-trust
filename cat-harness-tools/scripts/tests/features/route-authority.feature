# Which copy a route-keyed --check compares against, on real git repositories:
# the checkout, both copies during cutover, the branch after the flip, or
# unknown. Each Scenario names the test that executes it.
Feature: Route authority for generated pages

  @test:scripts/tests/route-authority.test.ts::with_no_`storage`,_the_verdict_is_the_on-disk_comparison_it_replaces::file_for_file,_over_the_REAL_repository's_uml_pages
  Scenario: With no storage the verdict equals the direct on-disk comparison
    Given the built uml overview pages of the real repository, more than 50 of them
    When the route is compared against those same pages
    Then the authority is "checkout", the state "current" and nothing is stale
    And the stale list equals a direct file-by-file comparison with disk

  @test:scripts/tests/route-authority.test.ts::with_no_`storage`,_the_verdict_is_the_on-disk_comparison_it_replaces::...and_one_changed_byte_makes_it_stale,_naming_that_path_only
  Scenario: One changed page makes the route stale, naming only that page
    Given a checkout with no storage declared holding a.md and b.md
    When the route is compared with a.md changed
    Then the authority is "checkout", the state "stale" and only a.md is stale

  @test:scripts/tests/route-authority.test.ts::`both`_—_the_cutover_window,_which_nothing_on_main_compares::authority_is_`both`_while_the_manifest_says_authoritative:_false
  Scenario: Authority is both while the branch manifest is not authoritative
    Given a storage branch whose manifest says authoritative false
    Then the directory's authority is "both"

  @test:scripts/tests/route-authority.test.ts::`both`_—_the_cutover_window,_which_nothing_on_main_compares::the_checkout_decides_staleness,_and_a_disagreement_between_the_copies_is_REPORTED
  Scenario: During cutover the checkout decides and drift is reported
    Given a non-authoritative branch holding an old a.md and a checkout holding the current one
    When the route is compared with the current output
    Then the authority is "both" and the state "current"
    And a.md is reported as drift

  @test:scripts/tests/route-authority.test.ts::`both`_—_the_cutover_window,_which_nothing_on_main_compares::...and_no_drift_is_reported_when_the_two_copies_agree
  Scenario: No drift when both copies agree
    Given a non-authoritative branch and a checkout holding the same a.md
    When the route is compared
    Then no drift is reported

  @test:scripts/tests/route-authority.test.ts::`branch`_—_after_the_flip::a_page_stale_ON_THE_BRANCH_is_stale_even_when_the_checkout_agrees
  Scenario: After the flip a page stale on the branch is stale
    Given an authoritative branch holding an old a.md and a checkout matching the output
    When the route is compared
    Then the authority is "branch", the state "stale" and a.md is stale

  @test:scripts/tests/route-authority.test.ts::`branch`_—_after_the_flip::current_when_the_branch_holds_exactly_the_generator's_output
  Scenario: After the flip the branch alone decides current
    Given an authoritative branch holding the generator's exact output and a checkout that differs
    When the route is compared
    Then the state is "current"

  @test:scripts/tests/route-authority.test.ts::`unknown`_is_neither_stale_nor_a_pass::a_declared_branch_that_does_not_exist
  Scenario: A declared branch that does not exist is unknown
    Given storage declared on a branch that was never pushed
    When the route is compared
    Then the state is "unknown", not "current", with a reason

  @test:scripts/tests/route-authority.test.ts::`unknown`_is_neither_stale_nor_a_pass::a_manifest_claiming_the_WRONG_keying_is_corrupt,_not_current
  Scenario: A manifest with the wrong keying is unknown
    Given an authoritative branch whose manifest says it is keyed by tip
    When the route is compared
    Then the state is "unknown" and the reason says "keyed by tip"
