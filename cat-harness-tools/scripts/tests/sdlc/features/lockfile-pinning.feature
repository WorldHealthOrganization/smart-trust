# scripts/check-lockfile-pinning.ts scans workflow files for bun installs that are unpinned
# or whose --frozen-lockfile pin falls back to an unpinned install, and scopes its baseline to one root.
# Each Scenario names the test that executes it.
Feature: Lockfile pinning gate

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::a_pin_that_falls_back_is_not_a_pin::the_bare_fallback_is_caught
  Scenario: A frozen-lockfile install with a bare fallback is caught
    Given a workflow step "bun install --frozen-lockfile || bun install"
    When the workflows are scanned
    Then there is one finding
    And its reason says it "swallows the failure the pin exists to raise"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::a_pin_that_falls_back_is_not_a_pin::silencing_stderr_does_not_hide_it_from_the_gate
  Scenario: Silencing stderr does not hide a fallback from the gate
    Given a workflow step "bun install --frozen-lockfile 2>/dev/null || bun install"
    When the workflows are scanned
    Then there is one finding

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::a_pin_that_falls_back_is_not_a_pin::a_pin_with_no_fallback_is_clean
  Scenario: A pin with no fallback is clean
    Given a workflow step "bun install --frozen-lockfile"
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::a_pin_that_falls_back_is_not_a_pin::a_degrading_pin_is_reported_as_`degrading`,_which_is_never_baselined
  Scenario: A pin that falls back is reported as degrading
    # Gap: that a degrading finding is never baselined is not checked
    Given a workflow step "bun install --frozen-lockfile || bun install"
    When the workflows are scanned
    Then the finding's kind is "degrading"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::`cd_X_&&_A_||_B`_runs_B_in_the_wrong_directory::it_is_caught_even_when_the_pin_itself_looks_fine
  Scenario: A cd-then-pin with a fallback is caught even when the pin looks fine
    Given a workflow step "cd content && bun install --frozen-lockfile 2>/dev/null || bun install"
    When the workflows are scanned
    Then there is one finding

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::`cd_X_&&_A_||_B`_runs_B_in_the_wrong_directory::a_cd_with_no_fallback_is_clean_—_the_failure_propagates,_which_is_correct
  Scenario: A cd with no fallback is clean
    Given a workflow step "cd content && bun install --frozen-lockfile"
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::`cd_X_&&_A_||_B`_runs_B_in_the_wrong_directory::an_install_with_NO_pin_at_all_is_reported_—_the_row_the_first_denominator_hid
  Scenario: An install with no pin at all is reported as unpinned
    Given a workflow step "cd $PKG_DIR && bun install"
    When the workflows are scanned
    Then there is one finding
    And its kind is "unpinned"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::`cd_X_&&_A_||_B`_runs_B_in_the_wrong_directory::the_guarded_form_this_repo_now_uses_carries_no_DEGRADING_finding
  Scenario: The guarded install form carries no degrading finding
    Given a workflow step that checks for content/ and content/bun.lock, installs pinned when the lockfile exists and unpinned with a warning otherwise
    When the workflows are scanned
    Then the only finding is one of kind "unpinned"
    And its text is "(cd content && bun install)"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::the_three_states_the_guard_keeps_apart::no_folio,_pinned,_and_no-lockfile_are_each_reachable_and_distinct
  Scenario: The guard can say no folio, pinned and no lockfile as distinct states
    # Gap: the shell is not run; the three branches are checked only as text in the script
    Given the guarded install script
    Then it contains a "::notice::" line, a "::warning::" line and "--frozen-lockfile"
    And every finding a scan of it yields is of kind "unpinned"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::the_baseline_judges_only_the_root_it_was_recorded_in::in_the_root_it_names,_its_entries_apply
  Scenario: In the root a baseline names, its entries apply
    Given a baseline for root "folio-assistant" knowing "repin-train.yml: bun install"
    When the known entries for "folio-assistant" are taken
    Then they are "repin-train.yml: bun install"

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::the_baseline_judges_only_the_root_it_was_recorded_in::in_any_other_root,_none_of_them_do_—_so_none_can_read_as_stale
  Scenario: In any other root, none of a baseline's entries apply
    Given a baseline for root "folio-assistant" knowing "repin-train.yml: bun install"
    When the known entries for "smart-ra" are taken
    Then there are none

  @test:scripts/tests/sdlc/lockfile-pinning.test.ts::the_baseline_judges_only_the_root_it_was_recorded_in::a_baseline_naming_no_root_still_judges_every_root
  Scenario: A baseline naming no root still judges every root
    Given a baseline with no root knowing "x.yml: bun install"
    When the known entries for "smart-ra" are taken
    Then they are "x.yml: bun install"
