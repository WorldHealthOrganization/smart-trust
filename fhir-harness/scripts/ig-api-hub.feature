Feature: The IG API hub page

  @test:scripts/ig-api-hub.test.ts::hubEntries::hubEntriesListBoundSidecars
  Scenario: lists each bound sidecar with its artefact, and a view only for a held schema or JSON-LD
    Given an artifact index with a ValueSet bound to an OpenAPI and a schema sidecar
    When the hub entries are listed
    Then they are the OpenAPI and schema files
    And the schema entry links the sidecar, a view page and its artefact's page
    And the OpenAPI entry has no view
    And the index has an IG API and an index with no artefacts has none

  @test:scripts/ig-api-hub.test.ts::igApiHubNode_and_igApiHubBody::hubNodeNamedByLabel
  Scenario: names the API by the label given and points the loader at the node from the page's place
    When the hub node is written with the label "Example API" and two documents
    Then it is named "Example API", documents "openapi/" and lists the documents sorted
    And the hub body points the loader at the node and the script relative to the page

  @test:scripts/ig-api-hub.test.ts::igApiHubPageOf_and_writeIgApiHubSite::hubPageAndSiteWritten
  Scenario: takes the IG's page holding the marker, else the default, and writes page, node and loader
    Given an IG page holding the hub marker
    Then the hub page is that page for that marker, and the default page for another marker or none
    When the hub site is written to "api.html"
    Then the page, node and loader script are written
    And the page is headed "Example API" and the node has 2 parts

  @test:scripts/ig-api-hub.test.ts::sidecarHref:_read_from_the_AST_cache_commit_when_the_index_says_so::sidecarHrefFromBaseOrLocalPath
  Scenario: a sidecar is linked at the index's sidecar base, else at its local path
    Given a sidecar bound at a local path
    Then without a base it is linked at the local path from the page, and with one at the base
    And the hub entries link the base while their view pages stay the site's
    And a hub document given as a URL is named by its file
