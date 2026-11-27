# ContentDirectory.storage (schemas/kg/cat-harness.ts) declares a directory kept on a branch, keyed by
# commit, tip, route or family; check:declared-dirs, harness:dirs, audit:coverage, graph-read and qa-store honour it.
# Each Scenario names the test that executes it.
Feature: A directory kept on a branch, keyed by commit, tip or route

  @test:scripts/tests/kg/directory-storage.test.ts::the_schema::accepts_{_branch,_keyedBy:_commit_}_and_leaves_it_optional
  Scenario: A commit-keyed storage is accepted and storage is optional
    Given a qa directory at "test/results/" with storage on branch "qa-reports" keyed by commit
    Then the content directory schema accepts it
    And the same directory without storage is accepted too

  @test:scripts/tests/kg/directory-storage.test.ts::the_schema::accepts_keyedBy_%s_(beans_2h76,_1j3q)
  Scenario: Each implemented keying is accepted for a suitable directory
    Given a storage on branch "cat/cat-harness/beans" keyed by the row's keying
    Then the storage schema accepts it
    And the content directory schema accepts it on the row's directory
    And the rows are commit on a qa directory, tip on a bean-defs directory and route on a docs directory

  @test:scripts/tests/kg/directory-storage.test.ts::the_schema::refuses_keyedBy_%s_on_a_qa_directory:_qa_is_commit-keyed_by_construction
  Scenario: A qa directory refuses a non-commit keying
    Given a qa directory at "test/results/" whose storage is keyed by the row's keying
    Then the content directory schema refuses it
    And the rows are tip and route

  @test:scripts/tests/kg/directory-storage.test.ts::the_schema::refuses_%j_—_%s
  Scenario: A malformed storage is refused
    Given the row's storage
    Then the storage schema refuses it
    And the content directory schema refuses a qa directory carrying it
    And the rows are keyedBy "path", keyedBy "routes", branch "refs/heads/qa-reports", branch "-qa", branch "qa..reports", branch "qa reports", an unknown key "force", and no branch

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::the_resolver_ACCEPTS_keyedBy_route_—_it_threw_a_ZodError_until_the_two_enums_were_made_one
  Scenario: A route-keyed directory audits without a schema error
    Given a git repository declaring "uml/" stored on a branch keyed by route
    When the instance is audited
    Then no finding mentions "Invalid option"
    And no finding mentions "ZodError"

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::not-cut-over:_route_gets_the_two-copies_finding,_because_two_copies_is_two_copies
  Scenario: A route-keyed directory whose files are still tracked is not cut over
    Given a git repository declaring "uml/" stored keyed by route
    And two files under "uml/" still added to the index
    When the instance is audited
    Then the only finding is of kind "not-cut-over"
    And its detail says "keyed by route", "still tracks 2 file(s)" and "ONE change"

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::cut_over:_NO_finding_—_there_is_no_route-keyed_mount_for_`unmounted`_to_be_about
  Scenario: A cut-over route-keyed directory has no finding, unlike a tip-keyed one
    Given a git repository declaring "uml/" stored keyed by route, with nothing tracked
    When the instance is audited
    Then there are no findings
    And the same declaration keyed by tip yields only an "unmounted" finding

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::graph-read:_not-cut-over_reads_the_CHECKOUT_and_says_so;_cut_over_is_REFUSED,_never_a_path
  Scenario: Graph-read reads a not-cut-over route directory from the checkout and refuses a cut-over one
    Given a route-keyed "uml" directory whose files are still tracked
    When its graph read path is asked
    Then the state is "ok", read from "checkout", and marked not cut over
    Given a cut-over route-keyed "uml" directory
    When its graph read path is asked
    Then the state is "refused"
    And the reason says "has no mount" and names "dh4f"

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::audit:coverage:_`stored`_only_once_it_is_TRUE_—_not-cut-over_is_undetermined
  Scenario: The coverage census counts a route directory as stored only once cut over
    Given a route-keyed "uml" directory whose files are still tracked
    When the directories are censused
    Then stored is 0 and undetermined is 1
    Given a cut-over route-keyed "uml" directory
    When the directories are censused
    Then stored is 1 and undetermined is 0

  @test:scripts/tests/kg/directory-storage.test.ts::a_route-keyed_directory_is_TWO-valued,_and_the_missing_third_is_deliberate::a_route-keyed_`qa`_subgraph_is_refused_by_the_resolver_too,_not_only_by_the_schema
  Scenario: The subgraph resolver refuses a non-commit keyed qa directory
    Given a hand-built qa entry at "test/results/"
    When its subgraph source is resolved with storage keyed by route
    Then it throws a message naming "keyed by commit"
    And keyed by tip it throws the same
    And keyed by commit it resolves to a source of kind "branch"

  @test:scripts/tests/kg/directory-storage.test.ts::presence_checks_honour_it::check:declared-dirs:_an_absent_STORED_directory_is_not_a_finding;_the_same_without_storage_is
  Scenario: An absent stored directory is not a finding, while the same without storage is
    Given a layer declaring the qa directory "test/results/" with commit-keyed storage, absent from disk
    When the instance is audited
    Then there are no findings
    And the same declaration without storage yields only an "absent" finding

  @test:scripts/tests/kg/directory-storage.test.ts::presence_checks_honour_it::check:declared-dirs:_a_fetched_working_copy_of_a_stored_directory_is_not_a_stale_exemption
  Scenario: A fetched working copy of a stored directory is not a stale exemption
    Given a layer declaring the qa directory "test/results/" with commit-keyed storage
    And the directory "test/results" exists
    When the instance is audited
    Then there are no findings

  @test:scripts/tests/kg/directory-storage.test.ts::presence_checks_honour_it::harness:dirs_does_not_create_a_stored_directory_empty,_and_does_not_list_it_as_missing
  Scenario: harness:dirs neither creates a stored directory nor lists it as missing
    Given a layer declaring a stored qa directory "test/results/" and a plain health directory "test/health/results/"
    When the directories are resolved
    Then the qa directory carries its storage
    When the directories are materialised
    Then "qa" is not among the materialised ids
    And "test/results" does not exist while "test/health/results" does

  @test:scripts/tests/kg/directory-storage.test.ts::presence_checks_honour_it::audit:coverage_skips_a_stored_directory's_working_copy_and_says_how_many_it_skipped
  Scenario: The coverage census skips stored working copies and counts them
    Given two existing directories, both with commit-keyed storage
    When they are censused
    Then the census is 0 files, 0 sidecars, 2 stored, 0 undetermined, 0 uncounted and 0 absent

  @test:scripts/tests/kg/directory-storage.test.ts::presence_checks_honour_it::a_directory_neither_stored_nor_present_is_UNCOUNTED,_never_a_census_of_zero_(bean_0dav,_C8)
  Scenario: A directory neither stored nor present is uncounted, never a census of zero
    Given an existing directory holding "x.json" and a missing directory, neither stored
    When they are censused
    Then the census is 1 file, 0 sidecars, 0 stored, 0 undetermined, 1 uncounted and 0 absent

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::not-cut-over:_the_declaration_names_the_branch_and_the_checkout_still_tracks_the_files
  Scenario: A tip-keyed directory whose files are still tracked is not cut over
    Given a git repository declaring "beans/" stored keyed by tip
    And "beans/a.md" added to the index
    When the instance is audited
    Then the only finding is of kind "not-cut-over"
    And its detail says "ONE change" and "still tracks 1 file(s)"

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::unmounted:_cut_over,_nothing_mounted_—_an_EMPTY_graph,_not_an_unreachable_one
  Scenario: A cut-over tip-keyed directory with nothing mounted is unmounted
    Given a git repository declaring "beans/" stored keyed by tip, with nothing tracked and no mount
    When the instance is audited
    Then the only finding is of kind "unmounted"
    And its detail says "nothing is mounted here"

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::mounted_is_the_pass,_and_a_marker_whose_mount_is_GONE_is_not
  Scenario: A mounted tip-keyed directory passes, and a marker whose mount is gone does not
    Given a git repository declaring "beans/" stored keyed by tip
    And a mount marker for "beans" into the "beans" directory
    When the instance is audited
    Then there are no findings
    When the mounted directory is removed and the instance is audited again
    Then the only finding is of kind "unmounted"

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::a_COMMIT-keyed_directory_in_the_same_repository_is_still_skipped_—_the_distinction_is_the_keying
  Scenario: A commit-keyed directory beside a tip-keyed one is still skipped
    Given a git repository declaring a commit-keyed qa directory and a tip-keyed beans directory, neither present
    When the instance is audited
    Then the only finding ids are "beans"

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::audit:coverage_counts_a_mount's_real_files,_and_will_not_fold_`undetermined`_into_`stored`
  Scenario: The coverage census counts a mount's files and keeps undetermined apart from stored
    Given a git repository with a mount marker for "beans" into "mounted" holding "a.md" and "b.md"
    When the tip-keyed "beans" directory is censused
    Then the census is 2 files, 0 stored, 0 undetermined, 0 uncounted and 0 absent
    And a tip-keyed "todos" directory with no mount is censused as 1 undetermined and 0 stored

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::unmounted_WITH_an_absence_record_is_`absent`,_not_`undetermined`
  Scenario: An unmounted tip-keyed directory with an absence record is absent, not undetermined
    Given a git repository with an absence recorded for "todos"
    When the tip-keyed "todos" directory is censused
    Then the census is 1 absent and 0 undetermined
    And a tip-keyed "beans" directory with no record is censused as 1 undetermined

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::`source:_{_kind:_branch,_keyedBy:_tip_}`_reaches_the_same_verdict_as_the_legacy_`storage`
  Scenario: A tip-keyed branch source reaches the same verdict as the legacy storage
    Given a git repository declaring "beans/" with source of kind "branch" keyed by tip
    When the instance is audited
    Then the only finding is of kind "unmounted"
    When a mount marker for "beans" is written and the instance is audited again
    Then there are no findings
    And the census reports 0 undetermined

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::`source:_{_kind:_branch,_keyedBy:_commit_}`_is_skipped,_like_the_legacy_commit-keyed_form
  Scenario: A commit-keyed branch source is skipped like the legacy commit-keyed form
    Given a git repository declaring a qa directory with source of kind "branch" keyed by commit
    When the instance is audited
    Then there are no findings
    And the census is 0 files, 0 sidecars, 1 stored, 0 undetermined, 0 uncounted and 0 absent

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::an_entry_declaring_BOTH_is_a_finding_carrying_the_resolver's_message,_not_a_crash
  Scenario: An entry declaring both storage and source is a finding carrying the resolver's message
    Given a git repository declaring "beans/" with both a tip-keyed storage and a tip-keyed branch source
    When the instance is audited
    Then the only finding is of kind "unmounted"
    And its detail says "two answers to where its content comes from"

  @test:scripts/tests/kg/directory-storage.test.ts::a_tip-keyed_directory_is_three-valued,_and_only_one_value_is_a_pass::no_git_repository_is_`undetermined`,_never_a_pass:_a_gate_that_could_not_ask_has_not_asked
  Scenario: Without a git repository a tip-keyed directory is undetermined, never a pass
    Given a layer outside any git repository declaring "beans/" stored keyed by tip
    When the instance is audited
    Then the only finding is of kind "unmounted"
    And its detail says "Not a pass"
    And the census reports 1 undetermined

  @test:scripts/tests/kg/directory-storage.test.ts::resolveQaLocation::reads_the_branch_from_the_declaration;_with_none_declared_it_is_the_default,_and_says_so
  Scenario: The qa location reads the declared branch, or the default when none is declared
    Given a layer declaring the qa directory "test/results/" stored on branch "qa-elsewhere" keyed by commit
    When the qa location is resolved
    Then its branch is "qa-elsewhere", declared, keyed by commit
    And its directories hold "qa" at "test/results", not present, with that storage
    And a layer declaring qa without storage resolves to branch "cat/cat-harness/qa-reports", not declared

  @test:scripts/tests/kg/directory-storage.test.ts::resolveQaLocation::two_qa_directories_naming_different_branches_are_refused,_not_resolved_by_order
  Scenario: Two qa directories naming different branches are refused
    Given a layer declaring qa directories stored on branches "one" and "two"
    When the qa location is resolved
    Then it throws a QaUsageError

  @test:scripts/tests/kg/directory-storage.test.ts::storage's_FAMILY_form_(bean_lehh)::parses,_with_a_prefix_ending_in_/_and_the_key_said_in_words
  Scenario: A family storage with a prefix ending in / and the key in words parses
    Given a storage with branch prefix "cat/fhir-harness/fhir-ast/", keyed by family, key from "the IG's package id"
    Then the storage schema accepts it
    And the content directory schema accepts it on the directory "ig-ast/"

  @test:scripts/tests/kg/directory-storage.test.ts::storage's_FAMILY_form_(bean_lehh)::refuses_a_prefix_without_/,_a_family_with_a_single_branch,_and_a_family_with_no_key
  Scenario: A malformed family storage is refused
    Then the storage schema refuses a family whose branch prefix lacks a trailing "/"
    And it refuses a family keyed storage naming a single branch
    And it refuses a family with no key
