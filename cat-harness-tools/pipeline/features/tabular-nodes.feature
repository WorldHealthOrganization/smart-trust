# pipeline/tabular-nodes.ts turns a tabular source into graph nodes: manifest, then a sheet node
# only when the source has sheets, then one table block per sheet; tabularShapeOf reads either record format.
# Each Scenario names the test that executes it.
Feature: Graph nodes for tabular sources

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::a_CSV_gets_NO_sheet_—_inventing_one_is_the_lie_this_rejects
  Scenario: A CSV gets no sheet node
    Given a shape without sheets holding one table "coverage"
    When the tabular nodes are built
    Then the only nodes are "manifest.jsonld" and "blocks/table-001.jsonld"
    And the manifest contains the table block directly

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::a_ONE-sheet_workbook_still_gets_its_sheet
  Scenario: A one-sheet workbook still gets its sheet node
    Given a sheeted shape with one sheet "Coverage"
    When the tabular nodes are built
    Then the nodes are the manifest, "sheets/sheet-001.jsonld" and "blocks/table-001.jsonld"
    And the manifest contains the sheet
    And the sheet contains the table block

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::a_multi-sheet_workbook_nests_each_one,_in_order
  Scenario: A multi-sheet workbook nests each sheet in order
    Given a sheeted shape with sheets "Coverage" and "Notes"
    When the tabular nodes are built
    Then the manifest contains "sheet-001" then "sheet-002"
    And the title of "sheet-002" is "Notes"

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::a_sheet's_`contains`_is_a_LIST_even_at_length_one
  Scenario: A sheet's contains is a list even at length one
    Given a sheeted shape with one sheet
    When the tabular nodes are built
    Then the sheet's contains is an array

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::the_depth_is_RECORDED,_so_a_consumer_need_not_infer_it
  Scenario: The manifest records the tabular depth
    When nodes are built for a shape without sheets
    Then the manifest's tabular_depth is "table"
    When nodes are built for a sheeted shape
    Then the manifest's tabular_depth is "sheet"

  @test:pipeline/tabular-nodes.test.ts::a_sheet_node_appears_IFF_the_source_has_sheets::headers_reach_the_block_—_the_findable_surface
  Scenario: Column headers reach the table block
    Given a shape without sheets whose table has headers "country" and "iso3"
    When the tabular nodes are built
    Then the table block's headers are "country" and "iso3"
    And its kind is "table"

  @test:pipeline/tabular-nodes.test.ts::either_record_reduces_to_the_same_shape_—_two_readers,_on_purpose::`folio-tabular-records/v1`:_format_decides,_not_sheet_count
  Scenario: In a tabular-records record the format decides sheetedness, not the sheet count
    When the shape of a "folio-tabular-records/v1" record is read
    Then a "csv" record has no sheets
    And an "xlsx" record with two sheets has sheets
    And an "xlsx" record with one sheet still has sheets

  @test:pipeline/tabular-nodes.test.ts::either_record_reduces_to_the_same_shape_—_two_readers,_on_purpose::`folio-tabular-csvw/v1`:_`fac:anchor.sheet`_decides
  Scenario: In a tabular-csvw record the anchor's sheet decides sheetedness
    Given a "folio-tabular-csvw/v1" record with one table whose column is "country"
    When its shape is read with a null anchor sheet
    Then it has no sheets
    And its first sheet's headers are "country"
    When its shape is read with anchor sheet "Sheet1"
    Then it has sheets

  @test:pipeline/tabular-nodes.test.ts::either_record_reduces_to_the_same_shape_—_two_readers,_on_purpose::an_unrecognised_record_is_UNDEFINED,_never_an_empty_document
  Scenario: An unrecognised record has no shape rather than an empty one
    When the shape is read of a record with schema "something-else/v1", of null, and of a tabular-records record with no sheets
    Then each is undefined

  @test:pipeline/tabular-nodes.test.ts::either_record_reduces_to_the_same_shape_—_two_readers,_on_purpose::a_CSV_is_not_in_SHEETED_FORMATS,_and_the_workbook_formats_are
  Scenario: CSV is not a sheeted format and the workbook formats are
    When the sheeted formats are listed
    Then they do not include "csv"
    And they include "xlsx" and "ods"

  @test:pipeline/tabular-nodes.test.ts::every_node_is_loadable_JSON-LD::@context_is_on_EVERY_emitted_node,_not_just_the_manifest
  Scenario: Every emitted node carries the JSON-LD @context
    Given a sheeted shape with one sheet "Coverage"
    When the tabular nodes are built
    Then there are 3 nodes
    And each node's "@context" is the content document context

  @test:pipeline/tabular-nodes.test.ts::the_title_comes_from_the_record,_or_from_nowhere::`source.file`_is_the_document's_name
  Scenario: The record's source.file is the document title
    Given a tabular-records record with source file "coverage.csv"
    When its shape is read
    Then its title is "coverage.csv"

  @test:pipeline/tabular-nodes.test.ts::the_title_comes_from_the_record,_or_from_nowhere::a_record_with_no_`source.file`_names_nothing_—_the_CALLER_falls_back
  Scenario: A record with no source.file gives no title
    Given a tabular-records record with no source file
    When its shape is read
    Then its title is undefined

  @test:pipeline/tabular-nodes.test.ts::the_title_comes_from_the_record,_or_from_nowhere::CSVW_carries_no_document_title,_and_that_is_not_an_empty_string
  Scenario: A CSVW record gives no document title
    Given a tabular-csvw record with one table "coverage.csv"
    When its shape is read
    Then its title is undefined, not an empty string

  @test:pipeline/tabular-nodes.test.ts::a_consumer_walking_`contains`_handles_both_workbook_and_CSV_structures::a_consumer_walking_`contains`_resolves_table_blocks_directly_from_manifest_(CSV_shape)
  Scenario: Walking contains from the manifest reaches the table block of a CSV
    Given nodes built for a shape without sheets whose table "coverage" has headers "country" and "iso3"
    When a consumer follows contains from the manifest to every table block
    Then it finds one block "library/x/blocks/table-001" labelled "coverage" with those headers

  @test:pipeline/tabular-nodes.test.ts::a_consumer_walking_`contains`_handles_both_workbook_and_CSV_structures::a_consumer_walking_`contains`_resolves_table_blocks_through_sheets_(workbook_shape)
  Scenario: Walking contains reaches table blocks through the sheets of a workbook
    Given nodes built for a sheeted shape with sheets "Coverage" and "Notes"
    When a consumer follows contains from the manifest to every table block
    Then it finds "table-001" labelled "Coverage" and "table-002" labelled "Notes", each with its headers

  @test:pipeline/tabular-nodes.test.ts::a_consumer_walking_`contains`_handles_both_workbook_and_CSV_structures::a_pointer-scanning_consumer_(like_orphanedBlocks)_collects_all_referenced_block_IDs_from_both_shapes
  Scenario: Scanning contains pointers collects every referenced block in both shapes
    Given nodes built for a CSV shape and for a two-sheet workbook shape
    When block ids are collected from the contains of the manifest and of every sheet node
    Then the CSV gives "table-001"
    And the workbook gives "table-001" and "table-002"
