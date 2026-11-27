# scripts/lib/navbar.ts renders the shared navbar's three regions; harness-rail.ts adapts a page's rail onto it,
# with the document index, geometry CSS, avatar crops and the harness row. Each Scenario names the test that executes it.
Feature: The shared navbar and the rail adapter

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::the_middle_grows_and_scrolls;_the_other_two_do_neither
  Scenario: The middle region grows and scrolls while the top and bottom stay fixed
    # Gap: only the stylesheet text is checked; no layout is rendered or scrolled
    Given the navbar stylesheet
    Then it contains ".fa-nav-top{flex:0 0 auto}"
    And it contains ".fa-nav-graphs{flex:1 1 auto;min-height:0;overflow-y:auto"
    And it contains ".fa-nav-bottom{flex:0 0 auto"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::the_middle_declares_`min-height:0`,_or_the_fixed_bottom_scrolls_away
  Scenario: The middle region declares min-height 0 so the fixed bottom stays on screen
    # Gap: only the rule text is checked; the bottom region's position is not measured
    Given the navbar stylesheet
    When the ".fa-nav-graphs" rule is sliced out
    Then that rule contains "min-height:0"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::renders_the_regions_in_the_owner's_order
  Scenario: The regions render in the owner's order: top, graphs, bottom
    Given the who-iris navbar model
    When the navbar is rendered
    Then "fa-nav-top" appears before "fa-nav-graphs"
    And "fa-nav-graphs" appears before "fa-nav-bottom"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::puts_the_graphs_in_the_MIDDLE_and_the_harnesses_in_the_BOTTOM
  Scenario: Graphs sit in the middle region and harnesses in the bottom region
    Given the who-iris navbar model
    When the navbar is rendered
    Then the graphs region contains the "../docs/who-iris/" link
    And the markup from the bottom region on contains "Harnesses"
    And the graphs region does not contain "Harnesses"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::the_instance's_ROOT_is_in_the_fixed_top,_not_inside_the_graphs_group
  Scenario: The instance's root row is in the fixed top, not in the graphs group
    Given the who-iris navbar model whose root is the current page
    When the navbar is rendered
    Then the top region contains aria-current="page"
    And the graphs region does not contain "../who-iris/"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::the_graphs_FOLD_IN_ONE_CLICK,_and_arrive_open
  Scenario: The graphs group is a disclosure that arrives open
    Given the who-iris navbar model with an open, collapsible graphs group
    When the navbar is rendered
    Then the graphs region contains an open "fa-nav-group" details element

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::an_inert_row_SAYS_why,_in_text_a_screen_reader_gets_for_free
  Scenario: An inert row states its reason as visible text inside the row
    Given the who-iris navbar model with a "catalogue" graph that has no href and the note "no viewer yet"
    When the navbar is rendered
    Then the graphs region contains a "fa-nav-note" span reading "no viewer yet"
    And the note sits inside the same "fa-nav-dead" span as the "catalogue" label
    And the graphs region contains no "aria-disabled"
    And the graphs region contains no "title=" attribute

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::a_row_that_OPENS_carries_no_note_—_only_an_inert_row_owes_a_reason
  Scenario: A row that opens carries no note
    Given the who-iris navbar model with a linked "docs" graph
    When the navbar is rendered
    Then the "../docs/who-iris/" link up to its closing tag contains no "fa-nav-note"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::a_declared_graph_with_NO_viewer_is_listed,_as_a_non-link
  Scenario: A declared graph with no viewer is listed as a non-link
    Given the who-iris navbar model with a "catalogue" graph that has no href
    When the navbar is rendered
    Then the graphs region contains "catalogue"
    And it contains a "fa-nav-dead" span
    And it contains no href="undefined"

  @test:scripts/tests/ui/navbar.test.ts::three_regions,_and_only_the_middle_one_scrolls::no_home_row:_the_header's_mark_and_name_are_the_link_to_the_landing_page_(owner,_2026-10-30)
  Scenario: There is no home row; the header links to the landing page
    Given the who-iris navbar model with head href "../"
    When the navbar is rendered
    Then the bottom region contains no house character
    And the top region contains a "fa-nav-head-link" anchor to "../"
    And the top region contains a "fa-nav-head-toggle" label for "fa-nav-open"

  @test:scripts/tests/ui/navbar.test.ts::the_exploding_menu::is_a_<details>,_so_it_works_with_no_script_and_announces_its_state
  Scenario: The collapsible menu is a details element with no script
    Given the who-iris navbar model
    When the navbar is rendered
    Then it contains a "fa-nav-group" details element and a summary
    And it contains no script element and no onclick handler

  @test:scripts/tests/ui/navbar.test.ts::the_exploding_menu::uses_a_harness's_AVATAR_when_it_has_one_and_its_initial_when_it_does_not
  Scenario: A harness row shows its avatar when declared and its initial otherwise
    Given the who-iris navbar model where cat-harness has an avatar and bootstrap has none
    When the navbar is rendered
    Then it contains an img for "../assets/img/icons/cat-mark.svg"
    And it contains a "B" initial for bootstrap

  @test:scripts/tests/ui/navbar.test.ts::the_exploding_menu::does_not_repeat_a_label_that_is_its_own_initial_("A_A")
  Scenario: A label that is its own initial is not repeated beside the mark
    Given a navbar model whose root is labelled "A"
    When the navbar is rendered
    Then the label holds "A" only as screen-reader text
    And in the who-iris navbar the longer label "bootstrap" stays visible

  @test:scripts/tests/ui/navbar.test.ts::the_exploding_menu::carries_a_declared_tone_through_to_the_mark
  Scenario: A declared tone is carried through to the mark
    Given the who-iris navbar model where cat-harness declares tone 268
    When the navbar is rendered
    Then it contains "--fa-nav-hue:268"

  @test:scripts/tests/ui/navbar.test.ts::the_exploding_menu::an_item_with_nowhere_to_go_is_NOT_a_link
  Scenario: An item with nowhere to go is not a link
    Given the who-iris navbar model where bootstrap has no href
    When the navbar is rendered
    Then it contains a "fa-nav-dead" span
    And it contains no anchor with href="undefined"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::rests_at_exactly_the_glyph_column_and_its_gutters
  Scenario: At rest the bar is exactly the glyph column and its two gutters
    Given the navbar geometry constants and stylesheet
    Then the collapsed width equals twice the pad plus the glyph width
    And the stylesheet sets that width on the bar
    And the stylesheet pads the body's inline start by that width

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::mirrors_on_a_right-to-left_page:_no_physical_left_or_right_edge_(owner,_2026-11-12)
  Scenario: The navbar mirrors on a right-to-left page using only logical edges
    # Gap: the drag edge's right-to-left handling is checked by reading the function's source text, not by running it
    Given the navbar stylesheet and the source of wireNavResize
    Then the stylesheet declares no physical left, right, padding-left/right or margin-left/right property
    And the bar is fixed at "inset-inline-start:0"
    And the twisty and header toggle arrows are flipped under dir="rtl"
    And the wireNavResize source checks for "rtl" direction and measures from the client width

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::is_CLOSED,_not_gone
  Scenario: The collapsed bar is closed, not hidden
    Given the navbar stylesheet
    Then it contains no "visibility:hidden"
    And it contains no "translateX(-100%)"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::opens_on_hover,_on_keyboard_focus,_and_on_the_pinned_checkbox
  Scenario: The bar opens on hover, keyboard focus and the pinned checkbox
    # Gap: only the stylesheet text is checked; no hover or focus is simulated
    Given the navbar stylesheet
    Then one rule widens the bar to the --fa-nav-w width, defaulting to the open width, for hover, focus-visible and a checked "fa-nav-open"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::opens_to_the_width_the_reader_dragged_it_to,_else_the_default_(owner,_2026-11-10,_option_D)
  Scenario: The bar opens to the dragged width, else the default
    # Gap: the resize limits and storage key are checked in the function's source text; no drag is performed
    Given the navbar stylesheet and the source of wireNavResize
    Then no open width in the stylesheet is written without the --fa-nav-w fallback
    And the inner column and the page padding both read --fa-nav-w
    And the wireNavResize source names the minimum and maximum resize widths and the width storage key
    And labels wrap rather than being cut with an ellipsis

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::renders_no_[x]_and_no_☰_—_the_header_is_the_one_control_(#1757)
  Scenario: There is no close button and no hamburger; the header is the one control
    Given the who-iris navbar model
    When the navbar is rendered
    Then the markup contains no "fa-nav-close", no "&#9776;" and no "☰"
    And the stylesheet contains no ".fa-nav-close" rule

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::ONE_control_drives_the_checkbox,_and_it_is_in_the_header
  Scenario: One control in the header drives the open checkbox
    Given the who-iris navbar model
    When the navbar is rendered
    Then the "fa-nav-open" checkbox has an id
    And the only label for that id is the "fa-nav-head-toggle"
    And without a head href the only label for it is the "fa-nav-head" itself

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::the_header_carries_the_instance's_mark_—_the_home_icon_when_no_avatar_is_declared_(owner,_2026-11-02)
  Scenario: The header shows the home icon when no own mark is declared
    Given the who-iris navbar model with no declared mark
    When the navbar is rendered
    Then the top region contains the home glyph path
    And it shows no "W" initial
    And with a blank declared avatar glyph and tone 184 the top region still shows the home glyph, carries hue 184 and no "fa-nav-blank"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::a_declared_glyph_or_letter_beats_the_home_icon
  Scenario: A declared glyph or letter replaces the home icon
    Given the who-iris navbar model
    When it is rendered with a declared glyph path
    Then the top region does not contain the home glyph
    And when it is rendered with the declared icon "Q" the top region shows "Q"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::the_header_carries_the_declared_avatar_when_there_is_one
  Scenario: The header shows the declared avatar when there is one
    Given the who-iris navbar model with an avatar "../a.svg" and tone 268
    When the navbar is rendered
    Then the top region contains a lazy, async-decoded img for "../a.svg" with empty alt
    And it carries "--fa-nav-hue:268"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::every_avatar_image_is_lazy,_so_a_folded_Harnesses_row_fetches_nothing_until_opened_(2026-10-10)
  Scenario: Every avatar image loads lazily
    Given the who-iris navbar model with a cropped avatar mark
    When the navbar is rendered
    Then there is at least one img
    And every img carries loading="lazy"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::an_avatar_that_declares_its_ground_`none`_sits_on_the_rail_itself_—_no_tone_square_(issue_#46,_gap_5)
  Scenario: An avatar with ground none gets no tone square
    Given the who-iris navbar model with an avatar "../a.svg" declaring ground "none" and tone 268
    When the navbar is rendered
    Then the top region contains the img for "../a.svg"
    And it does not carry "--fa-nav-hue:268"

  @test:scripts/tests/ui/navbar.test.ts::at_rest_it_is_a_strip,_and_opens_three_ways::escapes_what_it_is_given
  Scenario: The navbar escapes the values it is given
    Given an instance name containing an img tag with an onerror handler
    When the navbar is rendered
    Then the raw "<img src=x" does not appear
    And the escaped "&lt;img" does

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_sits_in_the_FIXED_top::appears_there_when_a_document_is_open
  Scenario: The document index appears in the fixed top when a document is open
    Given the who-iris navbar model with a "Contents" document index holding "Introduction"
    When the navbar is rendered
    Then the top region contains "Introduction"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_sits_in_the_FIXED_top::is_ABSENT_when_nothing_is_open,_not_empty
  Scenario: The document index is absent when nothing is open
    Given the who-iris navbar model with no document index
    When the navbar is rendered
    Then it does not contain "Contents"

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::builds_a_model_rather_than_markup
  Scenario: The rail builds a navbar model rather than markup
    Given rail options for who-iris at root ".." with the who-iris graph links
    When the rail model is built
    Then its instance is "who-iris"
    And its graph items equal the given links
    And its graphs group is collapsible
    And its head href is "../"

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::sends_home_to_the_composed_site_when_the_page_names_one_(data-fa-home)
  Scenario: The rail's home goes to the composed site when the page names one
    Given rail options for who-iris
    Then a rail model with home href "/smart-html-jtd/" has that head href
    And a rail injected once and expanded from its emitted data links its header to "../"
    And when the rail block carries data-fa-home="/smart-html-jtd/" the page reads that home, and without it reads none
    And the expanded rail then links its header to "/smart-html-jtd/"
    And apart from that href and attribute the expanded rail is identical to the own-site one

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::names_the_header_for_a_LARGER_home:_SMART_Guidelines_on_a_composed_IG_(2026-11-10)
  Scenario: The header is named for a larger composing home
    Given a rail injected once with emitted data
    When its rail block declares home "/smart-html-jtd/" and home name "SMART Guidelines"
    Then the page reads the home name "SMART Guidelines"
    And the expanded header links to "/smart-html-jtd/" titled "SMART Guidelines: landing page"
    And the header's name label reads "SMART Guidelines" and draws the home glyph
    And the uncomposed rail's header is titled "who-iris: landing page"

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::OMITS_the_harnesses_region_when_it_could_not_be_read
  Scenario: The harnesses region is omitted when the harnesses could not be read
    Given rail options with no harnesses
    Then the rail model has no harnesses region
    And with one harness given its harnesses region has one item

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::injection::puts_the_navbar_first_in_the_DOM_and_leaves_the_page_intact
  Scenario: Injection puts the navbar first in the DOM and keeps the page
    Given a page with its own nav "main"
    When the rail is injected
    Then the page's own nav survives
    And "fa-nav" appears before the page's own nav

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::injection::REFUSES_a_document_with_no_body_rather_than_passing_it_through
  Scenario: Injection refuses a document with no body
    Given a fragment "<p>just a fragment</p>"
    When the rail is injected
    Then the result is undefined

  @test:scripts/tests/ui/navbar.test.ts::the_rail_is_an_adapter,_not_a_second_navbar::injection::refuses_a_page_that_already_carries_one
  Scenario: Injection refuses a page that already carries a navbar
    Given a page that has had the rail injected
    When the navbar is injected into it again
    Then the result is undefined

  @test:scripts/tests/ui/navbar.test.ts::toRoot_depth_—_the_arithmetic_that_broke_first::a_mount_index_at_depth_1_reaches_the_root_with_one_hop
  Scenario: A mount index at depth 1 reaches the root in one hop
    When the root path is computed for "smart-trust" and "index.html"
    Then it is ".."

  @test:scripts/tests/ui/navbar.test.ts::toRoot_depth_—_the_arithmetic_that_broke_first::a_page_NESTED_in_that_mount_needs_one_more
  Scenario: A page nested in a mount needs one more hop
    When the root path is computed for "smart-trust" and "artifact/ValueSet-X.html"
    Then it is "../.."

  @test:scripts/tests/ui/navbar.test.ts::toRoot_depth_—_the_arithmetic_that_broke_first::a_two-segment_route_at_depth_2_reaches_the_root_with_two
  Scenario: A two-segment route reaches the root in two hops
    When the root path is computed for "library/who-iris" and "index.html"
    Then it is "../.."

  @test:scripts/tests/ui/navbar.test.ts::toRoot_depth_—_the_arithmetic_that_broke_first::and_nested_inside_THAT,_three
  Scenario: A page nested in a two-segment route needs three hops
    When the root path is computed for "library/who-iris" and "a/b.html"
    Then it is "../../.."

  @test:scripts/tests/ui/navbar.test.ts::where_a_kind's_navbar_link_actually_goes::an_index_under_the_published_tree_addresses_as_its_directory
  Scenario: An index under the published tree addresses as its directory
    When the visualiser href is computed for "cat-harness/docs/cat-harness/library/who-iris/index.html" under "cat-harness/docs"
    Then it is "cat-harness/library/who-iris/"

  @test:scripts/tests/ui/navbar.test.ts::where_a_kind's_navbar_link_actually_goes::a_page_that_is_NOT_an_index_addresses_as_itself
  Scenario: A page that is not an index addresses as itself
    When the visualiser href is computed for "cat-harness/docs/qa/axes.html" under "cat-harness/docs"
    Then it is "qa/axes.html"

  @test:scripts/tests/ui/navbar.test.ts::where_a_kind's_navbar_link_actually_goes::REFUSES_a_visualiser_outside_the_published_tree_rather_than_composing_a_URL
  Scenario: A visualiser outside the published tree gets no URL
    When the visualiser href is computed for "who-iris/library/index.html" under "cat-harness/docs"
    Then it is undefined

  @test:scripts/tests/ui/navbar.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::is_sorted,_so_the_order_is_a_function_of_the_declaration
  Scenario: Declared graphs are listed in sorted order
    Given who-iris's declared graphs with no links
    Then their labels are already sorted

  @test:scripts/tests/ui/navbar.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::never_labels_a_row_that_OPENS,_even_if_a_stale_reason_is_passed_for_it
  Scenario: A stale note is dropped from a row that opens
    Given who-iris's declared graphs with "docs" linked and a "no viewer yet" note passed for "docs"
    When the rows are built
    Then the docs row carries no note

  @test:scripts/tests/ui/navbar.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::returns_EMPTY_for_an_instance_that_declares_nothing_readable
  Scenario: An instance that declares nothing readable has no graphs
    When the declared graphs of "does-not-exist" are built
    Then the list is empty

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::the_generated_stylesheet_carries_the_module's_own_numbers
  Scenario: The generated stylesheet region carries the module's own numbers
    Given the harness's UI stylesheet with its generated navbar geometry region
    Then that region equals the freshly rendered geometry CSS

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::the_rail's_px_and_the_sidebar's_rem_are_THE_SAME_LENGTH
  Scenario: The rail's pixel widths and the sidebar's rem widths are the same length
    Given the generated navbar geometry region
    When the collapsed, open and mark rem values are read and multiplied by 16
    Then they equal the collapsed width, the open width and the glyph width in pixels

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::defines_every_width_ONLY_inside_the_generated_region
  Scenario: Every navbar width is defined only inside the generated region
    Given the UI stylesheet split into the generated region and the authored rest
    Then none of --fa-nav-collapsed, --fa-nav-open, --fa-nav-mark or --fa-nav-pad is given a value in the authored rest
    And each is given a value inside the region
    And the stylesheet reads var(--fa-nav-collapsed)

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::docs-ui.css_is_SELF-SUFFICIENT_—_the_region_travels_with_it
  Scenario: The UI stylesheet carries the geometry region itself
    Given the harness's UI stylesheet
    Then it contains the region's begin marker
    And the end marker follows the begin marker
    And the end marker comes before the first use of var(--fa-nav-collapsed)

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::refuses_an_unterminated_region_rather_than_guessing_where_it_ends
  Scenario: An unterminated geometry region is refused
    Given CSS with a begin marker and no end marker
    When the geometry is written into it
    Then it throws the navbar geometry marker error

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::is_idempotent_—_regenerating_replaces_the_region,_never_stacks_it
  Scenario: Regenerating the geometry replaces the region rather than stacking it
    Given "body{}" with the geometry written into it once
    When the geometry is written again
    Then the result is unchanged
    And it holds exactly one begin marker

  @test:scripts/tests/ui/navbar.test.ts::the_geometry_is_stated_ONCE_—_`sjic`::the_strip_is_the_mark_and_its_two_gutters,_derived_either_way
  Scenario: The collapsed strip is the mark plus two gutters
    Then the collapsed width equals twice the pad plus the glyph width

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::gives_a_heading's_NUMBER_to_the_mark_and_keeps_only_the_title_as_the_label_—_owner_2026-10-30
  Scenario: A heading's number goes to the mark and only its title to the label
    Given a page with headings "About this draft", "Chapter 1. Why registries matter", "7.1 Identity management" and "Annex 9: Glossary"
    When its document index is built
    Then the rows are "About this draft" with no mark, "Why registries matter" marked "1" and "Glossary" marked "9"
    And the chapter row's child is "Identity management" marked "7.1"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::numberedHeading_leaves_a_heading_with_no_number,_or_nothing_but_a_number,_alone
  Scenario: Headings with no number, or only a number, are left alone
    Then "Introduction", "Chapter 3" and "2024 in review" keep their label and get no mark
    And "Appendix A Data elements" is marked "A" and labelled "Data elements"
    And "1.1.1 What is a reference architecture?" keeps its full label

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::takes_h2_and_h3_that_carry_an_id,_nesting_the_h3s
  Scenario: The index takes h2 and h3 headings with ids, nesting the h3s
    Given a page with h2 "Alpha", h3 "Beta" and h2 "Gamma", each with an id
    When its document index is built
    Then the top rows are "#a" Alpha and "#c" Gamma at depth 0
    And Alpha's child is "#b" Beta at depth 1
    And Alpha's fold reads "1 sub-section" and Gamma has none

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::FOLDS_sub-sections_under_their_section,_closed,_toggled_FROM_THE_SECTION'S_ROW_—_owners_2026-10-05_and_2026-10-15
  Scenario: Sub-sections fold closed under their section and toggle from its row
    Given a page with h2 Alpha holding two h3s, then h2 Gamma
    When its document index is built and rendered
    Then Alpha's fold reads "2 sub-sections"
    And Alpha's link is followed by a closed twisty button labelled "Show Alpha's 2 sub-sections" controlling a hidden "fa-nav-kids" list
    And no separate fold row or bare sub-section count row is drawn
    And the second sub-section "#b2" is still linked

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::an_h3_BEFORE_any_h2_stays_a_row_of_its_own
  Scenario: An h3 before any h2 stays a row of its own
    Given a page with h3 "Lead" before h2 "A" and its h3 "B"
    When its document index is built
    Then the rows are "Lead" and "A"
    And "Lead" is at depth 1

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::SKIPS_a_heading_with_no_id_—_it_is_not_a_destination
  Scenario: A heading with no id is skipped
    Given a page with h2 "Alpha", an id-less h2 "Nowhere" and h2 "Gamma"
    When its document index is built
    Then the rows are "Alpha" and "Gamma"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::ignores_h1_and_h4_—_the_title,_and_past_where_an_index_helps
  Scenario: The index ignores h1 and h4 headings
    Given a page with h1 "Title", h2 "A", h4 "D" and h2 "B"
    When its document index is built
    Then the rows are "A" and "B"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::strips_markup_and_entities_out_of_a_heading's_text
  Scenario: Markup and entities are stripped from a heading's text
    Given a page with h2 "A <code>b&amp;c</code>" and h2 "Z"
    When its document index is built
    Then the first row's label is "A b&c"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::is_ABSENT_below_two_rows,_never_an_empty_or_one-row_menu
  Scenario: The index is absent below two rows
    Then a page with no headings has no document index
    And a page with one indexable heading has no document index

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::`injectRail`_reads_it_off_the_page_it_is_given
  Scenario: injectRail reads the document index off the page it is given
    Given a page with h2 "Alpha" and h2 "Beta"
    When the rail is injected with no links
    Then the output contains "Alpha"
    And it links "#b"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::a_page_with_nothing_to_index_gets_NO_index_region
  Scenario: A page with nothing to index gets no index region
    Given a page with no headings
    When the rail is injected
    Then the top region contains no "fa-nav-group"
    And the graphs region is still rendered

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::is_the_page's_OWN_section:_first_in_the_middle,_the_only_group_open_(#1757)
  Scenario: The page's own section is first in the middle and is the only open group
    Given a page with h2 "A" and h2 "B"
    When the rail is injected
    Then the top region does not link "#a"
    And the graphs region links "#a"
    And the only open group in the graphs region is "On this page"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::is_named_for_the_visualiser_when_the_caller_says_which
  Scenario: The page's section is named for the visualiser when the caller says which
    Given a page with two headings
    When the rail is injected with the visualiser label "todos"
    Then the graphs region contains the label "todos"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::prefers_a_DECLARED_visualiser_nav_over_the_headings
  Scenario: A declared visualiser nav is preferred over the headings
    Given a page declaring a visualiser nav with "node-x" and its item "#todo-t1", and two headings
    When the rail is injected
    Then the graphs region links "#todo-t1"
    And it does not link the heading "#a"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::folds_a_declared_entry's_items_under_its_row,_open_only_where_the_page_is_(IG_menu,_2026-11-10)
  Scenario: A declared entry's items fold under its row, open only where the page is
    Given a page declaring a "Home" entry with Summary and Changes, and an "Indices" entry with Artifacts
    When the rail is injected once for "/changes.html" and expanded from its emitted data
    Then the two twisties are expanded "true" and "false" respectively
    And the first open fold holds "./changes.html" marked as the current page
    And the second, hidden fold holds "./artifacts.html"
    And a fold reads "2 pages"

  @test:scripts/tests/ui/navbar.test.ts::the_document_index_—_`documentIndexOf`::injectRailOnce_drops_the_declaration_once_the_rail_has_read_it,_and_keeps_a_malformed_one_(gp2f)
  Scenario: injectRailOnce drops a read declaration, keeps a malformed one, and shares declared menus
    Given a page declaring a visualiser nav with "node-x"
    When the rail is injected once
    Then the graphs region links "#node-x" and the declaration is gone from the page
    And a declaration that is not JSON is left in the page
    And with emitted rail data, two pages of one guide carry no declaration and no own document index
    And they share one emitted data file
    And the expanded rail from that file links "#node-x"
    And a page indexed by its headings keeps its own document index

  @test:scripts/tests/ui/navbar.test.ts::a_declared_avatar_region_crops_the_mark_—_`603s`::an_avatar_with_NO_region_is_the_plain_image_it_always_was
  Scenario: An avatar with no region is the plain image
    Given a harness row with avatar "/a.png" and no region
    When the navbar is rendered
    Then it contains the img for "/a.png"
    And it contains no "fa-nav-crop"

  @test:scripts/tests/ui/navbar.test.ts::a_declared_avatar_region_crops_the_mark_—_`603s`::scales_by_1/w_and_1/h_and_offsets_by_-x_and_-y_of_the_SCALED_image
  Scenario: A crop region scales by 1/w and 1/h and offsets by the scaled x and y
    Given a harness avatar with region x 0, y 0.46, w 0.5, h 0.5
    When the navbar is rendered
    Then the image style has width 200%, height 200%, left 0% and top -92%

  @test:scripts/tests/ui/navbar.test.ts::a_declared_avatar_region_crops_the_mark_—_`603s`::clips,_and_the_frame_is_a_positioning_context
  Scenario: The crop frame clips and is a positioning context
    Given the navbar stylesheet
    Then it contains ".fa-nav-crop{position:relative;overflow:hidden"
    And it contains the crop img rule with absolute position, auto width and height and no max width

  @test:scripts/tests/ui/navbar.test.ts::a_declared_avatar_region_crops_the_mark_—_`603s`::the_region_is_stated_in_PERCENTAGES,_so_it_survives_a_mark_resize
  Scenario: A crop region is stated in percentages
    Given a harness avatar with region x 0.25, y 0.25, w 0.25, h 0.25
    When the navbar is rendered
    Then it contains no "px;"
    And it contains "width:400%" and "left:-100%"

  @test:scripts/tests/ui/navbar.test.ts::a_coverage_path_is_a_SOURCE_file,_not_a_URL_—_`publishedUrlOf`::an_index_leaf_addresses_as_its_directory_—_either_extension
  Scenario: An index leaf addresses as its directory with either extension
    Then "processes/index.md" and "processes/index.html" both publish as "/processes/"

  @test:scripts/tests/ui/navbar.test.ts::a_coverage_path_is_a_SOURCE_file,_not_a_URL_—_`publishedUrlOf`::any_OTHER_page_addresses_as_itself,_with_`.html`
  Scenario: Any other source page addresses as itself with .html
    Then "tool-graph.md" publishes as "/tool-graph.html"
    And "subgraph-viewers.md" publishes as "/subgraph-viewers.html"

  @test:scripts/tests/ui/navbar.test.ts::a_coverage_path_is_a_SOURCE_file,_not_a_URL_—_`publishedUrlOf`::a_directory_is_already_a_URL_and_is_left_alone
  Scenario: A directory path is left alone
    Then "cat-harness/library/cat-harness/" publishes as "/cat-harness/library/cat-harness/"

  @test:scripts/tests/ui/navbar.test.ts::a_coverage_path_is_a_SOURCE_file,_not_a_URL_—_`publishedUrlOf`::does_not_mistake_a_mid-path_`index`_for_the_leaf
  Scenario: A mid-path index directory is not mistaken for the leaf
    Then "cat-harness/auto-docs/index/skills/" publishes as "/cat-harness/auto-docs/index/skills/"

  @test:scripts/tests/ui/navbar.test.ts::a_coverage_path_is_a_SOURCE_file,_not_a_URL_—_`publishedUrlOf`::no_harness_tab_link_ends_in_`.md`,_over_the_REAL_committed_data
  Scenario: No harness tab link in the published harness data ends in .md
    # Skipped: when the harness site's _data/harness.json has not been built
    Given the harness data the site build writes to _data/harness.json
    When every harness's visualisation paths are read
    Then none ends in ".md"

  @test:scripts/tests/ui/navbar.test.ts::the_crop_is_ONE_sum,_and_two_renderers_do_it::agrees_on_%p
  Scenario: The rail's inline crop agrees with solveCrop for each region
    Given a root avatar rendered with a crop region
    When its width, height, left and top percentages are read back off the markup
    Then they equal solveCrop for the same region
    And this holds for regions (0,0,0.3064,1), (0,0,1,1), (0.25,0.46,0.5,0.5) and (0.1,0.1,0.3,0.3)

  @test:scripts/tests/ui/navbar.test.ts::the_crop_is_ONE_sum,_and_two_renderers_do_it::the_whole_image_is_the_identity_crop,_not_a_no-op_that_skips_the_branch
  Scenario: The whole-image region solves to the identity crop
    When solveCrop is given x 0, y 0, w 1, h 1
    Then it returns width 100, height 100, left 0 and top 0

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::the_wrapper_is_the_only_thing_`navbarHtml`_adds
  Scenario: navbarHtml only wraps the shared regions in a nav element
    Given the who-iris navbar model
    Then navbarHtml equals the regions markup wrapped in a "fa-nav" nav labelled "folio-assistant"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::a_mounted_page's_markup_is_UNCHANGED_by_the_extension
  Scenario: A mounted page's markup is unchanged by the new model fields
    Given the who-iris navbar model declaring none of the new fields
    When the navbar is rendered
    Then it contains the "fa-nav-open" checkbox input and the graphs region
    And it contains no "fa-nav-row" and no "relative_url"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::hrefs_—_resolved,_or_wrapped_in_Jekyll's_filter::`liquid`_wraps_every_href_and_every_avatar_src
  Scenario: Liquid hrefs wrap every href and avatar src in relative_url
    Given a model with hrefs "liquid" and a "/library/" graph with avatar "/assets/a.png"
    When the regions are rendered
    Then the href is wrapped in Jekyll's relative_url filter
    And the avatar src is wrapped in it too

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::hrefs_—_resolved,_or_wrapped_in_Jekyll's_filter::a_row_with_no_destination_gains_no_filter
  Scenario: A row with no destination gains no relative_url filter
    Given a model with hrefs "liquid" and a dead "qa" graph
    When the regions are rendered
    Then it contains "fa-nav-dead"
    And it contains no "relative_url"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::hrefs_—_resolved,_or_wrapped_in_Jekyll's_filter::resolved_is_the_default,_so_no_caller_has_to_say_so
  Scenario: Resolved hrefs are the default
    Given a model with a "../library/" graph and no hrefs mode
    When the regions are rendered
    Then the href is written as "../library/"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::the_middle_region_is_ABSENT_when_another_navigation_owns_it::no_`graphs`_renders_no_graphs_region_—_not_an_empty_one
  Scenario: A model with no graphs renders no graphs region
    Given a model with harnesses and no graphs
    When the regions are rendered
    Then it contains no "fa-nav-graphs"
    And it contains "fa-nav-bottom"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::the_open_control_is_rendered_once_per_PAGE,_not_once_per_copy::`labels`_renders_the_labels_and_not_the_input
  Scenario: The labels open control renders labels but not the input
    Given a model with open control "labels"
    When the regions are rendered
    Then it contains no checkbox input
    And it contains a label for "fa-nav-open" and the "fa-nav-head"

  @test:scripts/tests/ui/navbar.test.ts::the_two_surfaces_differ_by_DECLARATION,_not_by_branch::the_open_control_is_rendered_once_per_PAGE,_not_once_per_copy::`input`_is_the_default,_so_an_injected_rail_needs_no_declaration
  Scenario: The input open control is the default
    Given a model with no open control declared
    When the regions are rendered
    Then it contains a checkbox input

  @test:scripts/tests/ui/navbar.test.ts::a_harness_row_carries_its_own_graphs_and_its_own_control::the_children_are_reachable,_and_the_dead_one_still_says_why
  Scenario: A harness row's children are reachable and the dead one says why
    Given a who-iris harness row with a linked "library" child and a dead "qa" child noted "declared, no viewer"
    When the regions are rendered
    Then it links "/who-iris/library/"
    And it contains "declared, no viewer"

  @test:scripts/tests/ui/navbar.test.ts::a_harness_row_carries_its_own_graphs_and_its_own_control::the_control_is_a_SIBLING_of_the_link,_never_inside_it
  Scenario: A harness row's control is a sibling of its link
    Given a who-iris harness row with a configuration action
    When the regions are rendered
    Then the first button after the row's link comes after that link's closing tag

  @test:scripts/tests/ui/navbar.test.ts::a_harness_row_carries_its_own_graphs_and_its_own_control::a_row_with_neither_gains_no_wrapper
  Scenario: A row with neither children nor a control gains no wrapper
    Given a plain graph row with only an href
    When the regions are rendered
    Then it contains no "fa-nav-row"

  @test:scripts/tests/ui/navbar.test.ts::adjacent_graph_rows_cannot_be_confused_(bean_yag0)::every_row_has_a_mark_no_other_row_has
  Scenario: Every declared graph row has a mark no other row has
    Given who-iris's declared graphs with docs and library linked
    Then every row has a glyph path or an icon
    And no two rows share a mark

  @test:scripts/tests/ui/navbar.test.ts::the_rail's_Graphs_group_starts_closed_(#2150)::is_folded_on_arrival_on_a_page_with_no_section_of_its_own
  Scenario: The Graphs group is folded on a page with no section of its own
    Given a rail model with one linked graph and no current row
    When the regions are rendered
    Then the Graphs group's details element is present and not open

  @test:scripts/tests/ui/navbar.test.ts::the_rail's_Graphs_group_starts_closed_(#2150)::opens_when_one_of_its_rows_is_the_page_being_read
  Scenario: The Graphs group opens when one of its rows is the current page
    Given a rail model with a current graph row
    When the regions are rendered
    Then the Graphs group's details element is open

  @test:scripts/tests/ui/navbar.test.ts::the_rail's_Graphs_group_starts_closed_(#2150)::stays_folded_beside_the_page's_own_section,_which_is_the_one_open_group
  Scenario: The Graphs group stays folded beside an open page section
    Given a rail model with a current graph row and an open document index
    When the regions are rendered
    Then the Graphs group's details element is not open

  @test:scripts/tests/ui/navbar.test.ts::a_harness_row_is_not_a_graph-typology_row,_whatever_its_mark_(#2151)::graphTypologyRowDecor_DECLARES_the_row_a_kind,_whatever_mark_it_draws
  Scenario: graphTypologyRowDecor declares each row a kind
    Given rows for docs, library and skills decorated by graphTypologyRowDecor
    Then every row has kind set to true

  @test:scripts/tests/ui/navbar.test.ts::a_harness_row_is_not_a_graph-typology_row,_whatever_its_mark_(#2151)::a_glyph-marked_harness_row_gets_no_kind_class,_and_nor_does_an_avatar_one
  Scenario: Harness rows get no kind class whatever their mark
    Given a rail model with kind-decorated graph rows and a glyph-marked and an avatar-marked harness
    When the regions are rendered
    Then the bottom region links "../smart-trust/" straight to its glyph
    And the bottom region contains no "fa-nav-kind"
    And the markup above the bottom region contains the "fa-nav-kind" class

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::an_object_row_is_written_once,_right_after_<body>,_and_parses_back_to_itself
  Scenario: The navbar row's data is written once after body and parses back to itself
    Given a page shell and an object navbar row
    When the rail is injected with that row
    Then a "fa-navbar-row" JSON script with root ".." follows the body tag
    And its content parses back to the row
    And writing the row again leaves the page unchanged

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::a_value_cannot_close_the_script_element_early
  Scenario: A navbar row value cannot close the script element early
    Given a navbar row whose note contains "</script><img ...>"
    When the rail is injected
    Then the output contains no "</script><img"
    And the closing tag is escaped as "</script>"

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::declared_none_is_written_as_null;_could-not-tell_writes_nothing
  Scenario: A declared-none row is written as null and an unknown row writes nothing
    Then injecting with a null navbar row writes a "fa-navbar-row" script holding null
    And injecting with no navbar row writes no "fa-navbar-row"

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::links_the_row's_script_and_stylesheet,_once,_in_<head>,_at_the_page's_own_depth
  Scenario: The row's script and stylesheet are linked once in head at the page's depth
    Given a page shell and a navbar row
    When the rail is injected at root ".."
    Then the head links the row script, deferred, under "../"
    And the head links the row stylesheet under "../"
    And writing the row again leaves the page unchanged
    And the row script is named exactly once

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::a_folio's_site_links_the_PLATFORM's_row_files_and_composes_the_row's_hrefs_there
  Scenario: A folio site links the platform's row files and composes row hrefs there
    Given an asset root on the platform's published site
    When the rail is injected with a navbar row
    Then the row script is linked from the asset root
    And the row data's root is the asset root

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::a_folio's_own_row_paths_and_counts_resolve_on_ITS_site,_while_its_files_stay_the_platform's_(issue_#46,_gap_2)
  Scenario: A folio's row data resolves on its own site while its files are the platform's
    Given an asset root on the platform's site and a row root ".."
    When the rail is injected with a navbar row
    Then the row script is linked from the asset root
    And the row data's root is ".."
    And the row data's root is not the asset root

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::a_page_that_fetches_nothing_gets_the_row_INLINED,_not_linked
  Scenario: A page that fetches nothing gets the row's script and style inlined
    Given inline row assets "/*JS*/" and "/*CSS*/"
    When the rail is injected with a navbar row
    Then nothing is linked by script src or stylesheet link
    And the JS is inlined in a script and the CSS in a style element
    And the JS appears exactly once

  @test:scripts/tests/ui/navbar.test.ts::the_harness_row's_data_reaches_a_railed_page_(bean_wckf,_#2147)::no_row_data,_no_row_script_—_and_a_declined_row_still_gets_one,_to_say_so
  Scenario: No row data means no row script, but a declined row still gets one
    Then injecting with no navbar row names no row script
    And injecting with a null navbar row names the row script

  @test:scripts/tests/ui/navbar.test.ts::a_thin_page_asks_for_the_rail_with_its_style_LINKED_(bean_lnoy)::links_navbar.css_and_the_row's_files,_and_inlines_neither
  Scenario: A linked thin page links the navbar and row files and inlines neither
    Given a thin page carrying the linked-navbar meta
    When the rail is injected with inline row assets offered
    Then it links the navbar stylesheet and the row script under "../../"
    And it contains no style element and no inlined JS
    And it contains the "fa-nav" nav

  @test:scripts/tests/ui/navbar.test.ts::a_thin_page_asks_for_the_rail_with_its_style_LINKED_(bean_lnoy)::is_a_fraction_of_the_inlined_rail's_weight
  Scenario: The linked rail weighs less than half the inlined rail
    Given the same thin page with and without the linked-navbar meta
    When the rail is injected into each
    Then the bytes added by the linked rail are less than half those added by the inlined rail

  @test:scripts/tests/ui/navbar.test.ts::a_thin_page_asks_for_the_rail_with_its_style_LINKED_(bean_lnoy)::the_meta_is_read_in_either_attribute_order,_and_`none`_is_still_`none`
  Scenario: The navbar meta is read in either attribute order
    Then a meta with content "linked" before name "folio-navbar" wants the linked rail
    And a meta with content "none" does not

  @test:scripts/tests/ui/navbar.test.ts::a_thin_page_asks_for_the_rail_with_its_style_LINKED_(bean_lnoy)::thinPageHtml_names_its_own_address_as_canonical:_`./`_by_default,_the_file_when_given
  Scenario: thinPageHtml names its own address as canonical
    Given thin page options
    Then the default page's canonical link is "./"
    And with canonical "StructureDefinition-a.html" the canonical link is that file and "./" is not used

  @test:scripts/tests/ui/navbar.test.ts::a_thin_page_asks_for_the_rail_with_its_style_LINKED_(bean_lnoy)::thinPageHtml_writes_`linked`,_not_`none`
  Scenario: thinPageHtml asks for the linked rail
    Given a page written by thinPageHtml
    Then it wants the linked rail
    And it does not decline the navbar

  @test:scripts/tests/ui/navbar.test.ts::the_row's_glyphs_are_docs-ui.js's_glyphs_(bean_lhvt)::all_seven_are_identical_in_both_files
  Scenario: The row's seven glyphs are the same in navbar-row.js and docs-ui.js
    Given the seven glyph constants evaluated from each file in the site chrome
    Then navbar-row.js yields seven glyphs
    And they equal the glyphs from docs-ui.js

  @test:scripts/tests/ui/navbar.test.ts::every_committed_railed_page_carries_the_harness_row's_data_(bean_wckf,_#2147)::the_scan_read_the_committed_docs_tree_—_an_empty_scan_is_not_a_clean_one
  Scenario: The scan of committed docs pages reads a real tree
    Given every HTML page under the harness's committed docs directory
    Then more than 20 pages were read

  @test:scripts/tests/ui/navbar.test.ts::every_committed_railed_page_carries_the_harness_row's_data_(bean_wckf,_#2147)::none_of_them_is_missing_the_row's_data
  Scenario: No committed railed page is missing the navbar row data
    Given the committed docs pages that carry the "fa-nav" navbar
    Then none lacks the "fa-navbar-row" block

  @test:scripts/tests/ui/navbar.test.ts::every_committed_railed_page_carries_the_harness_row's_data_(bean_wckf,_#2147)::every_one_of_them_loads_navbar-row.js,_which_draws_it_(bean_lhvt)
  Scenario: Every committed railed page loads what draws the navbar row
    Given the committed docs pages that carry the "fa-nav" navbar
    Then each names the row script or carries the inlined row

  @test:scripts/tests/ui/navbar.test.ts::a_page's_declared_section_label::is_read_off_the_page_and_names_the_section
  Scenario: A page's declared section label is read and names the section
    Given a page with the fa-visualiser-label meta "WHO SMART Trust" and a declared visualiser nav
    Then the visualiser label read off it is "WHO SMART Trust"
    And the injected rail contains "WHO SMART Trust"

  @test:scripts/tests/ui/navbar.test.ts::a_page's_declared_section_label::is_absent_when_undeclared,_and_the_section_is_"On_this_page"_(the_theme_sidebar's_name,_2026-10-15)
  Scenario: With no declared label the section is "On this page"
    Given a page with a declared visualiser nav and no label meta
    Then no visualiser label is read
    And the injected rail contains "On this page"

  @test:scripts/tests/ui/navbar.test.ts::a_fold_opens_from_its_parent's_row_—_owner,_2026-10-15:_"what_is_26?_why_unlabeled?"::every_fold_is_a_button_on_the_parent's_row_with_a_name_that_says_whose_and_how_many
  Scenario: Every fold is a button on its parent's row naming whose and how many
    Given a pages group with two folding rows, "Skill schema reference" with 2 pages and "Guides" with 1 holding the current page
    When the navbar is rendered
    Then there are two twisty buttons
    And the first is labelled "Show Skill schema reference's 2 pages", collapsed, and carries a tip

  @test:scripts/tests/ui/navbar.test.ts::a_fold_opens_from_its_parent's_row_—_owner,_2026-10-15:_"what_is_26?_why_unlabeled?"::ids_are_unique_and_each_toggle_controls_its_own_list
  Scenario: Fold ids are unique and each toggle controls its own list
    Given the same pages group rendered
    Then every aria-controls id is distinct
    And each id names a "fa-nav-kids" list

  @test:scripts/tests/ui/navbar.test.ts::a_fold_opens_from_its_parent's_row_—_owner,_2026-10-15:_"what_is_26?_why_unlabeled?"::a_fold_holding_the_reader's_page_arrives_OPEN,_named_'Hide'
  Scenario: A fold holding the reader's page arrives open and named Hide
    Given the same pages group rendered
    Then the Guides twisty is expanded, controls "fa-nav-fold-2" and is labelled "Hide Guides's 1 page"
    And the "fa-nav-fold-2" list is not hidden

  @test:scripts/tests/ui/navbar.test.ts::a_fold_opens_from_its_parent's_row_—_owner,_2026-10-15:_"what_is_26?_why_unlabeled?"::no_row_in_any_rail_is_a_bare_count
  Scenario: No row is a bare count
    Given the same pages group rendered
    Then no label reads only a number of pages or sub-sections

  @test:scripts/tests/ui/navbar.test.ts::a_fold_opens_from_its_parent's_row_—_owner,_2026-10-15:_"what_is_26?_why_unlabeled?"::a_rail_rendered_INTO_a_page_carries_its_script:_the_fold_toggles_and_the_drag_edge
  Scenario: A navbar injected into a page carries its fold and drag script
    Given a plain page
    When a navbar with the folding pages group is injected
    Then the page contains the "data-fa-nav-folds" script
    And a navbar with no folds still carries the wireNavResize script

  @test:scripts/tests/ui/navbar.test.ts::a_toned_mark's_ground_follows_the_scheme::light_mode_gives_the_mark_a_pale_ground_and_its_own_deep_ink
  Scenario: A toned mark's ground follows the colour scheme
    Given the navbar stylesheet
    Then a toned mark has a deep hue ground with pale ink by default
    And under the light scheme it has a pale hue ground
