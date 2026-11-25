# scripts/lib/nav-label.ts is the one source of every navigation label: kind titles,
# harness titles, qualifiers, tile labels and destination normalisation.
# Each Scenario names the test that executes it.
Feature: Navigation labels come from one source

  @test:scripts/tests/ui/nav-label.test.ts::a_kind_is_called_by_its_display_name,_never_its_kind_word::the_registered_title_is_used
  Scenario: A kind is called by its registered title
    When the kind titles of "docs", "methodology", "external-schema" and "skills" are read
    Then they are "Docs", "Methodologies", "External schemas" and "Skills"

  @test:scripts/tests/ui/nav-label.test.ts::a_kind_is_called_by_its_display_name,_never_its_kind_word::a_kind_with_no_title_is_capitalised,_with_hyphens_read_as_spaces
  Scenario: A kind with no title is capitalised with hyphens read as spaces
    Given a registry with "probe-kind" registered without a title
    When the kind titles of "probe-kind" and the unregistered "never-registered" are read
    Then they are "Probe kind" and "Never registered"

  @test:scripts/tests/ui/nav-label.test.ts::a_harness_is_its_declared_title::title_first,_name_when_there_is_none
  Scenario: A harness is called by its title, or its name when it has none
    When the harness title of "cat-harness" titled "C@T Harness" is read
    Then it is "C@T Harness"
    And a harness with no title, or a blank one, is called by its name

  @test:scripts/tests/ui/nav-label.test.ts::the_harness_is_a_qualifier,_not_part_of_the_base_name::a_harness_suffix_is_stripped_from_a_declared_title
  Scenario: A harness suffix is stripped from a declared title
    When "Docs — cat-harness" is stripped of qualifier "cat-harness"
    Then it is "Docs"
    And "Skills - who-iris" stripped of "who-iris" is "Skills"

  @test:scripts/tests/ui/nav-label.test.ts::the_harness_is_a_qualifier,_not_part_of_the_base_name::a_dash_that_is_part_of_the_title's_meaning_stays
  Scenario: A dash that is part of a title's meaning stays
    When "Thinking about it — wide" is stripped of qualifier "cat-harness"
    Then it is unchanged
    And "Latent semantic indexes" with no qualifiers is unchanged

  @test:scripts/tests/ui/nav-label.test.ts::the_harness_is_a_qualifier,_not_part_of_the_base_name::label_and_qualifier_read_as_one_line_where_both_are_text
  Scenario: A label and its qualifier read as one line of text
    When the text of label "Skills" with qualifier "C@T Harness" is read
    Then it is "Skills · C@T Harness"
    And a label with no qualifier is just "Skills"

  @test:scripts/tests/ui/nav-label.test.ts::a_tile's_label::an_undeclared_title_takes_the_directory's_first_kind,_NEVER_the_directory_id
  Scenario: A tile with no declared title takes its directory's first kind
    Given a directory "root-docs" declaring the kind "docs"
    When its tile label is read with no declared title
    Then it is "Docs"

  @test:scripts/tests/ui/nav-label.test.ts::a_tile's_label::a_declared_title_wins,_with_any_harness_suffix_stripped
  Scenario: A tile's declared title wins with any harness suffix stripped
    When the tile label of "qa" declaring the title "Latent semantic indexes" is read
    Then it is "Latent semantic indexes"
    And a "docs" tile titled "Docs — cat-harness" with harness "cat-harness" is labelled "Docs"

  @test:scripts/tests/ui/nav-label.test.ts::two_kinds_on_one_page_share_one_name::both_rows_take_the_name_of_the_kind_the_directory_declares_first,_and_the_second_is_marked
  Scenario: Two kinds drawn on one page share the name of the kind declared first
    Given rows "cat-harness" and "schemas" sharing one path, plus rows "docs" and "code"
    And a directory that declares "schemas" before "cat-harness"
    When the visualisation rows are labelled
    Then the labels are "Schemas", "Docs", "Schemas" and "Code"
    And only the "cat-harness" row is marked as the same as "schemas"

  @test:scripts/tests/ui/nav-label.test.ts::two_kinds_on_one_page_share_one_name::a_row_with_no_page_is_named_for_its_own_kind
  Scenario: A row with no page is named for its own kind
    Given rows "waiver" and "memory" with no path, declared by one directory
    When the visualisation rows are labelled
    Then the labels are "Waivers" and "Memory"

  @test:scripts/tests/ui/nav-label.test.ts::a_viewer_at_the_instance's_own_root_is_the_harness's_page::the_row_takes_the_harness's_name_and_is_listed_once
  Scenario: A viewer row at the instance's root takes the harness's name
    Given rows "docs", "fhir-artifact-index" at "/smart-base/", and "qa"
    When the rows are labelled
    Then the "fhir-artifact-index" row is "FHIR artefact index"
    When the instance root "/smart-base/" is named for harness "smart-base" titled "SMART Base"
    Then the labels are "Docs", "SMART Base" and "QA"
    And only the root row is marked as the same as "smart-base"

  @test:scripts/tests/ui/nav-label.test.ts::a_viewer_at_the_instance's_own_root_is_the_harness's_page::the_root_is_compared_as_a_destination,_not_as_a_string
  Scenario: The instance root is compared as a destination
    Given a row at "/smart-trust/index.html"
    When the instance root "/smart-trust/" is named for harness "smart-trust"
    Then the row is labelled "smart-trust" and marked as the same as "smart-trust"

  @test:scripts/tests/ui/nav-label.test.ts::a_viewer_at_the_instance's_own_root_is_the_harness's_page::an_instance_with_no_root_of_its_own_changes_nothing
  Scenario: An instance with no root of its own changes nothing
    Given a "processes" row labelled "Processes"
    When an undefined instance root is named for harness "bootstrap"
    Then the row is still "Processes" with no same-as mark

  @test:scripts/tests/ui/nav-label.test.ts::a_destination_is_compared_by_its_normalised_href::baseurl,_index.html_and_doubled_slashes_do_not_make_two_destinations
  Scenario: Baseurl, index.html and doubled slashes normalise away
    When "/folio-assistant/tools/index.html" is normalised with baseurl "/folio-assistant"
    Then it is "/tools/"
    And "tools//" normalises to "/tools/"

  @test:scripts/tests/ui/nav-label.test.ts::a_destination_is_compared_by_its_normalised_href::the_fragment_is_kept,_because_a_landing_section_is_not_the_landing
  Scenario: A destination's fragment is kept
    When "/#harness-cat-harness" is normalised
    Then it stays "/#harness-cat-harness"
    And "/" stays "/"

  @test:scripts/tests/ui/nav-label.test.ts::a_destination_is_compared_by_its_normalised_href::an_external_URL_is_not_a_destination_here
  Scenario: An external URL or empty href is not a destination
    When an external GitHub URL or an empty string is normalised
    Then the result is undefined

  @test:scripts/tests/ui/nav-label.test.ts::a_handler_viewer's_whole-view_row_is_one_more_destination::named_by_the_namer,_unqualified,_on_the_whole-view_page_and_on_a_subject_page
  Scenario: A whole-view row is named by the namer without a qualifier
    Given a namer that names the whole view "Schemas"
    When the subject section's first row is built on the whole-view page and on subject page "a"
    Then it is labelled "Schemas" on both
    And on the subject page it links "../" and carries no qualifier

  @test:scripts/tests/ui/nav-label.test.ts::a_handler_viewer's_whole-view_row_is_one_more_destination::"all"_only_when_no_namer_is_given
  Scenario: The whole-view row is "all" only without a namer
    When the subject section's first row is built on subject page "a" with no namer
    Then it is labelled "all" and links "../"
