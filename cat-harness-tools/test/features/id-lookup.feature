# The prefix-sharded identifier lookup: scripts/gen-id-lookup.ts builds the committed index
# with schemas/kg/id-lookup.ts, and id-lookup/lookup.js is the client a browser runs
# against it. Each Scenario names the test that executes it.
Feature: Prefix-sharded identifier lookup

  @test:test/id-lookup.test.ts::the_committed_who-iris_index::there_are_referenced_nodes_to_resolve,_so_the_checks_below_are_not_vacuous
  Scenario: The committed index has enough referenced nodes for the checks to mean something
    Given the referenced node ids counted from the raw catalogue JSON
    When they are compared with the committed manifest
    Then there are at least 10
    And the manifest's entry count equals their number

  @test:test/id-lookup.test.ts::the_committed_who-iris_index::every_referenced_node_resolves_through_the_shards,_with_the_browser's_own_client
  Scenario: Every referenced node resolves through the committed shards with the browser client
    Given the browser client opened over the committed index files
    When each referenced id is looked up
    Then it is found with that id and exactly one shard fetched
    And the same id padded with spaces and upper-cased is also found
    And every referenced id was resolved

  @test:test/id-lookup.test.ts::the_committed_who-iris_index::a_materialised_node_is_NOT_in_it:_the_site's_own_search_holds_those
  Scenario: A materialised node is absent from the lookup
    Given the browser client opened over the committed index files
    When the materialised id "item/18892cf3-5a4f-42a4-923c-a93f4a594dec" is looked up
    Then the result is "absent"

  @test:test/id-lookup.test.ts::the_committed_who-iris_index::every_shard_parses,_is_listed,_and_is_under_the_budget
  Scenario: Every committed shard parses, is listed in the manifest and is under the budget
    Given the committed index files
    When each shard is checked
    Then it parses as a shard
    And it is listed under its namespace in the manifest
    And its size is within the manifest's budget
    And the manifest's budget is the shard budget constant
    And the number of shards equals the number listed in the manifest

  @test:test/id-lookup.test.ts::the_committed_who-iris_index::the_committed_files_are_what_the_build_writes_(the_`--check`_gate,_run_here_too)
  Scenario: The committed index is what the build writes
    Given a fresh build of the index
    When it is compared with the committed output directory
    Then nothing is stale

  @test:test/id-lookup.test.ts::`--check`_catches_staleness::a_copy_of_the_committed_index_is_current
  Scenario: An unchanged copy of the committed index is current
    Given a copy of the committed index
    When it is compared with a fresh build
    Then nothing is stale

  @test:test/id-lookup.test.ts::`--check`_catches_staleness::a_changed_shard
  Scenario: A changed shard is reported as differing
    Given a copy of the committed index with one shard's text altered
    When it is compared with a fresh build
    Then the only finding is that shard ": differs"

  @test:test/id-lookup.test.ts::`--check`_catches_staleness::a_missing_shard
  Scenario: A missing shard is reported as missing
    Given a copy of the committed index with one shard deleted
    When it is compared with a fresh build
    Then the only finding is that shard ": missing"

  @test:test/id-lookup.test.ts::`--check`_catches_staleness::a_stale_shard_the_build_no_longer_writes
  Scenario: An extra shard the build does not write is reported as stale
    Given a copy of the committed index with an extra "community/pzz.json"
    When it is compared with a fresh build
    Then the only finding is "community/pzz.json: stale — the build no longer writes it"

  @test:test/id-lookup.test.ts::`--check`_catches_staleness::a_node_that_stops_being_referenced_makes_the_committed_index_stale
  Scenario: Dropping a referenced node makes the committed index stale
    Given an index rebuilt from the referenced entries without the first one
    When a copy of the committed index is compared with it
    Then at least one finding is reported

  @test:test/id-lookup.test.ts::the_build::an_empty_selection_is_refused_rather_than_written_as_an_index_that_answers_'absent'
  Scenario: Building from no entries is refused
    Given no entries
    When the lookup is built
    Then it throws with "no entries"

  @test:test/id-lookup.test.ts::the_build::ids_the_client_could_not_find_again_are_refused
  Scenario: Ids the client could not find again are refused at build
    Given an id without a namespace, an upper-case id, and the same id twice
    When the lookup is built from each
    Then each throws, naming "kind/local", "upper case" and "twice" respectively

  @test:test/id-lookup.test.ts::the_build::an_entry_larger_than_the_budget_is_refused,_not_written_over_it
  Scenario: An entry larger than the shard budget is refused
    Given an entry with a 500-character title and a budget of 200 bytes
    When the lookup is built
    Then it throws with "no prefix length"

  @test:test/id-lookup.test.ts::the_build::it_is_deterministic_whatever_the_input_order
  Scenario: The build output does not depend on input order
    Given four entries across the "item" and "community" namespaces and a budget of 120 bytes
    When the lookup is built from them and from them reversed
    Then both builds write the same files

  @test:test/id-lookup.test.ts::at_scale_(60,000_synthetic_IRIS-shaped_items)::every_shard_is_under_the_budget,_and_the_prefix_length_is_the_smallest_that_is
  Scenario: At scale every shard is under budget with the smallest prefix length that achieves it
    Given 60,000 synthetic IRIS-shaped item entries built into a lookup
    When the shards and the item prefix length are checked
    Then the prefix length is above 0
    And every shard is within the shard budget
    And the chosen prefix length equals the one choosePrefixLength gives
    And one character shorter would put some shard over the budget

  @test:test/id-lookup.test.ts::at_scale_(60,000_synthetic_IRIS-shaped_items)::every_id_resolves_with_exactly_one_shard_fetched,_and_an_unknown_one_is_absent
  Scenario: At scale every id resolves with one shard fetched and an unknown id is absent
    Given the browser client opened over the 60,000-entry synthetic lookup
    When every id is looked up
    Then each is found with exactly one shard fetched
    And a random unknown item id is "absent"
    And "item/a" is "too-short"

  @test:test/id-lookup.test.ts::the_client_and_the_build_name_shards_the_same_way::over_every_committed_id,_and_over_characters_that_need_escaping
  Scenario: The client and the build split ids and name shards the same way
    Given every committed referenced id plus ids with "/", "ä", "%20", "~", ".." and an empty local part
    When the client and the build split each id and name its shard at prefix lengths 0 to 4
    Then they agree every time
    And the shard of "item" local "a/b" at length 3 is "item/pa~2fb.json"

  @test:test/id-lookup.test.ts::the_manifest's_selection_does_not_depend_on_where_the_checkout_sits::the_whole_build_carries_no_checkout_path_in_its_manifest
  Scenario: The built manifest's selection carries no checkout path
    Given a build of the default source
    When its manifest selection is read
    Then it starts "every node under" followed by a relative path
    And it does not contain the source directory as a path prefix

  @test:test/id-lookup.test.ts::the_manifest's_selection_does_not_depend_on_where_the_checkout_sits::spellings_of_the_declared_path_agree
  Scenario: Different spellings of the declared path give the same selection
    Given the declared paths "catalogue", "catalogue/", "./catalogue/" and "catalogue//"
    When the nodes selection is computed for each with "nodes/"
    Then each is 'every node under catalogue/nodes/ whose materialization.state is "referenced"'
