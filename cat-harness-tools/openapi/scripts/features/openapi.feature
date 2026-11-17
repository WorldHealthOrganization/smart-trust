# Specifies the OpenAPI scripts: operationsOf, the config and committed checks (ingest-openapi.ts),
# smart-trust's gateway pages (gen-openapi-pages.ts), the typology's validators, and ig-site-openapi.ts.
# Each Scenario names the test that executes it.
Feature: An OpenAPI document's operations are listed, its config and copy are checked, and its pages are written

  @test:openapi/scripts/openapi.test.ts::operationsOf::uses_the_document's_operationId,_in_path_order_then_OpenAPI's_method_order
  Scenario: Operations take their operationId, in path order then OpenAPI's method order
    Given a document with "/a" holding post "makeA" and get "getA", and "/b" holding a delete with no operationId
    When its operations are listed
    Then they are "getA" get, "makeA" post and "delete-b" delete, in that order
    And the delete's id is marked as not declared

  @test:openapi/scripts/openapi.test.ts::operationsOf::derives_a_filename-safe_id_when_there_is_no_operationId
  Scenario: An operation with no operationId gets a filename-safe id
    When a fallback id is made for get "/trustList/{type}/{country}" and for get "/"
    Then they are "get-trustList-type-country" and "get-root"

  @test:openapi/scripts/openapi.test.ts::operationsOf::refuses_two_operations_that_would_share_an_id_rather_than_suffixing_one
  Scenario: Two operations that would share an id are refused
    Given a document whose "/a" and "/b" gets both declare operationId "x"
    When its operations are listed
    Then it throws saying they share the id "x"

  @test:openapi/scripts/openapi.test.ts::operationsOf::ignores_path-item_keys_that_are_not_operations_(parameters,_summary)
  Scenario: Path-item keys that are not operations are ignored
    Given a document whose "/a" holds "parameters", "summary" and a get
    When its operations are listed
    Then the only operation is "get-a"

  @test:openapi/scripts/openapi.test.ts::cat-openapi.config.json::smart-trust's_config_is_found,_and_parses
  Scenario: smart-trust's config is found inside its openapi directory, and parses
    Given the smart-trust layer in the checkout
    When its config path is found
    Then it is "smart-trust/openapi/cat-openapi.config.json"
    And the file passes the config schema

  @test:openapi/scripts/openapi.test.ts::cat-openapi.config.json::refuses_a_document_id_declared_twice
  Scenario: A config naming the same document id twice is refused
    Given a config whose documents list holds the same document "x" twice
    When it is checked against the config schema
    Then it fails

  @test:openapi/scripts/openapi.test.ts::the_committed_gateway_API::is_held_and_matches_its_provenance
  Scenario: The committed gateway API is held and matches its provenance
    Given the smart-trust layer
    When its committed OpenAPI documents are checked
    Then there is no problem

  @test:openapi/scripts/openapi.test.ts::the_committed_gateway_API::a_hand_edit_to_the_document_is_caught
  Scenario: A hand edit to the committed gateway document is caught
    Given a copy of smart-trust's declaration and openapi directory
    When "Uploads Trusted Certificate" in "gateway.openapi.json" is changed to "Uploads A Certificate"
    Then the committed check says the document does not match its provenance

  @test:openapi/scripts/openapi.test.ts::the_committed_gateway_API::a_config_kept_INSIDE_the_declared_openapi_directory_is_found,_and_one_at_the_root_wins
  Scenario: A config inside the openapi directory is found, and one at the layer root wins
    Given a copy of smart-trust's declaration and openapi directory, with the config inside "openapi/"
    When its config path is found
    Then it is the copy inside "openapi/", and the committed check finds no problem
    And once a config is also put at the layer root, the root one is found

  @test:openapi/scripts/openapi.test.ts::pages::one_page_per_operation,_plus_the_document's
  Scenario: The gateway has one page per operation, plus the document's
    # Skipped: when the checkout holds no smart-trust layer
    Given smart-trust's gateway pages
    Then "gateway.jsonld" lists 22 supported operations
    And there are 23 pages

  @test:openapi/scripts/openapi.test.ts::pages::every_operation's_@id_is_its_JSON-LD's_address_less_`.jsonld`,_under_the_singular_kind_`operation/`
  Scenario: Each operation's @id is its JSON-LD address without ".jsonld", under "operation/"
    # Skipped: when the checkout holds no smart-trust layer
    Given smart-trust's gateway pages
    Then there are 22 JSON-LD files under "gateway/operation/"
    And each one's "@id" is the smart-trust openapi IRI base plus its path without ".jsonld"

  @test:openapi/scripts/openapi.test.ts::pages::a_page_copies_nothing_of_the_API:_it_declares_its_node,_at_its_IRI,_and_names_the_document_relative_to_itself
  Scenario: A page declares its node at its IRI, names the document relative to itself, and copies nothing of the API
    # Skipped: when the checkout holds no smart-trust layer
    # Gap: only one sample of the API's text is checked for absence
    Given smart-trust's gateway pages
    Then each page's "data-kg-openapi" is "gateway.openapi.json" relative to the page's depth
    And each page declares its node with no problem, at the IRI of its directory
    And no page contains "Base64 encoded CMS"

  @test:openapi/scripts/openapi.test.ts::openapi_typology_validators::every_declared_family_in_openapi/typologies/openapi.json_resolves_to_a_validator_and_valid_schema
  Scenario: Every family the openapi typology declares resolves to a validator and a Zod schema
    Given the families declared in "openapi/typologies/openapi.json", at least one
    When the openapi node schemas are resolved
    Then each family has a validator node for kind "openapi" and that family
    And each resolves to a Zod schema

  @test:openapi/scripts/openapi.test.ts::ig-site:openapi_—_an_IG_repository's_OpenAPI_pages,_with_no_declaration_(owner,_2026-10-14)::finds_the_graph_by_what_the_checkout_holds,_and_none_where_it_holds_none
  Scenario: An IG repository's OpenAPI graph is found by what it holds, and none where it holds none
    Given an IG checkout with "openapi/cat-openapi.config.json" and an ingested document "gateway"
    When its OpenAPI graph is found
    Then it names that config and the "openapi" directory
    And an empty checkout has no graph

  @test:openapi/scripts/openapi.test.ts::ig-site:openapi_—_an_IG_repository's_OpenAPI_pages,_with_no_declaration_(owner,_2026-10-14)::writes_the_documents_and_a_page_per_document_and_operation_at_openapi/,_the_graph's_index_included
  Scenario: An IG site gets the documents and a page per document and operation at "openapi/"
    Given the IG checkout with "gateway" and an empty site
    When its OpenAPI pages are written into the site
    Then the document, its provenance, the index, the document page, and the "getX" page and JSON-LD are listed and written
    And the "getX" JSON-LD names its IRI ending "/openapi/gateway/operation/getX"

  @test:openapi/scripts/openapi.test.ts::ig-site:openapi_—_an_IG_repository's_OpenAPI_pages,_with_no_declaration_(owner,_2026-10-14)::refuses_to_write_over_a_path_the_site_already_holds
  Scenario: Writing over a path the site already holds is refused
    Given the IG checkout and a site already holding "openapi/index.html"
    When its OpenAPI pages are written into the site
    Then it throws saying the site already holds "openapi/index.html"

  @test:openapi/scripts/openapi.test.ts::ig-site:openapi_—_an_IG_repository's_OpenAPI_pages,_with_no_declaration_(owner,_2026-10-14)::a_checkout_with_no_OpenAPI_graph_writes_nothing
  Scenario: A checkout with no OpenAPI graph writes nothing
    Given an empty checkout and an empty site
    When its OpenAPI pages are written into the site
    Then no path is written
