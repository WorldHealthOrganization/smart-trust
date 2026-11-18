# What scripts/tests/kg/kg-instantiate.test.ts covers: scripts/kg-instantiate.ts instantiates a harness a subscription
# chose from its cached snapshot, writing a config and state directories, refusing or reporting undetermined with a reason.
# Each Scenario names the test that executes it.
Feature: kg:instantiate a subscribed harness

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_writes_the_config_and_the_state_directories::a_chosen,_declared_harness_is_instantiated
  Scenario: A chosen, declared harness is instantiated
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "instantiated"
    And "ihris-kb.config.json" is written at the repository root with a _subscription naming subscriber, id, repository and ref
    And beans/workflows and beans/defs are created under the harness home, but not skills
    And nothing named "ihris-kb" is created at the repository root
    And three paths are written

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_writes_the_config_and_the_state_directories::with_an_index.config.json,_the_config_goes_INLINE_in_a_new_entry_and_no_<name>.config.json_is_written_(ymvt)
  Scenario: With an index.config.json the config goes inline in a new index entry
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the repository root holds an index.config.json listing "host"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "instantiated" and no "ihris-kb.config.json" is written
    And the index gains an "ihris-kb" entry carrying the _subscription
    And instantiating again reports "already-instantiated"
    And the subscription cards list "ihris-kb" as instantiated

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_writes_the_config_and_the_state_directories::a_dry_run_writes_nothing_and_says_what_it_would
  Scenario: A dry run writes nothing and says what it would
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When it is instantiated as a dry run
    Then the state is "instantiated" with three paths listed as written
    And neither the config nor the harness home exists

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_writes_the_config_and_the_state_directories::idempotent:_an_existing_config_is_reported,_never_overwritten
  Scenario: An existing config is reported and never overwritten
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And it has been instantiated and its config then hand-edited
    When it is instantiated again
    Then the state is "already-instantiated" with nothing written
    And the config keeps its hand-edited content

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_writes_the_config_and_the_state_directories::a_re-run_restores_a_state_directory_that_went_missing,_and_still_leaves_the_config
  Scenario: A re-run restores a missing state directory and leaves the config
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And it has been instantiated and its beans/defs state directory then removed
    When it is instantiated again
    Then the state is "already-instantiated"
    And only the beans/defs directory is written
    And the config is unchanged

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::the_home_is_<state_dir>/<subscription>/<harness>/
  Scenario: The harness home is <state dir>/<subscription>/<harness>
    Given the state directory "/x/host/subscribed-harnesses"
    When the home of harness "kb" in subscription "sub" is asked
    Then it is that directory joined with "sub" and "kb"

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::nothing_is_written_under_the_read-only_snapshot_directory
  Scenario: Nothing is written under the read-only snapshot directory
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "instantiated"
    And no written path is under host/subscriptions
    And host/subscriptions/ihris-kb does not exist

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::a_subscriber_that_declares_no_`subscribed-harnesses`_directory_is_refused,_and_nothing_is_written
  Scenario: A subscriber declaring no subscribed-harnesses directory is refused
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the host's declaration no longer has the "subscribed-harnesses" directory
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it is refused because the host declares no `subscribed-harnesses` directory
    And neither the subscribed-harnesses directory nor the config is written

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::a_staged_instance_directory_carrying_the_harness's_name_at_the_root_is_left_untouched
  Scenario: A staged directory carrying the harness's name at the root is left untouched
    Given a checkout with an undeclared "ihris-kb/beans/keep.md" at the repository root
    And the host subscribed to and chose "ihris-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "instantiated" and no written path is under the root "ihris-kb" directory
    And the root "ihris-kb/beans/keep.md" is unchanged and no beans/defs is added beside it
    And beans/defs is created under the harness home

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::the_config_names_where_the_state_lives
  Scenario: The config names where the state lives
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the config's _comment names "host/subscribed-harnesses/ihris-kb/ihris-kb/"

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_the_state_home_is_its_own_state_directory,_never_the_snapshot_directory_(G11,_w1gy_finding_1)::an_old-layout_`harnesses/`_under_the_snapshot_directory_is_a_stray_to_the_part_reader
  Scenario: An old-layout harnesses directory under the snapshot directory is a stray
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the harness has been instantiated
    When the part records of the snapshot directory are read
    Then there are no parts, strays or nodes
    And once "subscriptions/ihris-kb/harnesses/ihris-kb" is created the only stray is "ihris-kb/harnesses"

  @test:scripts/tests/kg/kg-instantiate.test.ts::kg:subscribe:check_judges_the_subscribed-harnesses_directory_(w1gy_finding_1)::an_instantiated_harness's_home_is_clean
  Scenario: An instantiated harness's home passes the subscription check
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the harness has been instantiated
    When the subscriptions are checked
    Then there are no findings

  @test:scripts/tests/kg/kg-instantiate.test.ts::kg:subscribe:check_judges_the_subscribed-harnesses_directory_(w1gy_finding_1)::a_home_in_the_old_snapshot-directory_layout_is_a_finding_that_says_where_to_move_it
  Scenario: A home in the old snapshot-directory layout is a finding saying where it is
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And a "subscriptions/ihris-kb/harnesses/ihris-kb" directory exists
    When the subscriptions are checked
    Then there is one finding about instantiated-harness state in the read-only snapshot directory

  @test:scripts/tests/kg/kg-instantiate.test.ts::kg:subscribe:check_judges_the_subscribed-harnesses_directory_(w1gy_finding_1)::a_home_for_an_unchosen_harness,_an_undeclared_subscription,_or_a_loose_file_is_orphaned
  Scenario: Homes for an unchosen harness or an undeclared subscription, and loose files, are orphaned
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the harness has been instantiated
    And subscribed-harnesses also holds ihris-kb/other, gone/x, loose.txt and a README.md
    When the subscriptions are checked
    Then there are three findings
    And they name state for subscription `gone`, state for harness `other`, and loose.txt as not a subscription's directory

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_CONTENT_subscription_has_nothing_to_instantiate_(owner,_2026-10-06)
  Scenario: A content subscription has nothing to instantiate
    Given the host subscribed to "ig", which declares only a docs directory, recorded as kind "content"
    When harness "ig" of subscription "ig" is instantiated
    Then it is refused naming a CONTENT Knowledge Graph
    And no "ig.config.json" is written

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::no_such_subscription
  Scenario: Instantiating from a subscription that does not exist is refused
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When harness "ihris-kb" of subscription "nope" is instantiated
    Then it is refused saying there is no subscription `nope` and naming `ihris-kb`

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_harness_the_subscription_did_not_choose
  Scenario: A harness the subscription did not choose is refused
    Given the host subscribed to "ihris-kb" choosing no harness
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it is refused saying it did not choose harness `ihris-kb` and chose no harness
    And no config is written

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_chosen_harness_the_substrate_does_not_declare
  Scenario: A chosen harness the substrate does not declare is refused
    Given the host subscribed to "ihris-kb" choosing "ihris-kb" and "ghost"
    When harness "ghost" is instantiated
    Then it is refused saying the substrate does not declare harness `ghost` and declares `ihris-kb`

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::an_unmet_need_is_refused,_naming_every_missing_one
  Scenario: An unmet need is refused, naming every missing one
    Given the host subscribed to "ihris-kb" whose declaration needs "base-kb" and "other-kb", neither present
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it is refused naming needs `base-kb`, `other-kb`
    And neither the config nor the harness home is written

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_need_is_satisfied_by_a_local_instance
  Scenario: A need is satisfied by a local layer
    Given a checkout with a local "base-kb" layer
    And the host subscribed to "ihris-kb" which needs "base-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it succeeds

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_need_is_satisfied_by_another_subscription
  Scenario: A need is satisfied by another subscription
    Given the host subscribed to "base-kb" choosing no harness
    And subscribed to "ihris-kb" which needs "base-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it succeeds

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_local_instance_already_carrying_the_harness's_name
  Scenario: A local layer already carrying the harness's name is refused
    Given a checkout with a local "ihris-kb" layer
    And the host subscribed to and chose "ihris-kb"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it is refused saying something is already named `ihris-kb`

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_snapshot_edited_in_place_is_refused
  Scenario: A snapshot edited in place is refused
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the cached snapshot's raw declaration has been edited
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then it is refused with a reason mentioning the digest

  @test:scripts/tests/kg/kg-instantiate.test.ts::instantiate:_refusals,_each_with_its_reason::a_state_path_that_climbs_out_is_refused_before_anything_is_written
  Scenario: A state path that climbs out is refused before anything is written
    Given a substrate whose first directory is "../outside/" with a workflow-state kind
    When the host subscribes to it and, if admitted, chooses and instantiates "ihris-kb"
    Then either the subscribe is refused over "directories.0.path" or the instantiate is refused as climbing out
    And no "outside" directory is created in the repository

  @test:scripts/tests/kg/kg-instantiate.test.ts::could-not-determine_is_never_clean::a_missing_snapshot
  Scenario: A missing snapshot cannot be determined
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the cached snapshot file has been removed
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "could-not-determine" with a reason pointing at kg:subscribe

  @test:scripts/tests/kg/kg-instantiate.test.ts::could-not-determine_is_never_clean::a_directory_whose_kinds_nobody_here_registers
  Scenario: A directory whose kinds nobody here registers cannot be determined
    Given the host subscribed to and chose "ihris-kb", whose declaration adds a directory "odd" of kind "not-a-kind-here"
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "could-not-determine" naming `odd` (`not-a-kind-here`)
    And no config is written

  @test:scripts/tests/kg/kg-instantiate.test.ts::could-not-determine_is_never_clean::an_unmet_need_while_another_snapshot_cannot_be_read_is_undetermined,_not_refused
  Scenario: An unmet need while another snapshot cannot be read is undetermined, not refused
    Given the host subscribed to "base-kb" and to "ihris-kb" which needs it
    And base-kb's cached snapshot has been removed
    When harness "ihris-kb" of subscription "ihris-kb" is instantiated
    Then the state is "could-not-determine" with a reason that it could not be read

  @test:scripts/tests/kg/kg-instantiate.test.ts::could-not-determine_is_never_clean::a_state_kind_beside_an_unknown_kind_still_counts_as_state
  Scenario: A state kind beside an unknown kind still counts as state
    Given a declaration whose directory "a/" has kinds "workflow-state" and "mystery"
    When its state directories are read
    Then the answer is determined with directory "a" at "a/"

  @test:scripts/tests/kg/kg-instantiate.test.ts::unsafePathReason::%s
  Scenario: An unsafe state path is named with its reason
    Given a state directory path
    When its unsafe-path reason is asked
    Then "beans/defs/" has none
    And "/abs" is absolute
    And "a/../../b" climbs out of the harness's home
    And ".hidden/x" has the dot-prefixed segment `.hidden`
    And "./" names the harness's root rather than a directory under it

  @test:scripts/tests/kg/kg-instantiate.test.ts::the_navbar,_the_config_sweep_and_the_visualizer_see_it::an_instantiated_subscribed_harness_gets_an_instantiated_tile_from_its_snapshot
  Scenario: An instantiated subscribed harness gets an instantiated tile from its snapshot
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When the harness tiles are listed before and after instantiating
    Then before, the only tile is "host"
    And after, an "ihris-kb" tile is instantiated, titled "iHRIS Knowledge Base", with no href
    And its visualisations are bean-defs, skills and workflow-state, each with no path and a note that it is not held here

  @test:scripts/tests/kg/kg-instantiate.test.ts::the_navbar,_the_config_sweep_and_the_visualizer_see_it::an_unreadable_snapshot_is_drawn_as_a_finding,_not_an_empty_tile
  Scenario: An unreadable snapshot is drawn as a finding, not an empty tile
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    And the harness has been instantiated and its cached snapshot then removed
    When its subscribed tile is drawn
    Then the tile is instantiated
    And its findings say it could not read its declaration

  @test:scripts/tests/kg/kg-instantiate.test.ts::the_navbar,_the_config_sweep_and_the_visualizer_see_it::check-instance-config_claims_a_chosen_harness's_config_rather_than_calling_it_orphaned
  Scenario: check-instance-config claims a chosen harness's config
    Given a checkout with an "ihris-kb.config.json" at the root
    When the instance configs are swept before and after the host subscribes to and chooses "ihris-kb"
    Then before there is one "orphan" finding
    And after there are no findings

  @test:scripts/tests/kg/kg-instantiate.test.ts::the_navbar,_the_config_sweep_and_the_visualizer_see_it::the_visualizer_marks_the_harness_instantiated_once_its_config_exists
  Scenario: The visualizer marks the harness instantiated once its config exists
    Given a checkout whose "host" layer subscribes to "ihris-kb" at a pinned SHA and chose harness "ihris-kb"
    When the subscriptions are rendered before and after instantiating
    Then before, harness `ihris-kb` is shown as chosen, not yet instantiated
    And after, it is shown as instantiated
