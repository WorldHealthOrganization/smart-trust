# site-coverage: a built site carries every declared visualiser page of its
# checkout. Each Scenario names the test that executes it.
Feature: Site coverage of visualiser pages

  @test:scripts/tests/site-coverage.test.ts::missingPages::a_page_at_its_localised_route,_or_a_Jekyll_source_there,_is_present
  Scenario: A page at its localised route is present
    Given a site holding en/h/v/index.html
    Then the page expected at en/h/v/ is not missing

  @test:scripts/tests/site-coverage.test.ts::missingPages::a_page_only_at_its_old_address_is_not_missing,_and_is_counted_as_legacy
  Scenario: A page only at its legacy address is not missing but is legacy
    Given a site holding only h/w/index.md for the page expected at en/h/w/
    Then that page is not missing
    And it is the only legacy-only page

  @test:scripts/tests/site-coverage.test.ts::missingPages::a_page_at_neither_address_is_missing
  Scenario: A page at neither address is missing
    Then of the three expected pages only en/h/x/ is missing

  @test:scripts/tests/site-coverage.test.ts::missingPages::on_the_instance's_own_site,_its_page_at_the_site's_own_root_is_present_(who-iris_catalogue,_2026-10-15)
  Scenario: On an instance's own site its page at the root is present
    Given a page whose own-site route is x/ and a site holding x/index.html
    Then the page is not missing
    And the same page without an own-site route is missing

  @test:scripts/tests/site-coverage.test.ts::expectedPages_over_this_checkout::expects_the_library_index_and_a_page_per_instance_whose_library_has_entries
  Scenario: The library index and per-instance library pages are expected
    # Gap: checks that the library index is expected and that each per-instance page's route ends in /library/<instance>/; it does not check that every instance whose library has entries gets one.
    When the pages expected of this checkout are computed
    Then a library page with no instance ends in /library/
    And every per-instance library page's route ends in /library/<instance>/

  @test:scripts/tests/site-coverage.test.ts::expectedPages_over_this_checkout::a_staging-only_visualiser_is_expected_in_a_preview,_never_on_a_root_publish
  Scenario: A preview expects at least the pages a root publish does
    # Gap: asserts only that pages expected only in a preview name a harness and that a preview expects at least as many pages; it passes if no page is preview-only, and does not identify a staging-only visualiser.
    When the pages expected of a staging preview are computed
    Then every page expected only in the preview names a harness
    And the preview expects at least as many pages as the root publish

  @test:scripts/tests/site-coverage.test.ts::expectedPages_over_this_checkout::a_scoped_site_owes_no_page_of_a_layer_outside_its_scope_(owner,_2026-11-10)
  Scenario: A scoped site owes only its scope's pages
    Then the unscoped checkout expects some pages
    And a site scoped to an unknown instance expects none
    And a site scoped to cat-harness expects some, all of cat-harness

  @test:scripts/tests/site-coverage.test.ts::subjectInstances:_the_guard_asks_the_writer's_own_reader_which_instances_have_a_page::a_writer_with_a_reader_of_its_own_decides:_a_folder_of_scripts_is_not_a_Tool
  Scenario: A writer's own reader decides its subjects
    Given tools directories in cat-harness and smart-immunizations, each with a sub-directory
    And a tools-viewer reader returning cat-harness, smart-base and cat-harness again
    Then the subjects are cat-harness and smart-base, de-duplicated

  @test:scripts/tests/site-coverage.test.ts::subjectInstances:_the_guard_asks_the_writer's_own_reader_which_instances_have_a_page::a_writer_with_none_keeps_the_sub-directory_test
  Scenario: A writer without a reader uses the sub-directory test
    Then the library-viewer's subjects are cat-harness and smart-immunizations

  @test:scripts/tests/site-coverage.test.ts::subjectInstances:_the_guard_asks_the_writer's_own_reader_which_instances_have_a_page::a_reader_that_throws_falls_back_to_the_sub-directory_test_rather_than_expecting_nothing
  Scenario: A reader that throws falls back to the sub-directory test
    Given a tools-viewer reader that throws
    Then the subjects are cat-harness and smart-immunizations

  @test:scripts/tests/site-coverage.test.ts::ig-pages:_an_IG's_artefact_pages_are_owed_only_where_its_index_is_built_(smart-ra#103)::the_guard_reads_the_ig-pages_writer's_subjects,_and_owes_its_index_page_only_with_one
  Scenario: ig-pages has its own subject reader and needs a subject for its index
    Then the ig-pages subject reader is igIndexSubjects
    And ig-pages owes its index page only with a subject

  @test:scripts/tests/site-coverage.test.ts::ig-pages:_an_IG's_artefact_pages_are_owed_only_where_its_index_is_built_(smart-ra#103)::only_an_instance_whose_index.json_is_there_is_a_subject;_a_README_or_retired_sidecars_are_not
  Scenario: Only an instance with a built index.json is an ig-pages subject
    Given smart-trust's artefact index holds index.json and smart-base's holds a README and a dak folder
    Then the ig-pages subjects are smart-trust only, directly and through subjectInstances
    And smart-base alone gives no subject

  @test:scripts/tests/site-coverage.test.ts::ig-pages:_an_IG's_artefact_pages_are_owed_only_where_its_index_is_built_(smart-ra#103)::a_MOUNTED_layer's_index_written_to_the_layer_output_root_makes_it_a_subject_(bean_`cat-tools-sm8r`_item_4)
  Scenario: A mounted layer's index in the layer output root makes it a subject
    Given a mounted layer some-ig with an empty pinned artefact index
    Then it is not a subject
    And once build/layers/some-ig/fhir-artifact-index/index.json exists it is

  @test:scripts/tests/site-coverage.test.ts::web-app-build:_a_layer_that_carries_an_app_owes_the_apps_page_on_its_own_scoped_site_(smart-trust_onboarding_game)::the_guard_reads_the_apps_writer's_subjects,_and_owes_its_index_page_only_with_one
  Scenario: web-app-build has its own subject reader and needs a subject for its index
    Then the web-app-build subject reader is webAppSubjects
    And web-app-build owes its index page only with a subject

  @test:scripts/tests/site-coverage.test.ts::web-app-build:_a_layer_that_carries_an_app_owes_the_apps_page_on_its_own_scoped_site_(smart-trust_onboarding_game)::only_a_directory_holding_web-app.json_is_a_subject
  Scenario: Only a directory holding web-app.json is an app subject
    Given smart-trust's app directory holds web-app.json and another's does not
    Then the subjects are smart-trust only, directly and through subjectInstances
    And the other alone gives no subject

  @test:scripts/tests/site-coverage.test.ts::expectedPages_over_this_checkout:_tools::expects_a_tools_sub-graph_page_exactly_for_the_instances_the_tools_writer_draws
  Scenario: A tools page is expected exactly for the instances the tools writer draws
    # Gap: returns without asserting when the tools writer's subjects cannot be read in this checkout.
    When the tools writer's subjects are read
    Then the instances with an expected tools page equal those subjects

  @test:scripts/tests/site-coverage.test.ts::expectedPages_over_this_checkout:_schemas::the_guard_reads_the_schemas_writer's_own_subjects
  Scenario: The schemas guard reads the schemas writer's subjects
    # Gap: the comparison with expected pages is skipped when no schemas visualiser is declared in the checkout.
    Then a schemas-viewer subject reader exists and returns the schemas writer's subjects
    And when schemas pages are expected, their instances equal those subjects

  @test:scripts/tests/site-coverage.test.ts::instanceSubgraph:_subgraphUnder_nests_the_per-instance_page,_as_the_tiles_and_the_writer_do::the_glossary's_per-instance_page_is_at_instance/<instance>/
  Scenario: A subgraphUnder nests the per-instance page
    Then folio-assistant-core declared under "instance" has its page at instance/folio-assistant-core

  @test:scripts/tests/site-coverage.test.ts::instanceSubgraph:_subgraphUnder_nests_the_per-instance_page,_as_the_tiles_and_the_writer_do::a_visualiser_with_no_subgraphUnder_keeps_<instance>/
  Scenario: Without subgraphUnder the page stays at the instance name
    Then smart-base with no subgraphUnder has its page at smart-base
