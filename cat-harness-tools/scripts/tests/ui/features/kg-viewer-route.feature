# scripts/kg-viewer.ts: where the knowledge-graph viewer page is published, where it reads its graph from,
# and how the old <stub>/ address forwards to it. Each Scenario names the test that executes it.
Feature: Knowledge-graph viewer route

  @test:scripts/tests/ui/kg-viewer-route.test.ts::kg-viewer_route::the_viewer_is_published_at_<locale>/<stub>/kg/
  Scenario: The viewer is published at <locale>/<stub>/kg/
    Given the stub "cat-harness"
    When its viewer route is computed
    Then it is "en/cat-harness/kg/"
    And the way up from that route is "../../../"

  @test:scripts/tests/ui/kg-viewer-route.test.ts::kg-viewer_route::the_page_reads_its_graph_from_the_site_root,_and_the_old_address_forwards
  Scenario: The viewer page reads its graph from the site root, and the old address forwards
    Given an empty site directory
    When the "cat-harness" viewer is written with a page that names its graph relative to the way up
    Then the page reads "doc=../../../cat-harness.jsonld"
    And the forwarding page at the old address replaces location with "../en/cat-harness/kg/"

  @test:scripts/tests/ui/kg-viewer-route.test.ts::kg-viewer_route::the_page_reads_<name>/<stub>.jsonld,_the_host's_included
  Scenario: The viewer page reads <name>/<stub>.jsonld, the host's included
    Given the viewer HTML for "cat-harness" with the way up "../../../"
    When it is generated
    Then it names "../../../cat-harness/cat-harness.jsonld"
    And it does not name the old root "../../../cat-harness.jsonld"
    And with the way up "../" and the document "x/y.jsonld" it names "../x/y.jsonld"

  @test:scripts/tests/ui/kg-viewer-route.test.ts::kg-viewer_route::a_page_already_at_<stub>/_is_the_instance's,_and_is_not_replaced
  Scenario: A page already at <stub>/ belongs to the instance and is not replaced
    Given a site where "cat-harness/index.html" already reads "instance"
    When the "cat-harness" viewer is written
    Then no forwarding page is written
    And "cat-harness/index.html" still reads "instance"
    And the viewer page exists at "en/cat-harness/kg/index.html"
