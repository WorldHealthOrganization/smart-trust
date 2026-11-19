# Specifies openapi/scripts/gen-openapi-viewer.ts with --site: the openapi viewer's
# hub and per-instance pages written into a site, and its --check.
# Each Scenario names the test that executes it.
Feature: The OpenAPI viewer writes its hub and per-instance pages into a site

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::the_Tool_declares_the_kind_it_renders_and_takes_no_required_input
  Scenario: The viewer's Tool renders "openapi" and takes no required input
    Given the harness's Tool definitions
    When the viewer's Tool is looked up by its id
    Then it renders "openapi"
    And none of its inputs is required

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::writes_everything_under_the_declared_route:_the_hub,_and_per_instance_its_pages
  Scenario: Everything is written under the declared route: the hub and each instance's pages
    Given a scratch checkout with a harness declaring the openapi visualiser, an instance "api" with one document "gateway", and an instance "broken" with no config
    When the viewer is run into a site
    Then it exits 0 and every file is under "en/harness/openapi"
    And the hub, "api/", "api/gateway/", the operation page and JSON-LD for "getX", and "broken/" are written
    And every HTML file names "openapi-pages" as what rendered it

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::copies_each_document_beside_the_pages_that_fetch_it
  Scenario: Each document is copied beside the pages that fetch it
    Given the viewer has run into the site
    Then "api/gateway.openapi.json" equals the instance's document
    And the document's page refers to "../gateway.openapi.json"
    And the provenance file "gateway.source.json" is not copied

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::a_graph_that_does_not_read_is_unknown,_with_why,_on_the_hub_and_its_own_page
  Scenario: A graph that does not read is shown as unknown, with why, on the hub and its own page
    Given the viewer has run into the site
    Then the hub says "unknown"
    And the "broken" page says "unknown, not none" and names "cat-openapi.config.json"

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::authored_text_is_escaped,_and_never_reaches_Liquid
  Scenario: Authored text is escaped, and pages turn Liquid off
    # Gap: only the hub's front matter is checked for render_with_liquid
    Given the viewer has run into the site
    Then the "getX" operation page shows its summary as "Read &lt;x&gt;"
    And the hub's front matter sets "render_with_liquid: false"

  @test:openapi/scripts/gen-openapi-viewer.test.ts::gen-openapi-viewer_--site::--check_passes_on_what_it_wrote_and_fails_on_a_changed_or_orphaned_file
  Scenario: The check passes on what was written and fails on a changed or orphaned file
    Given the viewer has run into the site
    When it is run with "--check"
    Then it exits 0
    And after the copied document is changed, the check exits 1
    And after a rerun and an orphan page "gone/index.html" is added, the check exits 1
    And after another rerun, the check exits 0
