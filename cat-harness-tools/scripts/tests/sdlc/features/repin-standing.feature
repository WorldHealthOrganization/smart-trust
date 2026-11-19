# scripts/repin-standing.ts moves remote-mount pins under a standing consent rule: commit verdicts,
# green-commit selection behind a stubbed GitHub API, cascade alignment to a harness's own lock, and
# the index.config.json and lock rewrite over file:// fixture repositories. Each Scenario names the test that executes it.
Feature: Standing-consent re-pin

  @test:scripts/tests/sdlc/repin-standing.test.ts::verdictOf:_green_only_when_something_checked_the_commit_and_all_of_it_passed::nothing_reported_is_`none`,_never_green
  Scenario: A commit with nothing reported is "none", never green
    Given a combined status of "pending" with 0 statuses and no check runs
    When the verdict is read, it is "none"
    And with no combined status and no check runs it is also "none"

  @test:scripts/tests/sdlc/repin-standing.test.ts::verdictOf:_green_only_when_something_checked_the_commit_and_all_of_it_passed::statuses_and_check_runs_both_count
  Scenario: Statuses and check runs both count towards the verdict
    Given a successful status and a successful check run, the verdict is "green"
    And with no statuses, a skipped and a successful check run give "green"
    And an in-progress check run gives "pending", as does a pending status with no check runs
    And a failed check run gives "red", as does a failed status with a successful check run
    And a cancelled check run gives "red"

  @test:scripts/tests/sdlc/repin-standing.test.ts::candidateFor:_the_followed_branch's_newest_(green)_commit,_through_the_stub::require_green:_passes_over_newer_pending_and_red_commits_to_the_newest_green
  Scenario: Requiring green passes over newer pending and red commits to the newest green
    Given branch main of "o/x" with commits D pending, C red, B green and A green, newest first
    When the candidate is chosen under a rule requiring green
    Then the candidate is B on "main" with verdict "green"
    And the verdicts looked at are pending, red, green
    And no verdict is asked for A

  @test:scripts/tests/sdlc/repin-standing.test.ts::candidateFor:_the_followed_branch's_newest_(green)_commit,_through_the_stub::require_green_and_nothing_green_within_depth:_no_candidate
  Scenario: Requiring green with nothing green within the depth gives no candidate
    Given commits D pending, C none and B green
    When the candidate is chosen with a depth of 2
    Then there is no candidate

  @test:scripts/tests/sdlc/repin-standing.test.ts::candidateFor:_the_followed_branch's_newest_(green)_commit,_through_the_stub::no_require:_the_branch_head,_with_no_verdict_asked
  Scenario: With no requirement the candidate is the branch head and no verdict is asked
    Given branch dev of "o/x" with commits D and C
    When the candidate is chosen under a rule following "dev" with no requirement
    Then the candidate is D on "dev" with no verdict
    And no verdict call was made

  @test:scripts/tests/sdlc/repin-standing.test.ts::planRepin:_the_coverage_decision,_per_instance::a_standing_rule_moves_its_pin;_an_instance_with_no_rule_is_never_touched_or_even_asked_about
  Scenario: A standing rule moves its pin, and an instance with no rule is never asked about
    Given mount x at A with a standing rule and mount y at A with none, and C green at the head of x's main
    When the re-pin is planned
    Then the only move is x from A to C
    And nothing is held
    And no API call names "o/y"

  @test:scripts/tests/sdlc/repin-standing.test.ts::planRepin:_the_coverage_decision,_per_instance::already_at_the_newest_green:_held,_not_moved
  Scenario: An instance already at the newest green is held, not moved
    Given mount x pinned at C, with D red and C green on main
    When the re-pin is planned
    Then there are no moves
    And x is held with a reason containing "already pinned"

  @test:scripts/tests/sdlc/repin-standing.test.ts::planRepin:_the_coverage_decision,_per_instance::nothing_green:_held_with_the_reason
  Scenario: Nothing green holds the instance with the reason
    Given mount x at A with only a pending commit D on main
    When the re-pin is planned
    Then there are no moves
    And x is held with a reason mentioning "green"

  @test:scripts/tests/sdlc/repin-standing.test.ts::planRepin:_the_coverage_decision,_per_instance::an_API_failure_is_could-not-determine,_never_'nothing_to_move'
  Scenario: An API failure is could-not-determine, never nothing to move
    Given mount x following a branch "gone" that the API cannot list
    When the re-pin is planned
    Then x is listed as unknown
    And the summary contains "Could not determine"

  @test:scripts/tests/sdlc/repin-standing.test.ts::planRepin:_the_coverage_decision,_per_instance::the_summary_names_who_consented,_under_which_rule
  Scenario: The summary names who consented, under which rule
    Given mount x moved to a green head C under a rule consented by "litlfred" on 2026-10-16
    When the summary is written
    Then it contains the row "| x | o/x |"
    And it contains "litlfred (standing, 2026-10-16)"

  @test:scripts/tests/sdlc/repin-standing.test.ts::applyRepin:_index.config.json_and_index.lock.json_move_through_the_mount:remote_write_paths::the_covered_pin_moves_with_a_consent_by_the_rule's_person;_the_other_entry_is_untouched;_the_lock_follows
  Scenario: The covered pin moves with a consent by the rule's person, the other entry is untouched, and the lock follows
    Given a site mounting "up" at its first commit under a standing rule by "test", and "other" with no rule, both mounted from file:// fixtures
    When the re-pin is planned with both up commits green and applied on 2026-10-17
    Then the only move is up to its second commit, and the apply exits 0 with mount state "mounted"
    And up's config entry has the new ref, the same overrides, a consent by "test" on 2026-10-17 for the new ref carrying the standing rule, and the standing rule unchanged
    And the "other" entry is exactly as before
    And the lock pins up to the new commit, with trust basis "consent" by "test", approver "declared" and the standing rule
    And the mounted "up/v.txt" reads "2"
    And the remote check reports "mounted"

  @test:scripts/tests/sdlc/repin-standing.test.ts::applyRepin:_index.config.json_and_index.lock.json_move_through_the_mount:remote_write_paths::withdrawing_the_rule_afterwards_makes_the_check_refuse_the_pin_it_moved_(it_asks_again)
  Scenario: Withdrawing the rule afterwards makes the check refuse the pin it moved
    Given a site whose up pin was moved under its standing rule
    When the standing rule is deleted from up's config entry
    Then the remote check reports up as "refused"

  @test:scripts/tests/sdlc/repin-standing.test.ts::applyRepin:_index.config.json_and_index.lock.json_move_through_the_mount:remote_write_paths::dry_run:_nothing_moved_means_nothing_written
  Scenario: A dry run with nothing moved writes nothing
    Given a site
    When an empty plan is applied
    Then the result is exit 0
    And index.config.json is byte-for-byte unchanged

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins:_an_instance_below_the_harness_follows_the_harness's_own_lock_(cascade,_bean_pqlh)::the_lower_layer_moves_to_the_pin_the_harness's_NEW_commit_holds,_not_to_its_branch_head
  Scenario: A lower layer moves to the pin the harness's new commit holds, not to its branch head
    Given open rules on harness, base, base-tools and content, all at A, with base and base-tools below the harness
    And the harness's new commit B holds base at C, base-tools at A and content at B in its lock
    When the plan is aligned to the held pins
    Then harness moves to B, base to C, and content, which is not below the harness, to its head D
    And base's move is aligned to "harness@" and the first 10 characters of B
    And base-tools is held
    And the summary contains "held by harness@"

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins:_an_instance_below_the_harness_follows_the_harness's_own_lock_(cascade,_bean_pqlh)::a_held_pin_the_standing_rule_does_not_cover_is_held,_not_moved
  Scenario: A held pin the standing rule does not cover is held, not moved
    Given base below the harness under a rule requiring green, and the harness's lock holding base at a red commit C
    When the plan is aligned to the held pins
    Then only the harness moves
    And base is held with a reason containing "does not cover"

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins:_an_instance_below_the_harness_follows_the_harness's_own_lock_(cascade,_bean_pqlh)::an_unreadable_harness_lock_is_unknown,_never_a_silent_pass;_no_lock_reader_means_no_cascade
  Scenario: An unreadable harness lock is unknown, and with no lock reader there is no cascade
    Given a harness and a base below it, and a lock reader that fails with "HTTP 500"
    When the plan is aligned to the held pins
    Then the harness is listed as unknown
    And with an API that has no lock reader, base moves to its own head D

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins:_an_instance_below_the_harness_follows_the_harness's_own_lock_(cascade,_bean_pqlh)::lockPinsOf_reads_`mounts`_and_ignores_anything_else
  Scenario: lockPinsOf reads mounts and ignores anything else
    Given a lock with a valid mount, a mount with a non-string repository, and instances
    When its pins are read
    Then they are only "o/x" at A
    And a null lock gives no pins

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::in_the_checkout_only:_a_branch-kept_or_opt-in_directory_is_never_added
  Scenario: Only in-checkout directories count, so a branch-kept or opt-in directory is never added
    Given a new declaration with library, scenarios and tools, a branch-kept ast and cache, and an opt-in extra
    When its in-checkout directory ids are read, they are library, scenarios and tools
    And the newly declared ids relative to the old declaration are scenarios and tools
    And no declaration gives no ids

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::an_explicit_list_gains_the_new_ids,_less_those_it_already_names
  Scenario: An explicit directory list gains the new ids, less those it already names
    Given a move of up from A to B, and up's explicit list naming library and tools
    When the explicit directories are extended
    Then the move adds only "scenarios"
    And the summary contains "- up: `scenarios`"

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::no_explicit_list:_nothing_to_extend,_and_no_declaration_is_read
  Scenario: With no explicit list there is nothing to extend and no declaration is read
    Given a move of up with no explicit directory list
    When the explicit directories are extended
    Then the move adds no directories
    And the declaration reader was never called

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::a_declaration_it_cannot_read_withdraws_the_move_as_could-not-determine,_never_a_short_list
  Scenario: An unreadable declaration withdraws the move as could-not-determine, never a short list
    Given a move of up from A to B where only A's declaration can be read
    When the explicit directories are extended
    Then there are no moves
    And the unknown reason contains "cannot be told"
    And when the declaration reader fails with "HTTP 500", the unknown reason contains "HTTP 500"

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::a_declaration_below_the_root_is_read_where_the_site's_lock_says_it_sits_(smart-base/,_2026-11-13)
  Scenario: A declaration below the root is read where the site's lock says it sits
    Given up's declarations served only under "smart-base", and a lock placing up at "smart-base"
    When the explicit directories are extended
    Then both declarations are asked for under "smart-base"
    And nothing is unknown and the move adds "scenarios"
    And when no declaration is found there, the unknown reason contains "in `smart-base/` of o/up@"

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::upstreamRootsOf_reads_each_instance's_upstreamRoot_from_the_lock,_and_nothing_else
  Scenario: upstreamRootsOf reads each instance's upstreamRoot from the lock and nothing else
    Given a lock with instances rooted at "smart-base" and at "", one with no root, and a junk entry
    When the upstream roots are read
    Then they are "smart-base" for smart-base and "" for cat-harness
    And an absent lock, or one whose instances is not a list, gives none

  @test:scripts/tests/sdlc/repin-standing.test.ts::extendExplicitDirectories:_a_directory_the_new_pin_declares_joins_an_explicit_list_(folio-assistant#3023)::applyRepin_writes_the_added_ids_after_the_site's_own,_and_touches_no_other_entry
  Scenario: applyRepin writes the added ids after the site's own and touches no other entry
    Given a site where up's explicit list is "library"
    When a plan moving up to its second commit and adding "scenarios" and "tools" is applied without mounting
    Then up's ref is the second commit
    And its directories are library, scenarios, tools in that order
    And the "other" entry is unchanged

  @test:scripts/tests/sdlc/repin-standing.test.ts::movesSince_+_applyRepin({_seed:_false_}):_step_4a_after_the_pins_already_moved_(--extend-from)::only_instances_whose_ref_changed_AND_carry_a_standing_rule_are_moves
  Scenario: Only instances whose ref changed and that carry a standing rule are moves
    Given a previous config with up at A, still at B, norule at A and a local instance
    And current mounts up at B and still at B with rules, norule at C with no rule, and a new instance with a rule
    When the moves since are read
    Then the only move is up from A to B
    And with no previous config there are no moves

  @test:scripts/tests/sdlc/repin-standing.test.ts::movesSince_+_applyRepin({_seed:_false_}):_step_4a_after_the_pins_already_moved_(--extend-from)::seed:_false_writes_the_added_ids_and_leaves_the_pin_and_its_consent_exactly_as_they_are
  Scenario: With seed false the added ids are written and the pin and consent are left as they are
    Given a site where up's explicit list is "library"
    When a plan adding "scenarios" is applied with seed false and without mounting
    Then up's ref is still its first commit
    And its trust is exactly as before
    And its directories are library and scenarios

  @test:scripts/tests/sdlc/repin-standing.test.ts::cascadeOf:_a_site_whose_directories_name_kinds_this_job_does_not_mount_(standing_re-pin,_ig-ast)::reads_only_name_and_needs,_so_an_unregistered_kind_in_the_site's_declaration_does_not_stop_the_re-pin
  Scenario: The cascade reads only name and needs, so an unregistered kind does not stop the re-pin
    Given a site declaring a directory of an unregistered graph typology, needing ig-x, which needs harness-x, which needs floor-x
    When the site's declaration is read in full, it throws "unknown graph typology"
    And when the cascade is read from the harness directory, the harness is "harness-x"
    And the only layer below it is "floor-x"

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins_never_moves_a_pin_backwards_(folio-assistant_train_#3111)::a_held_pin_OLDER_than_the_current_one_is_held,_not_moved
  Scenario: A held pin older than the current one is held, not moved
    Given a lower layer pinned at C, and a harness lock holding it at B, which compares as behind
    When the plan is aligned to the held pins
    Then there are no moves
    And the lower layer is held with a reason containing "never moves a pin backwards"

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins_never_moves_a_pin_backwards_(folio-assistant_train_#3111)::a_NEWER_held_pin_moves,_as_before
  Scenario: A newer held pin moves as before
    Given a lower layer pinned at C, and a harness lock holding it at B, which compares as ahead
    When the plan is aligned to the held pins
    Then the lower layer moves from C to B

  @test:scripts/tests/sdlc/repin-standing.test.ts::alignToHeldPins_never_moves_a_pin_backwards_(folio-assistant_train_#3111)::when_the_order_cannot_be_asked,_it_is_held_with_the_reason,_never_moved_blind
  Scenario: When the commit order cannot be asked the pin is held with the reason, never moved blind
    Given a lower layer pinned at C, and a commit comparison that fails with "HTTP 500"
    When the plan is aligned to the held pins
    Then there are no moves
    And the lower layer is held with a reason containing "HTTP 500"
