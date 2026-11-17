# Specifies the poster drawing of an ArchiMate view: the figure theme
# (figure-theme.ts), render-poster.ts (renderPosterSvg, posterFits, wrapWords,
# noteItems) and render-view.ts's themes (poster, plain, handbook).
# The view "Layers" is a model named "Poster <test>": a goals band, a components
# band holding a panel "Clinical" with a note, a frame "Platform layer" round two
# stacked bands, and a side column "Interop"; its cards are a goal with a note,
# a starred "Client Registry <b>" formerly named "MPI", a "Decision engine" that
# may match "CDS (id-x)", a cloud node, and "Open standards" with a list note.
Feature: A banded ArchiMate view is drawn as a poster in the model's layer colours

  @test:archimate/scripts/poster.test.ts::figure_theme::is_the_one_source_of_the_layer_colours,_render-view's_included
  Scenario: The figure theme is the one source of layer colours
    Then render-view's layer fills are the figure theme's own
    And a goal, a capability, an application component and a node are filled "#ccccff", "#f5deaa", "#b5ffff" and "#c9e7b7"

  @test:archimate/scripts/poster.test.ts::figure_theme::tints_a_table_cell_by_the_layer_of_the_type_it_names
  Scenario: A table cell is tinted by the layer of the type it names
    Then a business role's class is "layer-Business" and a work package's is "layer-ImplementationMigration"
    And the table CSS gives a motivation cell the background "#ccccff"

  @test:archimate/scripts/poster.test.ts::render-poster::colours_every_card_by_its_ArchiMate_layer,_never_by_its_band
  Scenario: Each card is filled by its own layer, whatever its band's hue
    Given the view "Layers"
    When the view is drawn as a poster with a star label, marks and element links
    Then the SVG has fills "#ccccff", "#b5ffff" and "#c9e7b7"
    And the cards "Trusted data", "Decision engine" and "Cloud" are filled as a goal, an application component and a node
    Given the view with the node "Cloud" and a second "Client Registry <b>" card moved into the panel "Clinical"
    When it is drawn as a poster
    Then the band "COMPONENTS" has the application band's ground
    And the card "Cloud" is still filled as a node, and "Decision engine" as an application component

  @test:archimate/scripts/poster.test.ts::render-poster::draws_bands_in_the_view's_order,_a_panel_inside_a_band,_and_a_frame_round_stacked_bands
  Scenario: Bands follow the view's order, with the panel and the frame drawn
    Given the view "Layers"
    When the view is drawn as a poster with a star label, marks and element links
    Then "GOALS" comes before "COMPONENTS"
    And the panel "Clinical" and its note "At the point of care" are drawn
    And "PLATFORM LAYER" is drawn, and a stroke of width 2.2 is used
    And the band "GOALS" ends above the band "COMPONENTS", which ends above the frame
    And the panel "Clinical" lies inside the band "COMPONENTS"
    And there is one frame, the rect of stroke width 2.2, and the bands "SHARED" and "TECH" lie inside it, "SHARED" above "TECH"

  @test:archimate/scripts/poster.test.ts::render-poster::puts_a_group_to_the_right_of_the_stack_in_a_dashed_side_column,_a_list_note_as_pills
  Scenario: The side column is dashed and a list note is set as pills
    Given the view "Layers"
    When the view is drawn as a poster with a star label, marks and element links
    Then "INTEROP" is drawn, a dash of "8 5" is used, a pill radius of 9.5 is used, and "openEHR" is its own text
    And the column under "INTEROP" is the dashed rect, to the right of the bands "GOALS" and "COMPONENTS" and of the frame
    And the pill "openEHR" has radius 9.5 and lies inside the column

  @test:archimate/scripts/poster.test.ts::render-poster::stars_a_starred_card,_marks_renamed_and_new_elements,_and_keys_both
  Scenario: A starred card is starred, renamed and new elements are marked, and a key explains them
    Given the view "Layers"
    When the view is drawn as a poster with the star label "Core component", marks and element links
    Then the SVG has a "★", "Core component", "renamed from MPI", "new; may match CDS (id-x)" and the key's "candidateMatch)"

  @test:archimate/scripts/poster.test.ts::render-poster::escapes_the_model's_text_and_links_each_card
  Scenario: The model's text is escaped and a card is linked
    Given the view "Layers"
    When the view is drawn as a poster with a star label, marks and element links
    Then "Client Registry &lt;b&gt;" and "Poster &lt;test&gt;" appear escaped, and no "<b>" appears
    And the card of "a1" links "../elements/a1/"

  @test:archimate/scripts/poster.test.ts::render-poster::leaves_the_key_out_when_nothing_is_starred_or_marked
  Scenario: With no star label or marks, there is no key
    Given the view "Layers"
    When the view is drawn as a poster with no options
    Then the key's "candidateMatch)" is not in it

  @test:archimate/scripts/poster.test.ts::text_helpers::wraps_at_a_width_and_keeps_every_word
  Scenario: Words wrap at a width and none is lost
    When "one two three four" is wrapped at 9
    Then the lines are "one two", "three" and "four"

  @test:archimate/scripts/poster.test.ts::text_helpers::sets_short_note_items_on_one_line,_unless_told_not_to
  Scenario: Short note items share a line unless told not to
    When "EMR · HIS · LIMS · Telemedicine clients" is split into note items
    Then they are "EMR · HIS · LIMS" and "Telemedicine clients"
    And "EMR · HIS", told not to join, gives "EMR" and "HIS"

  @test:archimate/scripts/poster.test.ts::poster_theme_on_drawn_views::draws_a_banded_view_without_lines_as_a_poster
  Scenario: A banded view without lines is drawn as a poster, and one with a line is not
    Given the view "Layers"
    Then the view fits a poster
    And the view with one connection added does not
    When a document's figure of the view is made from a throwaway instance
    Then it is exactly the poster of the view
    When the model has a line from the goal to "Decision engine" in that view
    Then the figure is exactly render-view's drawing of the view, not the poster

  @test:archimate/scripts/poster.test.ts::poster_theme_on_drawn_views::gives_render-view_a_title_banner_and_tinted_groupings_by_default,_and_keeps_the_plain_look_on_request
  Scenario: render-view draws a banner and tinted groupings by default, and neither when plain
    Given the view "Layers"
    When the view is drawn by render-view
    Then it says "Drawn from the ArchiMate model" and uses the motivation band's header colour
    When it is drawn with the "plain" theme
    Then it has neither

  @test:archimate/scripts/poster.test.ts::poster_theme_on_drawn_views::draws_the_handbook_look_on_request:_teal_outlines,_no_layer_fills,_no_colour_key
  Scenario: The handbook theme draws teal outlines with no layer fills or colour key
    Given the view "Layers"
    When the view is drawn with the "handbook" theme
    Then it uses the handbook teal and page colours, and says "Drawn from the ArchiMate model"
    And it has no motivation layer fill, no motivation band header colour, no colour key and no type labels

  @test:archimate/scripts/poster.test.ts::render-poster,_one_frame_round_the_stack::fits_when_the_frame_holds_three_or_more_groupings
  Scenario: A frame round three or more groupings fits a poster, and round two does not
    Given a view "Framed": a frame "Enterprise" round bands "Interop" and "Systems" and, side by side in its last row, "Shared" (holding "Foundational") and "Data"; then side groupings "Outside" (empty) and "Ecosystem"
    Then the view fits a poster
    And without "Data" and its card, the frame holds three groupings and the view fits
    And without "Data" and "Shared" and what they hold, the frame holds two and the view does not fit

  @test:archimate/scripts/poster.test.ts::render-poster,_one_frame_round_the_stack::puts_bands_that_share_a_row_in_the_view_side_by_side
  Scenario: Bands that share a row are drawn side by side
    Given the view "Framed" drawn as a poster
    Then "SHARED" and "DATA" are at the same height, "DATA" to the right
    And "SYSTEMS" is below "INTEROP"

  @test:archimate/scripts/poster.test.ts::render-poster,_one_frame_round_the_stack::keeps_the_view's_own_row_breaks_for_cards
  Scenario: Cards keep the view's own row breaks
    Given the view "Framed" drawn as a poster
    Then "Stock" is below "Orders", at the same x

  @test:archimate/scripts/poster.test.ts::render-poster,_one_frame_round_the_stack::names_every_side-column_grouping,_the_later_ones_in_dark_type
  Scenario: Every side-column grouping is named, the first in white type and the later in dark type
    Given the view "Framed" drawn as a poster
    Then "OUTSIDE" is drawn in white
    And "ECOSYSTEM" is drawn, not in white but in the theme's ink
