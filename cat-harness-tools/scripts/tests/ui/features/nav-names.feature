# scripts/check-nav-names.ts (check:nav-names) checks that each navigation destination
# carries one name across the harness data, the rail, the sidebar include and the templates.
# Each Scenario names the test that executes it.
Feature: One navigation destination, one name

  @test:scripts/tests/ui/nav-names.test.ts::the_live_surfaces::every_destination_carries_one_name
  Scenario: Every live destination carries one name
    # Skipped: when the built harness data or generated sidebar include is absent
    Given the committed cat-harness site
    When the nav names are checked
    Then the result is not undetermined
    And there are no conflicts and no template findings

  @test:scripts/tests/ui/nav-names.test.ts::the_live_surfaces::the_run_read_what_it_claims_to_have_compared
  Scenario: The check read the surfaces it claims to compare
    # Skipped: when the built harness data or generated sidebar include is absent
    # Gap: the railed page count is currently zero, so no rail page is shown to have been read
    Given the committed cat-harness site
    When the nav names are checked
    Then it read the harness data, the include and the stickies
    And it read 2 templates
    And its rail page count equals the railed count check:viewer-nav reports
    And it compared more than 20 destinations

  @test:scripts/tests/ui/nav-names.test.ts::the_live_surfaces::`--check`_passes_as_committed,_sidecar_included
  Scenario: The check CLI passes on the committed tree
    # Skipped: when the built harness data or generated sidebar include is absent
    # Gap: the sidecar is not inspected separately
    When "check-nav-names.ts --check" is run from the repository root
    Then its output says "every destination carries one name"
    And it exits 0

  @test:scripts/tests/ui/nav-names.test.ts::a_planted_second_name_fails::in_the_DATA:_one_tile_renamed
  Scenario: A tile renamed in the harness data is a conflict
    # Skipped: when the built harness data or generated sidebar include is absent
    Given a copy of the site whose "Skills" tile is retitled "Skills — cat-harness"
    When the nav names are checked on the copy
    Then the Skills tile's href is a conflict
    And its names are "Skills" and "Skills — cat-harness"

  @test:scripts/tests/ui/nav-names.test.ts::a_planted_second_name_fails::on_the_RAIL:_one_row's_label_changed_in_a_viewer_page
  Scenario: A rail row relabelled in a viewer page is a conflict
    # Skipped: when the built harness data or generated sidebar include is absent
    Given a copy of the site with a synthetic railed page linking the Methodologies destination
    And the unplanted copy has no conflict at that destination
    When the rail row is relabelled "methodology" and the nav names are checked
    Then 1 rail page is read
    And the Methodologies destination is a conflict between "Methodologies" and "methodology"

  @test:scripts/tests/ui/nav-names.test.ts::a_planted_second_name_fails::in_the_TEMPLATE:_a_landing_anchor_printing_the_kind_word
  Scenario: A landing template printing the kind word is a finding
    # Skipped: when the built harness data or generated sidebar include is absent
    Given a copy of the site whose "harness_details.html" prints "{{ v.kind }}" instead of the label
    When the nav names are checked on the copy
    Then the only template finding is the expression "v.kind"

  @test:scripts/tests/ui/nav-names.test.ts::a_planted_second_name_fails::a_harness_row_linking_a_graph's_page_is_a_second_name_for_that_page
  Scenario: A harness row linking a graph's page is a second name for it
    Given harness data where "Bootstrap" links "/processes/" and its "Processes" visualisation links the same path
    When the sightings are compared
    Then "/processes/" is the only conflict

  @test:scripts/tests/ui/nav-names.test.ts::what_is_and_is_not_a_name::the_qualifier_and_the_hidden_description_are_not_part_of_the_base_label
  Scenario: The qualifier and hidden description are not part of a label
    Given a rail anchor labelled "Tools" with a qualifier span and a screen-reader description span
    When the nav HTML is read at "/a/b/"
    Then the one sighting is "/tools/" labelled "Tools"

  @test:scripts/tests/ui/nav-names.test.ts::what_is_and_is_not_a_name::an_in-page_anchor_and_an_external_link_are_not_destinations
  Scenario: In-page anchors and external links are not destinations
    Given a rail with a "#top" anchor and an external link
    When the nav HTML is read
    Then there are no sightings

  @test:scripts/tests/ui/nav-names.test.ts::what_is_and_is_not_a_name::the_include's_Liquid_hrefs_resolve_to_the_site_path
  Scenario: The include's Liquid hrefs resolve to the site path
    Given a sidebar anchor whose href is "'/beans/' | relative_url" in Liquid
    When the nav HTML is read
    Then its href is "/beans/"

  @test:scripts/tests/ui/nav-names.test.ts::what_is_and_is_not_a_name::a_sticky_link_is_compared_only_where_navigation_links_the_same_page
  Scenario: Sticky links conflict only where navigation links the same page
    Given two sticky links to "/content-types.html" with different text
    And a sticky link and a harness row to "/who-iris/" with different names
    When the sightings are compared
    Then "/who-iris/" is the only conflict

  @test:scripts/tests/ui/nav-names.test.ts::what_is_and_is_not_a_name::a_template_that_prints_the_label_is_clean
  Scenario: A template printing the label is clean and one printing the kind is not
    When an anchor printing "v.label | default: v.kind" is checked
    Then there are no findings
    And an anchor printing "v.kind" gives a finding on line 1 with expression "v.kind"

  @test:scripts/tests/ui/nav-names.test.ts::reading_nothing_is_not_a_pass::no_rail_and_no_include_is_undetermined
  Scenario: A site with no rail and no include is undetermined
    Given a site with only an empty harness.json
    When the nav names are checked with no rail files
    Then the result is undetermined, mentioning "no railed page"

  @test:scripts/tests/ui/nav-names.test.ts::reading_nothing_is_not_a_pass::an_unreadable_harness.json_is_undetermined
  Scenario: An unparseable harness.json is undetermined
    Given a site whose harness.json is not valid JSON
    When the nav names are checked
    Then the result is undetermined, mentioning "will not parse"
