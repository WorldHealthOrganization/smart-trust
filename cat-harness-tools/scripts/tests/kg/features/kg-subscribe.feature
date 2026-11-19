# scripts/kg-subscribe.ts judges a remote Knowledge Graph from its declaration at a pinned SHA,
# records the subscription and its fixity-bearing snapshot, and checks them offline (--check).
# Each Scenario names the test that executes it.
Feature: Subscribing to a substrate or content Knowledge Graph

  @test:scripts/tests/kg/kg-subscribe.test.ts::the_harness_rule_is_bootstrap's::each_harness_kind_is_one_bootstrap_defines_as_holding_Skills,_Roles_or_Processes
  Scenario: Every harness kind is one bootstrap defines as holding Skills, Roles or Processes
    Given the harness graph typologies of kg-subscribe
    When each is looked up in bootstrap's graph typologies
    Then every one has a defining sentence
    And together the sentences mention Skills, Roles and Processes

  @test:scripts/tests/kg/kg-subscribe.test.ts::parseTarget:_pinned,_or_refused_before_any_fetch::a_full_SHA_parses
  Scenario: A target pinned to a full SHA parses
    When the target "litlfred/ihris-kb@<full SHA>" is parsed
    Then it is ok with repository "litlfred/ihris-kb" and that SHA as ref

  @test:scripts/tests/kg/kg-subscribe.test.ts::parseTarget:_pinned,_or_refused_before_any_fetch::%s_is_refused
  Scenario: A target without a full pinned SHA is refused
    When parseTarget reads one of "litlfred/ihris-kb@main", a 12-character abbreviated SHA, "litlfred/ihris-kb" with no ref, or "ihris@<SHA>" with no owner
    Then it is not ok

  @test:scripts/tests/kg/kg-subscribe.test.ts::parseTarget:_pinned,_or_refused_before_any_fetch::an_unpinned_ref_is_refused_by_subscribe,_and_the_fetcher_is_never_called
  Scenario: Subscribe refuses an unpinned ref without calling the fetcher
    Given a subscriber layer and a counting fetcher serving a valid substrate
    When it subscribes to "litlfred/ihris-kb@main"
    Then the result is "refused" with a reason saying it is not a full commit SHA
    And the fetcher was called 0 times
    And the subscriber's declaration is unchanged

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::a_valid_substrate_names_its_harness_and_subgraphs
  Scenario: A valid substrate is judged with its harness and subgraphs
    Given a root holding ihris-kb.json and a package.json
    When the substrate is judged
    Then the verdict is "substrate" from file "ihris-kb.json"
    And its summary names harness "ihris-kb" and subgraphs "kb" and "kb-skills"

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::scenarios_or_processes_alone_also_make_a_harness
  Scenario: A scenarios or processes directory alone makes a harness
    Given a declaration whose only directory is of kind "scenarios", and another of kind "processes"
    When each is judged
    Then each verdict is "substrate"

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::not_bootstrap-conformant:_refused_with_the_failing_field
  Scenario: A declaration that fails bootstrap's schema is not a substrate
    Given the substrate declaration with version "v1" and a directory with no graph typologies
    When it is judged
    Then the verdict is "not-a-substrate"
    And the reason names bootstrap's declaration schema

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::zero_harnesses_with_Subgraphs:_CONTENT,_a_separate_kind_and_never_a_substrate_(owner,_2026-10-06)
  Scenario: Subgraphs with no harness are judged as content
    Given a declaration whose only directory is of kinds "folio" and "methodology"
    When it is judged
    Then the verdict is "content"
    And its summary has no harnesses

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::zero_harnesses_and_zero_Subgraphs:_still_refused,_and_the_reason_names_the_kinds_and_the_limit
  Scenario: No harness and no Subgraph is refused with the kinds and limit named
    Given a declaration with no directories
    When it is judged
    Then the verdict is "not-a-substrate"
    And the reason says it declares no harness and mentions nested instances

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::no_root_declaration:_refused,_not_could-not-determine_—_the_root_WAS_read
  Scenario: A root with no declaration is not a substrate
    Given a root holding only a package.json whose name matches no stem
    When it is judged
    Then the verdict is "not-a-substrate", not could-not-determine

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::two_root_declarations:_refused_by_bootstrap's_one-graph-per-directory_rule
  Scenario: Two root declarations are refused
    Given a root holding a.json named "a" and b.json named "b"
    When it is judged
    Then the verdict is "not-a-substrate"
    And the reason mentions 2 declarations

  @test:scripts/tests/kg/kg-subscribe.test.ts::judgeSubstrate:_three_answers::a_fetch_failure_is_could-not-determine_—_never_either_verdict
  Scenario: A fetch failure is could-not-determine
    Given a fetcher that fails with a 403
    When the substrate is judged
    Then the verdict is "could-not-determine"
    And the reason carries the 403

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::a_valid_substrate:_entry_with_nothing_chosen,_and_a_snapshot_with_fixity
  Scenario: Subscribing to a valid substrate writes an entry with nothing chosen and a snapshot with fixity
    Given a subscriber layer with a substrate-snapshot directory
    When it subscribes to the ihris-kb substrate at a full SHA
    Then the entry is id "ihris-kb", repository "litlfred/ihris-kb" and the SHA, and nothing else
    And the declaration's other lines are left as they were
    And the declaration parses with exactly that subscription
    And subscriptions/ihris-kb.substrate.json parses as a snapshot whose digest is the sha256 of its raw bytes
    And its raw bytes are the substrate declaration and its summary names harness "ihris-kb"
    And the snapshot has no top-level name

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::--id_names_the_subscription
  Scenario: --id names the subscription
    Given a subscriber layer
    When it subscribes to the ihris-kb substrate with id "kb"
    Then the entry's id is "kb"
    And subscriptions/kb.substrate.json exists

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::--dry-run_writes_nothing_and_reports_what_it_would
  Scenario: --dry-run writes nothing and reports what it would change
    Given a subscriber layer
    When it subscribes to the ihris-kb substrate as a dry run
    Then 2 changes are reported
    And the declaration is unchanged
    And no subscriptions directory is created

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::%s_writes_nothing
  Scenario: A refused or undetermined verdict writes nothing
    Given a subscriber layer
    When it subscribes and the verdict is "not-a-substrate" (a declaration with no directories) or "could-not-determine" (a failing fetch)
    Then the result carries that state
    And the declaration is unchanged and no subscriptions directory is created

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::an_instance_with_no_substrate-snapshot_directory_is_refused_before_fetching
  Scenario: A layer with no substrate-snapshot directory is refused before fetching
    Given a subscriber layer with no substrate-snapshot directory
    When it subscribes to the ihris-kb substrate
    Then the reason names substrate-snapshot
    And the fetcher was called 0 times

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_what_it_writes::a_subscription_colliding_with_needs_is_refused_by_the_declaration's_own_schema
  Scenario: A subscription colliding with needs is refused by the declaration's schema
    Given a subscriber layer that needs "ihris-kb"
    When it subscribes to the ihris-kb substrate
    Then the reason names needs
    And the declaration is unchanged

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_re-subscribing::idempotent:_the_same_pin_twice_changes_no_byte_the_second_time
  Scenario: Re-subscribing to the same pin changes no byte
    Given a layer already subscribed to the ihris-kb substrate
    When it subscribes to the same pin again
    Then no changes are reported
    And the declaration and the snapshot are byte-for-byte the same

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_re-subscribing::a_re-subscribe_keeps_the_subscriber's_choices
  Scenario: A re-subscribe keeps the subscriber's choices
    Given a layer subscribed to the ihris-kb substrate that has since chosen subgraph "kb"
    When it subscribes to the same pin again
    Then the entry's subgraphs are still ["kb"]

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_re-subscribing::moving_the_pin_with_nothing_chosen_updates_it;_with_parts_chosen_it_is_refused_as_a_refresh
  Scenario: Moving the pin updates an entry with nothing chosen and refuses one with parts chosen
    Given a layer subscribed to the ihris-kb substrate
    When it subscribes at a second SHA
    Then the entry's ref is the second SHA
    And once harness "ihris-kb" is chosen, subscribing at the first SHA again is refused naming refresh-materialized

  @test:scripts/tests/kg/kg-subscribe.test.ts::subscribe:_re-subscribing::an_id_already_naming_another_repository_is_refused
  Scenario: An id already naming another repository is refused
    Given a layer subscribed to litlfred/ihris-kb
    When it subscribes to someone/ihris-kb at the same SHA
    Then the reason points to --id

  @test:scripts/tests/kg/kg-subscribe.test.ts::checkSubscriptions:_the_offline_gate::clean_after_a_subscribe,_and_clean_with_nothing_subscribed
  Scenario: The offline check is clean after a subscribe and with nothing subscribed
    When subscriptions are checked for a freshly subscribed layer and for a layer with none
    Then both have no findings

  @test:scripts/tests/kg/kg-subscribe.test.ts::checkSubscriptions:_the_offline_gate::a_missing_snapshot_is_a_finding
  Scenario: A missing snapshot is a finding
    Given a subscribed layer whose snapshot file is deleted
    When subscriptions are checked
    Then a finding says there is no snapshot

  @test:scripts/tests/kg/kg-subscribe.test.ts::checkSubscriptions:_the_offline_gate::bytes_edited_in_place_fail_their_digest
  Scenario: Snapshot bytes edited in place fail their digest
    Given a subscribed layer whose snapshot raw version is changed from 1.2.0 to 9.9.9
    When subscriptions are checked
    Then a finding names the digest

  @test:scripts/tests/kg/kg-subscribe.test.ts::checkSubscriptions:_the_offline_gate::a_summary_that_disagrees_with_its_bytes_is_a_finding
  Scenario: A summary that disagrees with its bytes is a finding
    Given a subscribed layer whose snapshot summary names harness "something-else"
    When subscriptions are checked
    Then a finding names the summary

  @test:scripts/tests/kg/kg-subscribe.test.ts::checkSubscriptions:_the_offline_gate::a_moved_pin,_a_chosen_part_the_substrate_lacks,_and_an_orphan_are_each_findings
  Scenario: A moved pin, a missing chosen part and an orphan snapshot are each findings
    Given a subscribed layer whose entry now has a second SHA and chooses subgraph "nope"
    And a stray.substrate.json in its subscriptions directory
    When subscriptions are checked
    Then the findings call for a re-subscribe
    And name "nope"
    And report an orphaned snapshot

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_fixture_bare_repositories,_real_git_fetch::%s
  Scenario: The real git fetcher finds a root, a nested, an ambiguous or no declaration
    Given a bare repository holding the row's files, served through the git fetcher
    When the substrate is judged at its commit
    Then the verdict is the row's state
    And a substrate's file and upstreamPath are the row's file and its first directory, if nested
    And an ambiguous verdict lists "a/alpha.json" and "b/beta.json" and says it is not guessing and names --upstream-path
    And a not-a-substrate verdict says the root carries no Knowledge Graph declaration
    # Rows: root declaration -> substrate at ihris-kb.json; nested with a different directory name -> substrate at shared/trust-kg.json; two candidates one level down -> ambiguous; no declaration anywhere -> not-a-substrate

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_fixture_bare_repositories,_real_git_fetch::the_git_fetcher_reads_only_the_named_directory_when_given_an_upstreamPath,_at_any_depth
  Scenario: The git fetcher reads a named directory at any depth when given an upstreamPath
    Given a bare repository holding deep/er/trust-kg.json and a/alpha.json
    When it is judged with upstreamPath "deep/er/"
    Then the substrate file is "deep/er/trust-kg.json"
    And when judged without one, the only discovered file is "a/alpha.json"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_fixture_bare_repositories,_real_git_fetch::a_SHA_the_remote_does_not_hold_is_could-not-determine
  Scenario: A SHA the remote does not hold is could-not-determine
    Given a bare repository holding the nested trust-kg tree
    When it is judged at a SHA it does not hold
    Then the verdict is "could-not-determine"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::nested_with_a_different_directory_name:_found,_and_its_directory_is_the_upstreamPath
  Scenario: A nested declaration in a differently named directory is found with that directory as upstreamPath
    Given a root with nothing but package.json, and shared/trust-kg.json
    When it is judged
    Then the verdict is "substrate" from "shared/trust-kg.json"
    And its upstreamPath is "shared" and its summary name is "trust-kg"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::the_root_still_wins,_so_an_existing_subscription_judges_the_same_bytes
  Scenario: A root declaration wins over a nested one
    Given a root holding ihris-kb.json and the nested trust-kg tree
    When it is judged
    Then the substrate file is "ihris-kb.json"
    And there is no upstreamPath

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::two_candidates:_refused_with_both_named,_never_guessed
  Scenario: Two nested candidates are refused with both named
    Given a tree with a/alpha.json and b/beta.json
    When it is judged
    Then the verdict is "ambiguous"
    And the reason names "a/alpha.json" and "b/beta.json"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::--name_picks_one_of_two;_a_name_nobody_carries_is_not-a-substrate
  Scenario: --name picks one of two candidates; an unknown name is not a substrate
    Given a tree with a/alpha.json and b/beta.json
    When it is judged with name "beta"
    Then the substrate file is "b/beta.json"
    And with name "gamma" the verdict is "not-a-substrate" with a reason naming gamma

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::a_file_whose_`name`_disagrees_with_its_stem_is_not_a_candidate
  Scenario: A file whose name disagrees with its stem is not a candidate
    Given only shared/trust-kg.json, whose name is "shared"
    When it is judged
    Then the verdict is "not-a-substrate"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::--upstream-path_reads_that_directory_only,_and_refuses_what_is_not_there
  Scenario: --upstream-path reads only that directory and refuses an empty one
    Given a tree with a/alpha.json and b/beta.json
    When it is judged with upstreamPath "a"
    Then the substrate file is "a/alpha.json"
    And with upstreamPath "c/" the verdict is "not-a-substrate" saying c/ carries no Knowledge Graph declaration

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_the_search::an_unsafe_upstreamPath_%s_is_refused_before_any_fetch
  Scenario: An unsafe upstreamPath is refused before any fetch
    Given a counting fetcher serving the nested trust-kg tree
    When it is judged with upstreamPath "../elsewhere", ".hidden" or "/abs"
    Then the verdict is "not-a-substrate"
    And the fetcher was called 0 times

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_what_subscribe_records,_and_what_--check_holds::the_subscription_records_the_upstreamPath_and_the_snapshot_the_nested_file;_--check_is_clean
  Scenario: A nested subscription records its upstreamPath and the snapshot its nested file
    Given a subscriber layer
    When it subscribes to the nested trust-kg tree
    Then the entry is id "trust-kg", repository "litlfred/trust-kg", the SHA, and upstreamPath "shared"
    And the declaration's subscription records upstreamPath "shared"
    And the snapshot's file is "shared/trust-kg.json"
    And the offline check has no findings

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_what_subscribe_records,_and_what_--check_holds::a_re-subscribe_reuses_the_recorded_subtree_and_changes_no_byte
  Scenario: A re-subscribe reuses the recorded subtree and changes no byte
    Given a layer subscribed to the nested trust-kg tree
    And the tree has since grown a second candidate other/other.json
    When it subscribes to the same pin again
    Then no changes are reported
    And the declaration is byte-for-byte the same

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_what_subscribe_records,_and_what_--check_holds::an_ambiguous_tree_is_REFUSED_by_subscribe,_and_nothing_is_written
  Scenario: Subscribe refuses an ambiguous tree and writes nothing
    Given a subscriber layer and a tree with a/alpha.json and b/beta.json
    When it subscribes
    Then the result is "refused" saying it is not guessing
    And the declaration is unchanged
    And subscribing with upstreamPath "b" records upstreamPath "b"

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_what_subscribe_records,_and_what_--check_holds::--check:_a_snapshot_read_from_another_subtree_than_the_subscription_records_is_a_finding
  Scenario: The offline check flags a snapshot read from another subtree than recorded
    Given a layer subscribed to the nested trust-kg tree from "shared"
    When its entry's upstreamPath is changed to "elsewhere"
    Then a finding says the snapshot was read from shared/ while the entry records elsewhere
    And when the upstreamPath is removed, a finding says the subscription records the root

  @test:scripts/tests/kg/kg-subscribe.test.ts::a_declaration_one_level_down_(bean_437w):_what_subscribe_records,_and_what_--check_holds::moving_the_subtree_of_a_subscription_with_chosen_parts_is_refused
  Scenario: Moving the subtree of a subscription with chosen parts is refused
    Given a layer subscribed to trust-kg from "shared" that has chosen subgraph "trust-skills"
    When it subscribes again with upstreamPath "other"
    Then it is refused as a different subscription

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_fixture_bare_repositories,_real_git_fetch::%s
  Scenario: The real git fetcher tells content from substrate and from neither
    Given a bare repository holding the row's files, served through the git fetcher
    When the substrate is judged at its commit
    Then the verdict is the row's state
    And a content verdict has no harnesses, and a substrate verdict at least one
    And the no-declaration row says the root carries no Knowledge Graph declaration
    # Rows: content-only nested -> content; harness-bearing nested -> substrate; harness-bearing at the root -> substrate; a declaration with no Subgraph -> not-a-substrate; no declaration at all -> not-a-substrate

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::subscribe_records_`kind:_"content"`_on_the_entry_and_the_snapshot,_and_--check_is_clean
  Scenario: Subscribing to content records kind "content" on the entry and snapshot
    Given a subscriber layer
    When it subscribes to the nested imm-kg content tree
    Then the verdict is "content"
    And the entry is id "imm-kg", repository "litlfred/imm-kg", the SHA, upstreamPath "shared" and kind "content"
    And the declaration's subscription has kind "content"
    And the snapshot has kind "content" and no harnesses
    And the offline check has no findings

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::a_substrate_subscription_records_NO_kind,_so_every_existing_record_is_unchanged
  Scenario: A substrate subscription records no kind
    Given a subscriber layer
    When it subscribes to the ihris-kb substrate
    Then the entry has no kind key
    And the snapshot has no kind

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::the_schemas_hold_the_kind_and_the_harness_list_together
  Scenario: The schemas tie the kind to the harness list
    Then a content subscription choosing a harness is refused by the declaration schema
    And a content subscription choosing a subgraph is accepted
    And a snapshot with no kind and no harness is refused
    And a content snapshot with no harness is accepted
    And a content snapshot with a harness is refused

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::--check:_a_content_snapshot_under_a_substrate_entry_is_a_finding
  Scenario: The offline check flags a content snapshot under a substrate entry
    Given a layer subscribed to the imm-kg content tree
    When the kind is removed from its entry
    Then a finding says the subscription is substrate and its snapshot is content

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::--check:_a_snapshot_whose_kind_its_bytes_do_not_bear_out_is_a_finding
  Scenario: The offline check flags a snapshot kind its bytes do not bear out
    Given a layer subscribed to the ihris-kb substrate
    When its snapshot is rewritten as kind "content" with no harnesses
    Then a finding says its snapshot is content
    And a finding says its bytes judge as substrate

  @test:scripts/tests/kg/kg-subscribe.test.ts::content_Knowledge_Graphs_(owner,_2026-10-06):_recorded_as_their_own_kind::a_content_snapshot_contributes_no_harness_declaration,_whatever_is_asked
  Scenario: A content snapshot contributes no harness declaration
    # Gap: only one harness name, "imm-kg", is asked for
    Given a layer subscribed to the imm-kg content tree
    When the harness declaration "imm-kg" is looked up in its snapshot
    Then there is none

  @test:scripts/tests/kg/kg-subscribe.test.ts::setTopLevelKey::replaces_only_the_value's_span,_and_appends_an_absent_key
  Scenario: setTopLevelKey replaces only a value's span and appends an absent key
    Given a JSON text with keys a, b (a string holding ",}]") and c (a multi-line array)
    When b is set to ["q"]
    Then only b's value changes, every other byte is kept
    And setting the last key c to 2 parses to the same object with c 2
    And setting an absent key d appends it, keeping the leading line of a as it was
