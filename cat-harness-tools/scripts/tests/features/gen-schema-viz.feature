# scripts/gen-schema-viz.ts writes the schemas visualiser page (viewerHtml) and reads the source
# descriptors a schemas directory holds into the rows of its source-descriptor table.
# Each Scenario names the test that executes it.
Feature: The schemas visualiser

  @test:scripts/tests/gen-schema-viz.test.ts::schemas_visualiser_wireframe_fixes_(folio-assistant-nnpk)::Finding_1:_smooth-scrolls_and_focuses_into_#detail_when_selecting_on_small_viewports
  Scenario: Selecting a declaration on a small viewport scrolls and focuses the detail panel
    # Gap: only the generated page text is checked; no selection is run in a browser
    Given the schemas visualiser page for "cat-harness"
    When its HTML is read
    Then the detail section is "<section id=\"detail\" tabindex=\"-1\""
    And the script smooth-scrolls the detail panel into view and calls "dt.focus()"
    And the script tests for "window.innerWidth <= 640"

  @test:scripts/tests/gen-schema-viz.test.ts::schemas_visualiser_wireframe_fixes_(folio-assistant-nnpk)::Finding_2:_sets_compact_#items_max-height_on_small_viewports_to_prevent_nested_scroll_trapping
  Scenario: The item list is capped at 35vh on small viewports
    # Gap: only the CSS text is checked; no scrolling is exercised
    Given the schemas visualiser page for "cat-harness"
    When its HTML is read
    Then a "max-width: 640px" media rule sets ".sc-page ul#items" to "max-height: 35vh"

  @test:scripts/tests/gen-schema-viz.test.ts::schemas_visualiser_wireframe_fixes_(folio-assistant-nnpk)::Finding_3:_points_to_filter_below_and_collapses_empty_#ov-svg
  Scenario: The diagram instruction points to the filter below and an empty diagram is hidden
    Given the schemas visualiser page for "cat-harness"
    When its HTML is read
    Then it says "Pick a <b>module</b> in the filter below and the diagram for it appears here."
    And it never says the filter is above
    And it carries the rule "#ov-svg:empty { display: none; }"

  @test:scripts/tests/gen-schema-viz.test.ts::schemas_visualiser_wireframe_fixes_(folio-assistant-nnpk)::Finding_4:_field_table_prevents_mid-token_identifier_breakage
  Scenario: The field table does not break identifiers mid-token
    # Gap: only the CSS text is checked; no rendering is measured
    Given the schemas visualiser page for "cat-harness"
    When its HTML is read
    Then table code cells use "word-break: normal" with "overflow-wrap: anywhere", both generally and under "#detail"
    And the first-column field names in "#detail" use "white-space: nowrap"

  @test:scripts/tests/gen-schema-viz.test.ts::schemas_visualiser_wireframe_fixes_(folio-assistant-nnpk)::Finding_5:_UML_box_truncation_is_stated,_through_the_one_shared_renderer
  Scenario: The UML box states what it truncates, drawn by the shared renderer
    # Gap: only the script text is checked; the drawing itself is tested in class-diagram.test.ts
    Given the schemas visualiser page for "cat-harness"
    When its HTML is read
    Then it carries the shared classDiagram renderer and calls it for the selected type
    And a box with more rows than it shows ends with "… n more"
    And a clipped name or type ends in an ellipsis

  @test:scripts/tests/gen-schema-viz.test.ts::source_descriptors_in_a_schemas_directory_(folio-assistant-1nu0)::reads_only_folio-source-descriptor/v1_files,_attributed_to_the_instance_holding_them
  Scenario: Only source descriptor files become rows, attributed to their instance
    Given a directory "inst/sources" holding the descriptors "demo" and "broken", a "concern-groups/v1" file and a JSON Schema file
    When the source descriptor rows are read for "inst/sources"
    Then the rows are "broken" and "demo", in that order
    And every row's instance is "inst"

  @test:scripts/tests/gen-schema-viz.test.ts::source_descriptors_in_a_schemas_directory_(folio-assistant-1nu0)::carries_what_the_descriptor_says_about_enumerating_it,_with_the_request_cost_derived
  Scenario: A valid descriptor's row carries its enumeration with the request count derived
    Given a valid descriptor "demo" with page size 10 and 95 total nodes
    When the source descriptor rows are read
    Then its row has the title "Demo corpus", the system "DSpace 7" and the file "inst/sources/demo.json"
    And its enumeration is "page the REST API" with page size 10, 95 nodes and 10 requests
    And its identifiers are the authoritative "Handle" with example "1/2"
    And it has no note

  @test:scripts/tests/gen-schema-viz.test.ts::source_descriptors_in_a_schemas_directory_(folio-assistant-1nu0)::lists_a_descriptor_that_fails_its_schema,_and_says_why,_rather_than_dropping_it
  Scenario: A descriptor that fails its schema is listed with a note saying why
    Given a descriptor "broken" with only an id and the title "Broken"
    When the source descriptor rows are read
    Then its row has the title "Broken"
    And its note says it "does not satisfy folio-source-descriptor/v1"

  @test:scripts/tests/gen-schema-viz.test.ts::source_descriptors_in_a_schemas_directory_(folio-assistant-1nu0)::the_page_carries_a_source-descriptor_table,_hidden_until_a_scope_holds_one
  Scenario: The page carries a hidden source-descriptor table
    # Gap: the table being revealed when a scope holds a descriptor is not checked
    Given the schemas visualiser page for "who-iris"
    When its HTML is read
    Then it holds "<details id=\"sources\" open hidden>"
    And its script defines "function renderSources()"
