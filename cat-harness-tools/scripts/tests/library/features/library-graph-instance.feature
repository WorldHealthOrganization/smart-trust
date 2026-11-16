# The instance a root-level library or upload queue belongs to is the root's
# declared name, not its clone folder (bean t5dm, issue #1904).
Feature: The instance a library directory is attributed to

  @test:scripts/tests/library/library-graph-instance.test.ts::instanceOf_(bean_t5dm)::a_root-level_directory_belongs_to_the_root's_declared_name,_whatever_the_clone_is_called
  Scenario: A root-level directory belongs to the declared name
    Given a repository cloned into folder "pr1290" that declares the name "folio-assistant"
    When the instance of its uploads directory is read
    Then it is "folio-assistant"

  @test:scripts/tests/library/library-graph-instance.test.ts::instanceOf_(bean_t5dm)::the_same_repository_cloned_under_two_folder_names_gives_one_answer
  Scenario: Two clones under different folder names give one answer
    Given the same declared repository cloned as "folio-assistant" and as "worktree-xyz"
    When the instance of each clone's uploads directory is read
    Then both answers are equal

  @test:scripts/tests/library/library-graph-instance.test.ts::instanceOf_(bean_t5dm)::a_sub-instance_is_its_path_inside_the_repository_—_unchanged_by_the_clone's_name
  Scenario: A sub-instance is named by its path inside the repository
    Given a repository cloned into folder "pr1290" holding who-iris/library
    When the instance of who-iris/library is read
    Then it is "who-iris"

  @test:scripts/tests/library/library-graph-instance.test.ts::instanceOf_(bean_t5dm)::a_root_that_declares_nothing_belongs_to_its_only_instantiated_harness,_not_its_folder
  Scenario: An undeclared root belongs to its only instantiated harness
    Given an undeclared root in folder "smart-trust" holding smart-base.config.json
    When the instance of its uploads directory is read
    Then it is "smart-base"

  @test:scripts/tests/library/library-graph-instance.test.ts::instanceOf_(bean_t5dm)::a_root_that_declares_nothing_and_decides_no_landing_harness_is_an_error,_not_a_guess
  Scenario: An undeclared root with no landing harness is an error
    Given an undeclared root in folder "bare-folio" with no harness config
    When the instance of its uploads directory is read
    Then it throws an error naming "issue #1904"

  @test:scripts/tests/library/library-graph-instance.test.ts::referencedCatalogueEntries::a_referenced_item_with_a_record_is_an_entry:_record,_XML,_KG_node,_Handle_and_its_upstream_files
  Scenario: A referenced catalogue item with a record is listed as an entry with its record, XML, KG node, Handle and upstream files
    Given an "iris" layer whose catalogue holds a referenced item with record 10665-1 and a published XML, a materialized item, and a referenced item whose record is missing
    When its referenced catalogue entries are listed
    Then the only entry is "10665-1", in instance "iris", titled "A referenced item", with provenance "catalogued"
    And its catalogue names the record "iris/catalogue/records/10665-1.dc.json", Handle "10665/1", XML "iris/dublin-core/10665-1.dc.xml" and node "iris/catalogue/nodes/item-a.json"
    And its upstream is only the ORIGINAL file "a.pdf" at its download link, and its source file is "a.pdf"

  @test:scripts/tests/library/library-graph-instance.test.ts::referencedCatalogueEntries::the_XML's_site_path_names_the_DECLARED_layer,_not_the_checkout_directory_(a_clone_at_iris-217/_serves_/iris/)
  Scenario: The XML's site path names the declared layer, not the checkout directory
    Given the same layer checked out in a directory "iris-217" but declared as "iris"
    When its referenced catalogue entries are listed
    Then the entry's XML path is "iris/dublin-core/10665-1.dc.xml"

  @test:scripts/tests/library/library-graph-instance.test.ts::referencedCatalogueEntries::an_id_a_held_entry_already_uses_is_skipped
  Scenario: An id a held entry already uses is skipped
    Given the same layer, with "iris/10665-1" already held
    When its referenced catalogue entries are listed
    Then there are none

  @test:scripts/tests/library/library-graph-instance.test.ts::referencedCatalogueEntries::an_id_held_in_ANOTHER_layer_is_skipped_too:_the_site_has_one_entry_per_id
  Scenario: An id held in another layer is skipped too
    Given the same layer, with "who-iris/10665-1" already held
    When its referenced catalogue entries are listed
    Then there are none

  @test:scripts/tests/library/library-graph-instance.test.ts::referencedCatalogueEntries::a_record_two_layers'_catalogues_both_hold_is_listed_once
  Scenario: A record two layers' catalogues both hold is listed once
    Given the same layer and a copy of it declared as "iris2"
    When the referenced catalogue entries of both are listed
    Then the only entry is "iris/10665-1"
