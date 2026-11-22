# A mounted layer's computed files go to build/layers/<instance>/, a local
# layer's stay inside it, and a reader sees the computed file over the pinned
# bytes (cat-tools-sm8r). Each Scenario names the test that executes it.
Feature: The layer output resolver

  @test:scripts/tests/layer-output.test.ts::mountedInstances::reads_the_lock's_instances_and_their_mount_paths
  Scenario: The lock's instances and their mount paths are the mounted instances
    Given a lock naming upper-ig and lower at their paths
    When the mounted instances are read
    Then they are upper-ig at upper-ig and lower at lower, in lock order

  @test:scripts/tests/layer-output.test.ts::mountedInstances::no_lock:_nothing_is_mounted
  Scenario: With no lock nothing is mounted
    Given a checkout with no index.lock.json
    When the mounted instances are read
    Then there are none

  @test:scripts/tests/layer-output.test.ts::mountedInstances::a_lock_that_does_not_parse_throws_rather_than_reading_as_'nothing_mounted'
  Scenario: A lock that does not parse throws
    Given an index.lock.json that is not JSON
    When the mounted instances are read
    Then it throws saying the mounts cannot be determined

  @test:scripts/tests/layer-output.test.ts::outputPathFor::a_mounted_instance_writes_under_build/layers/<instance>/
  Scenario: A mounted instance writes under build/layers/<instance>/
    Given upper-ig is mounted
    When the output path of one of its files is resolved
    Then it is that file under the layer output root's upper-ig directory

  @test:scripts/tests/layer-output.test.ts::outputPathFor::a_local_instance_writes_inside_itself,_as_before
  Scenario: A local instance writes inside itself
    Given an instance the lock does not name, and an instance at the checkout root
    When the output path of a file in each is resolved
    Then each is the file in the instance's own directory

  @test:scripts/tests/layer-output.test.ts::readPathFor::the_computed_file_wins_over_the_pinned_bytes
  Scenario: The computed file wins over the pinned bytes
    Given a mounted file both pinned in the mount and computed under the output root
    When its read path is resolved
    Then it is the computed file

  @test:scripts/tests/layer-output.test.ts::readPathFor::with_nothing_computed,_the_reader_falls_back_to_the_mount
  Scenario: With nothing computed the reader falls back to the mount
    Given a mounted instance with no computed file
    When a file's read path is resolved
    Then it is the file in the mount

  @test:scripts/tests/layer-output.test.ts::outputTwinOf_/_readPathAt_—_a_reader_holding_an_absolute_path::a_path_in_a_mounted_layer_has_a_twin_under_the_output_root;_a_local_or_outside_path_has_none
  Scenario: Only a path in a mounted layer has an output twin
    When the output twin is asked of a path inside upper-ig and of upper-ig itself
    Then each is the same path under the output root
    And a sibling directory sharing the prefix, a local instance's path, and a path outside the checkout have none

  @test:scripts/tests/layer-output.test.ts::outputTwinOf_/_readPathAt_—_a_reader_holding_an_absolute_path::the_twin_when_it_exists,_else_the_path_itself_—_no_writer_at_the_output_root_changes_nothing
  Scenario: An absolute path reads its twin when the twin exists, else itself
    Given a file in upper-ig with no computed twin
    When its read path is resolved it is the file itself
    And once the twin is written, the file and its directory each resolve to the twin
    And a local instance's file resolves to itself

  @test:scripts/tests/layer-output.test.ts::writePathAt_—_a_writer_holding_an_absolute_path::a_path_in_a_mounted_layer_is_written_at_its_twin;_a_local_or_outside_path_where_it_is
  Scenario: A writer writes a mounted layer's path at its output twin and any other path where it is
    When the write path is asked of a path inside upper-ig
    Then it is the same path under the output root
    And a local instance's path and a path outside the checkout are written where they are

  @test:scripts/tests/layer-output.test.ts::writePathAt_—_a_writer_holding_an_absolute_path::what_a_writer_wrote_is_what_readPathAt_reads_back
  Scenario: What a writer wrote is what the overlay read returns
    Given a page of a mounted layer written through its write path
    When its read path is resolved
    Then it is the file the writer wrote

  @test:scripts/tests/layer-output.test.ts::writePathAt_—_a_writer_holding_an_absolute_path::the_root_is_always_the_first_argument,_and_a_given_mounted_map_is_used_without_reading_the_lock
  Scenario: The root is always the first argument, and a given mounted map is used without reading the lock
    Given a checkout with no lock and a mounted map naming lower at lower
    When the write path of a page in lower is asked with that map
    Then it is the page under the output root
    And without the map it is the page itself, and a path outside the root is written where it is

  @test:scripts/tests/layer-output.test.ts::derive-at-publish_built()_—_an_artefact_of_a_mounted_layer_built_at_its_output_root::a_declared_artefact_counts_as_built_when_only_its_output-root_twin_holds_it
  Scenario: An artefact of a mounted layer counts as built when only its output-root twin holds it
    Given a declared file and a declared directory of a mounted layer, neither built
    When each is written only at its output-root twin
    Then each counts as built

  @test:scripts/tests/layer-output.test.ts::overlayPath_(step_5:_the_QA_readers)::the_checkout_is_the_nearest_directory_holding_.git,_not_a_mount_carrying_its_own_lock
  Scenario: The checkout is the nearest directory holding .git, not a mount carrying its own lock
    Given a checkout holding .git and a mounted lower directory carrying its own index.lock.json
    When the checkout root is resolved from inside the mounted lower directory
    Then it is the outer checkout holding .git

  @test:scripts/tests/layer-output.test.ts::overlayPath_(step_5:_the_QA_readers)::outside_a_checkout_the_path_is_unchanged
  Scenario: Outside a checkout the path is unchanged
    Given a path with no checkout root
    When its overlay path is resolved
    Then the path is returned unchanged

  @test:scripts/tests/layer-output.test.ts::overlayPath_(step_5:_the_QA_readers)::reads_the_computed_twin_over_the_pinned_bytes,_and_the_mount_when_there_is_none
  Scenario: overlayPath reads the computed twin over the pinned bytes, and the mount when there is none
    Given a pinned QA result file in a mounted lower layer
    When its overlay path is resolved before and after its computed twin is written
    Then it resolves to the pinned path first and to the computed twin once written

  @test:scripts/tests/layer-output.test.ts::overlayPath_(step_5:_the_QA_readers)::an_unparseable_lock:_a_reader_falls_back_to_the_pinned_path
  Scenario: With an unparseable lock a reader falls back to the pinned path
    Given a checkout whose index.lock.json is not valid JSON
    When overlayPath resolves a path inside a mounted directory
    Then it falls back to the pinned path

  @test:scripts/tests/layer-output.test.ts::the_QA_inventory_and_publish_see_the_overlay_(step_5)::movedInventory_is_the_union,_keyed_by_the_layer's_own_path,_the_output_root_winning
  Scenario: movedInventory is the union keyed by the layer's own path with the output root winning
    Given a mounted layer with pinned QA results and computed QA results under the output root
    When movedInventory is computed for the layer's results directory
    Then it returns the union keyed by the layer's own path with the output root winning on collisions

  @test:scripts/tests/layer-output.test.ts::the_QA_inventory_and_publish_see_the_overlay_(step_5)::overlayEntries_names_each_computed_file_at_its_logical_path
  Scenario: overlayEntries names each computed file at its logical path
    Given a mounted layer with computed QA results under the output root
    When overlayEntries is computed for the layer's results directory
    Then each computed file is listed with its logical path and its output-root path

  @test:scripts/tests/layer-output.test.ts::the_QA_inventory_and_publish_see_the_overlay_(step_5)::with_nothing_mounted,_both_are_what_they_were
  Scenario: With nothing mounted both movedInventory and overlayEntries are what they were
    Given a checkout with no mounted layers and a local results directory
    When movedInventory and overlayEntries are computed
    Then movedInventory lists the local files and overlayEntries is empty

  @test:scripts/tests/layer-output.test.ts::writePathOf_and_overlayDirs_(step_5:_the_QA_writers)::a_mounted_layer's_path_is_written_under_build/layers/<instance>/
  Scenario: A mounted layer's path is written under the layer output root
    Given a checkout whose lock mounts a lower layer
    When a writer resolves a results path inside the lower mount
    Then it writes under build/layers/lower/ at the same instance-relative path

  @test:scripts/tests/layer-output.test.ts::writePathOf_and_overlayDirs_(step_5:_the_QA_writers)::a_local_layer's_path,_and_one_outside_the_checkout,_are_written_where_they_are
  Scenario: A local layer's path, and one outside the checkout, are written where they are
    Given a checkout whose lock mounts a lower layer
    When a writer resolves a path in a local layer, or outside the checkout
    Then the path is unchanged

  @test:scripts/tests/layer-output.test.ts::writePathOf_and_overlayDirs_(step_5:_the_QA_writers)::a_writer_refuses_an_unparseable_lock_rather_than_writing_into_the_mounts
  Scenario: A writer refuses an unparseable lock rather than writing into the mounts
    Given a checkout whose index.lock.json is not valid JSON
    When a writer resolves a path inside a mounted directory
    Then it throws rather than reading the lock as nothing mounted

  @test:scripts/tests/layer-output.test.ts::writePathOf_and_overlayDirs_(step_5:_the_QA_writers)::overlayDirs_lists_the_output_root_first,_then_the_layer's_own_directory,_each_only_if_it_exists
  Scenario: overlayDirs lists the output root first, then the layer's own directory
    Given a mounted layer's results directory and its output-root twin
    When the directories a reader lists are resolved as each comes to exist
    Then only existing ones are listed, the output root first

  @test:scripts/tests/layer-output.test.ts::writePathOf_and_overlayDirs_(step_5:_the_QA_writers)::a_file_written_via_writePathOf_is_read_back_via_overlayPath_over_the_pinned_copy
  Scenario: A file written via writePathOf is read back via overlayPath over the pinned copy
    Given a mounted layer with a pinned result file and a twin written via writePathOf
    When overlayPath resolves the pinned result path
    Then it returns the output-root twin written via writePathOf

  @test:scripts/tests/layer-output.test.ts::checkNavNames_—_reads_a_mounted_layer's_docs_surfaces_from_its_output-root_twin::reads__data/harness.json,_navbar-footer.html,_railed_html_pages,_and_rail_data_from_build/layers/<instance>/
  Scenario: checkNavNames reads a mounted layer's docs surfaces from its output-root twin
    Given a checkout where cat-harness is mounted and its generated docs surfaces live under build/layers/cat-harness/docs/
    When checkNavNames inspects the checkout
    Then it reads the output-root docs surfaces and passes with no failures
