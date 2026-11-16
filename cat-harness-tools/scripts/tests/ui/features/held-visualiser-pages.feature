# A visualiser page a harness holds in its own docs directory (scripts/viewer-declarations.ts, scripts/compose-docs.ts),
# and wireframes read from every declared docs directory (scripts/check-wireframes.ts, scripts/wireframe-check.mjs).
# Each Scenario names the test that executes it.
Feature: Visualiser pages and wireframes held by their own harness

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::a_visualiser_page_its_own_harness_holds::is_found_by_its_declared_Tool,_at_the_unlocalised_route
  Scenario: A held visualiser page is found by its declared Tool at the unlocalised route
    Given a fixture checkout where "top" declares a "catalogue" visualiser rendered by "top-pages" and holds its page at "top/docs/catalogue/"
    When the held visualiser pages are listed
    Then exactly one is found, for harness "top", visualiser "catalogue", at route "top/catalogue/"
    And its directory is "top/docs/catalogue"

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::a_visualiser_page_its_own_harness_holds::a_page_at_a_visualiser's_id_that_its_Tool_did_not_draw_is_the_harness's_own_docs,_not_held
  Scenario: A page at a visualiser's id that its Tool did not draw is not held
    Given "top/docs/other/index.html" with no rendered-by front matter, at the id of the "other" visualiser
    When the held visualiser pages are listed
    Then none of them is the "other" visualiser

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::a_visualiser_page_its_own_harness_holds::the_docs_mount_leaves_it_out,_relative_to_the_mounted_directory
  Scenario: The docs mount leaves the held page out, relative to the mounted directory
    Given the held "catalogue" page under "top/docs"
    When the held visualiser paths are read for the "top/docs" mount
    Then they are ["catalogue"]
    And for the "top/notes" mount they are empty

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::a_visualiser_page_its_own_harness_holds::a_tile's_page_ref_names_it_where_the_site_publishes_it,_and_the_held_file_as_its_writer
  Scenario: A tile's page ref names where the site publishes it and the held file as its writer
    Given the held "catalogue" visualiser of "top"
    When its page ref is computed
    Then it is "base/docs/top/catalogue/index.html"
    And the viewer of the "top-catalogue" directory has that ref
    And its writer is ["top/docs/catalogue/index.html"]

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::a_visualiser_page_its_own_harness_holds::compose_lays_it_at_its_route,_and_keeps_a_page_the_tree_already_carries
  Scenario: Compose lays the held page at its route and keeps a page already there
    Given an empty output directory
    When the held visualiser pages are written into it
    Then "top/catalogue/data.json" and "top/catalogue/index.html" are written
    And the written index.html contains "rendered-by: top-pages"
    And nothing is written at "top/other"
    And when index.html is replaced with "kept" and the pages are written again, nothing is written
    And two collisions are reported
    And index.html still reads "kept"

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::wireframes_are_read_from_every_declared_`docs`_directory::an_instance's_second_docs_directory_is_a_source,_named_by_the_instance
  Scenario: An instance's second docs directory is a wireframe source named by the instance
    Given "top" declares a second docs directory "notes/" holding wireframes
    When the wireframe sources are listed
    Then they include "top/notes/wireframes" with prefix "top/"

  @test:scripts/tests/ui/held-visualiser-pages.test.ts::wireframes_are_read_from_every_declared_`docs`_directory::wireframe:check_finds_a_topic_there_with_no_candidate_given
  Scenario: wireframe:check finds a topic in the second docs directory with no candidate given
    Given an "as-is" wireframe for "catalogue" under "top/notes/wireframes/catalogue"
    When the asset directory is looked up from "top" with the as-is/catalogue suffixes
    Then it is "top/notes/wireframes/catalogue"
