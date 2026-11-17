Feature: Pages viewing an artefact's IG API sidecars

  @test:scripts/ig-api-views.test.ts::IG_API_views::viewsForHeldSidecarsOnly
  Scenario: has a page for each HELD schema and JSON-LD sidecar, in the Publisher's tab order, and none for displays
    Given an artefact holding schema, JSON-LD and displays sidecars
    Then it has views for the schema and the JSON-LD, in that order
    And an artefact whose schema is only referenced by URL has no views

  @test:scripts/ig-api-views.test.ts::IG_API_views::tabsNarrativeJsonViews
  Scenario: tabs: narrative, JSON (no XML or TTL), then the IG API views with this one active
    When the JSON-LD view's data is built
    Then its tabs are Narrative Content, JSON, JSON Schema and JSON-LD, with JSON-LD active
    And the narrative tab links the artefact page, the label is "JSON-LD" and the loader script is one level up
    And the source is the served sidecar, and the data carries no file text
    And with the index's sidecar base the file is fetched there

  @test:scripts/ig-api-views.test.ts::IG_API_views::loaderPrettyPrintsJson
  Scenario: the loader shows the file as the Publisher does: JSON.stringify(parsed, null, 2)
    Given the view loader script
    Then it shows the file as JSON.stringify of the parsed data with an indent of 2

  @test:scripts/ig-api-views.test.ts::IG_API_views::templateOpensWithComment
  Scenario: the template is a file that opens with the comment describing it, and computes nothing
    Given the view template file
    Then it starts with a Liquid comment and uses no plus, minus, size, replace or jsonify filter

  @test:scripts/ig-api-views.test.ts::IG_API_views::jsonTabOnlyWhenWritten
  Scenario: the JSON tab is this site's view only when that page is written
    Given an artefact published with a JSON representation
    Then its JSON tab links the published JSON
    And when this site writes the JSON page, the tab links that page

  @test:scripts/ig-api-views.test.ts::igApiServed_finds_the_declaration_by_its_own_name,_not_the_directory's_(bean_rbz3)::servedFoundBySelfName
  Scenario: a separated IG keeps its data under a directory not named after it, and its declaration is still <name>.json
    Given an IG's data directory "ig-data" holding a declaration named "acme-ig" with a served artifact index
    Then the IG API is served
    Given the same declaration in a file named after the directory
    Then it is not served, because the directory holds no instance declaration
