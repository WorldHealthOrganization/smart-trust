# A remote mount's integrity digest leaves out what the layer declares it
# builds at publish, in every directory the lock pins of it (cat-tools-sm8r,
# cat-harness-tools#1701). Each Scenario names the test that executes it.
Feature: The mount digest leaves out what is built at publish

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::builtAtPublishOf::at_the_instance_root,_the_entries_as_declared
  Scenario: At the instance root the entries are as declared
    Then the instance's built-at-publish entries include fhir-artifact-index/index.json

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::builtAtPublishOf::in_a_pinned_sub-directory,_the_instance's_entries_rebased_onto_it
  Scenario: In a pinned sub-directory the entries are rebased onto it
    Then in fhir-artifact-index they are index.json and sidecars/
    And in document-kinds there are none

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::builtAtPublishOf::a_directory_the_instance_declares_built_as_a_whole_excludes_all_of_its_files
  Scenario: A directory declared built as a whole excludes all its files
    Then removing built-whole's entries from its files leaves nothing

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::builtAtPublishOf::a_directory_of_an_instance_with_no_declaration_borrows_nothing,_and_the_walk_stops_at_the_index
  Scenario: An instance with no declaration borrows nothing
    Then a directory of a layer with no declaration has no entries, the walk stopping at the index

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::the_digest_of_a_pinned_sub-directory::is_the_same_before_and_after_its_declared_outputs_are_built
  Scenario: The digest of a pinned sub-directory is unchanged when its declared outputs are built
    Given the digest of fhir-artifact-index
    When index.json and a sidecar are written
    Then the digest is the same and the covered files are only pinned.json

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::the_digest_of_a_pinned_sub-directory::still_moves_for_an_undeclared_file,_or_a_changed_pinned_byte
  Scenario: The digest still moves for an undeclared file or a changed pinned byte
    Then adding an undeclared file changes the tree digest
    And changing pinned.json changes it

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::a_bare_`<name>.json`_declaration_(bootstrap's_form)::its_builtAtPublish_entries_are_read
  Scenario: A bare <name>.json declaration's entries are read
    Then the built-at-publish entries of a layer declaring itself without $schema are ns.context.v1.jsonld

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::a_bare_`<name>.json`_declaration_(bootstrap's_form)::so_the_digest_is_the_same_before_and_after_the_declared_file_is_built
  Scenario: The bare-declared layer's digest is unchanged when its declared file is built
    When ns.context.v1.jsonld is written into it
    Then its digest is the same

  @test:scripts/tests/mount-digest-built-at-publish.test.ts::a_bare_`<name>.json`_declaration_(bootstrap's_form)::a_JSON_file_that_does_not_name_itself_declares_nothing
  Scenario: A JSON file that does not name itself declares nothing
    Then a directory whose JSON file names something else has no entries
