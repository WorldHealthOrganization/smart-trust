# Specifies reading an Archi model (archimate/schemas/archimate.ts), drawing
# one of its views as SVG (render-view.ts), checking an instance's ArchiMate
# config (check-archimate.ts), and the pages gen-archimate-pages.ts writes
# for an instance, in its graph and in a site.
# "The model" is a small Archi model "Tiny <RA>": a component "Registry
# <script>" with documentation and a property, a service and a data object, a
# serving and a read access, and a view "Overview" with the component nested in
# a group "Platform" at Archi's default size, a bendpoint on the access line,
# and a note "A note & its text". "The view" is that view; "the throwaway
# instance" holds the model as "1.0.0" with a config naming it.
Feature: An Archi model is read, its views are drawn, and an instance's pages are written

  @test:archimate/scripts/archimate.test.ts::reading_a_model::reads_into_the_derived_family_archimate-model/v1,_which_its_own_schema_checks
  Scenario: The model is read into archimate-model/v1, which its schema checks
    Given the model
    When it is parsed
    Then the model tag is "archimate-model/v1"
    And the parsed model passes the model schema
    And a model with an element in layer "Nowhere" fails it

  @test:archimate/scripts/archimate.test.ts::reading_a_model::reads_elements_with_their_layer,_documentation,_properties_and_folder
  Scenario: Elements are read with their layer, documentation, properties and folder
    Given the model
    When it is parsed
    Then its name is "Tiny <RA>"
    And the component has type "ApplicationComponent", layer "Application", its documentation, folder "Application" and the property owner "WHO"

  @test:archimate/scripts/archimate.test.ts::reading_a_model::reads_relationships,_defaulting_nothing_it_was_told
  Scenario: Relationships are read as told, and only an untold access type is defaulted
    Given the model
    When it is parsed
    Then "id-r1" is exactly a Serving from the service to the component, with no name, access type or direction and no properties
    And "id-r2", told access type "1", is an Access with access type "read"
    And told access types "0", "2" and "3", it is "write", "access" and "readwrite"
    And told no access type, it takes Archi's default "write"

  @test:archimate/scripts/archimate.test.ts::reading_a_model::makes_a_nested_object's_bounds_absolute,_and_gives_-1_Archi's_default_size
  Scenario: A nested box's bounds are made absolute, and -1 becomes Archi's default size
    Given the model
    When it is parsed
    Then the view's viewpoint is "application_cooperation"
    And the nested component box is at (120, 90), 120 by 55, with parent "id-g"
    And the note is read with its text unescaped
    And the view's connections are "id-c1" and "id-c2"

  @test:archimate/scripts/archimate.test.ts::reading_a_model::reads_Archi's_zipped_archive,_stored_or_deflated
  Scenario: Archi's zipped archive is read, stored or deflated
    Given the model's XML as the one entry "model.xml" of a zip, once stored and once deflated
    Then for each, the entry, the model XML and the read model (three elements) come back

  @test:archimate/scripts/archimate.test.ts::reading_a_model::refuses_an_id_that_is_not_filename-safe_rather_than_rewriting_it
  Scenario: An id that is not filename-safe is refused
    Given the model with the service's id changed to "id b"
    When it is parsed
    Then it throws saying the id is not filename-safe

  @test:archimate/scripts/archimate.test.ts::reading_a_model::puts_each_element_type_in_its_ArchiMate_layer
  Scenario: Each element type is in its ArchiMate layer
    Then BusinessActor, Node, Goal, Capability, WorkPackage and Grouping are in Business, Technology, Motivation, Strategy, Implementation & Migration and Other

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::escapes_every_string_from_the_model
  Scenario: Every string from the model is escaped in the drawing
    Given the model
    When its view is drawn with element links
    Then it contains "Registry &lt;script&gt;" and no "<script>"
    Given the model with markup in the service's, data object's, group's and view's names and in the note
    When its view is drawn
    Then for each of the model name's "<RA>", "<script>", "<i>", "<s>", "<u>", "<v>" and the note's "<em>", the drawing has the escaped form and not the raw tag

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::links_each_box_to_its_element,_and_draws_each_relationship_with_its_own_ends
  Scenario: Boxes link to their elements and relationships have their own ends
    Given the model
    When its view is drawn with element links
    Then the component's box links "../elements/id-a/" in the top frame
    And an open arrow ends a line, and the read access has a small arrow at its source end

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::draws_a_box_whose_element_is_missing_as_missing,_not_as_nothing
  Scenario: A box whose element is missing is drawn as missing
    Given the model with the data object's box pointing at an element that is not there
    When the view is drawn
    Then it says "(element missing from the model)"

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::does_not_draw_a_nesting_relationship_between_a_box_and_the_box_it_sits_in
  Scenario: A relationship between a box and the box it sits in is not drawn
    Given the model with the data object also drawn inside the service's box, joined to it by a realization and a serving line
    When the view is drawn
    Then no Realization line is drawn and only one Serving line is drawn
    And the Access line, between boxes that do not nest, is drawn

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::draws_a_line_straight_when_a_box_moved_after_its_bendpoints_were_set,_and_two_lines_between_one_pair_side_by_side
  Scenario: A stale bendpoint is dropped, and two lines between one pair are drawn apart
    Given the model with a second serving line between the same two boxes
    When the view is drawn
    Then every line is a single straight segment
    And no two lines have the same path

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::draws_a_key_listing_only_the_colours,_shapes_and_lines_the_view_uses,_in_plain_words
  Scenario: The key lists only what the view uses, in plain words, and can be left off
    Given the model
    When its view is drawn with element links
    Then its key has "Key", "Software: systems", "Serving: serves", "Access: reads or writes data", "a grouping for layout only" and "Note: a comment"
    And it has no "Influence" and no "Why: who cares"
    And drawn with the key off, there is no key
    And the drawing with the key is taller, in its height and its viewBox, than the drawing without it

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::says_a_view_with_nothing_on_it_is_empty,_rather_than_drawing_an_empty_frame
  Scenario: A view with nothing on it says it is empty
    Given the model with its view replaced by an empty "Default View"
    When the view is drawn
    Then it says "This view is empty"

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::decodes_the_line_breaks_Archi_writes_as_character_references
  Scenario: Line breaks written as character references are decoded
    Given the model with the note's text "Who owns it?&#xD;&#xA;Next"
    When it is parsed and drawn
    Then the note's text holds a real line break
    And the drawing has no "#xD"

  @test:archimate/scripts/archimate.test.ts::drawing_a_view::wraps_a_long_name_to_the_box_and_marks_what_it_cut
  Scenario: A long name is wrapped to the box and the cut is marked
    When "Central Health Workforce Registry and Exchange Services" is wrapped to 160 wide in two lines
    Then the lines are "Central Health Workforce" and "Registry and Exchange…"

  @test:archimate/scripts/archimate.test.ts::an_instance::refuses_a_model_id_declared_twice
  Scenario: A model id declared twice is refused
    Given an ArchiMate config that declares model "1.0.0" twice
    When it is parsed by the config schema
    Then it fails

  @test:archimate/scripts/archimate.test.ts::an_instance::is_consistent_when_every_model_is_configured,_parses_and_resolves
  Scenario: An instance whose model is configured and parses has no problems
    Given a throwaway instance holding the model as "1.0.0" and a config naming it
    When the instance is checked
    Then there are no problems

  @test:archimate/scripts/archimate.test.ts::an_instance::links_a_document_figure_to_the_view_it_shows,_and_fails_when_either_is_gone
  Scenario: A document figure is linked to its view, and a missing view or block is a problem
    Given a config whose figure names model "9.9.9"
    Then it fails the config schema
    Given a throwaway instance whose config maps "Figure 1" (block present) to the view, and "Figure 2" (block absent) to view "id-gone"
    When the instance is checked
    Then the problems are that Figure 2's view is not in the model and its block is not in the instance
    And the view's page says it is drawn in the document as Figure 1, and its JSON-LD names Figure 1 and the block's URL as a subject
    And in a site, the figure target of Figure 1 names the view, and its SVG and page are among the written files
    And there is one figure target

  @test:archimate/scripts/archimate.test.ts::an_instance::says_so_when_a_model_is_held_that_the_config_does_not_name
  Scenario: A model the config does not name is reported
    Given the throwaway instance with a stray "stray.archimate" beside the config
    When the instance is checked
    Then a problem says "stray.archimate" is held, but not named

  @test:archimate/scripts/archimate.test.ts::an_instance::writes_a_page_and_an_IRI_for_the_model_and_every_view,_element_and_relationship
  Scenario: A page and an IRI are written for the model and every view, element and relationship
    Given the throwaway instance
    When its pages are generated
    Then the graph path is "archimate"
    And there are eight pages: model, metamodel, one view, three elements and two relationships
    And the view's SVG is written
    And every JSON-LD file's "@id" is its own IRI
    And the component's JSON-LD type is "archimate:ApplicationComponent", and the serving's source is the service's IRI

  @test:archimate/scripts/archimate.test.ts::an_instance::a_page_copies_none_of_the_model's_documentation,_properties_or_notes:_it_declares_its_node_and_points_at_the_normalised_model_relative_to_itself
  Scenario: A page declares its node, points at the normalised model relative to itself and copies no documentation, property or note
    Given the throwaway instance
    When its pages are generated
    Then each page's config names "model.json" relative to the page's depth, and the metamodel page names none
    And each page declares its node with no problem found
    And no page contains the component's documentation "Holds the records.", its property key "owner" or value "WHO", or the note's text

  @test:archimate/scripts/archimate.test.ts::an_instance::declares_the_rail's_left-hand_section:_the_model's_views,_relative_to_each_page
  Scenario: The rail's left-hand section lists the model's views, relative to each page
    Given the throwaway instance
    When its pages are generated
    Then the model page's rail lists "Metamodel in use" and "Overview" with "./" links
    And the view page's rail links back two levels
    And the root page's rail lists the model "Tiny <RA>" at "1.0.0/"

  @test:archimate/scripts/archimate.test.ts::an_instance::in_a_site,_puts_the_pages_at_the_declared_route_and_leaves_the_data_where_its_IRIs_are_(folio-assistant#2527)
  Scenario: In a site, pages go to the declared route and data stays at its IRIs
    Given the throwaway instance
    When its pages are generated for a site
    Then the page root is "en/tiny/archimate"
    And every page is under the route and every other file under "archimate/", the pages being the graph's pages
    And every page names "archimate-pages" as the Tool that drew it
    And every relative link of each page and SVG, and each "node", "model" and "svg" of a non-root page's config, resolves to a written file or folder
    And the view page reaches the model in the data tree
    When its pages are generated in the graph
    Then the page root is "archimate", the view's SVG links the element's slug, and no page names a Tool

  @test:archimate/scripts/archimate.test.ts::an_instance::in_a_site,_refuses_an_instance_that_declares_no_route_for_these_pages
  Scenario: In a site, an instance with no route for these pages is refused
    Given the throwaway instance with no visualisers declared
    When its pages are generated for a site
    Then it throws saying it declares no visualiser rendered by "archimate-pages"
    And generated in the graph, the page root is "archimate"

  @test:archimate/scripts/archimate.test.ts::an_instance::in_a_site,_picks_the_visualiser_that_covers_the_directory_when_several_draw_these_pages
  Scenario: In a site, the visualiser covering the directory is picked
    Given the throwaway instance with two "archimate-pages" visualisers, "elsewhere" covering another directory and "models" covering "archimate"
    When its pages are generated for a site
    Then the page root is "en/tiny/models"

  @test:archimate/scripts/archimate.test.ts::an_instance::refuses_to_write_pages_into_a_graph_that_is_not_served
  Scenario: Pages are refused for a graph that is not served when serving is required
    Given the throwaway instance
    When its pages are generated requiring a served graph
    Then it throws naming "served: true"

  @test:archimate/scripts/archimate.test.ts::an_instance::is_swept_from_the_checkout_when_it_declares_an_archimate_directory,_and_a_layer_that_does_not_is_left_out
  Scenario: A layer declaring an archimate directory is swept from the checkout, and one that does not is left out
    Given a checkout holding the throwaway instance "tiny" and a layer "plain" that declares no directories
    When the checkout's ArchiMate instances are swept
    Then only "tiny" is found, and it has no committed-check problem
    And once a layer "broken" with a declaration that is not JSON is added, the sweep finds "broken" and "tiny"

  @test:archimate/scripts/archimate.test.ts::an_instance::links_a_reused_element_back_to_the_node_it_copies,_and_an_own_element_to_the_copy_it_plays_(issue_#1949)
  Scenario: A reused element links back to the node it copies, and an own element names the copy it plays
    Given the throwaway instance whose service "Lookup" and serving carry an "overlay:base" property naming a node in "ra 0.3.0", with two added realisations
    When its pages are generated
    Then the service's and the serving's JSON-LD have "dcterms:source" naming the base IRI
    And the service's page says "Reused from" a link to "ra 0.3.0"
    And the component's JSON-LD has no "dcterms:source", but its page says it plays "Lookup" in ra 0.3.0
    And the data object's page says it plays "Lookup" in ra 0.3.0 through the component
    And an older "relationships/id-r9.jsonld" base IRI is read as the node IRI "relationship/id-r9", and "not an IRI" gives none
    And the access relationship's page names no source

  @test:archimate/scripts/archimate.test.ts::an_instance::bundles_the_IG_sites'_Contents_card_with_the_renderer,_and_draws_it_over_a_page's_sections_(issue_#1885)
  Scenario: The IG sites' Contents card is bundled with the renderer and floated over a page's sections
    Given the throwaway instance
    When its pages are generated
    Then "assets/archimate.js" sets "window.faContentsCard" before it calls it on a host
    And "assets/archimate.css" holds the ".igi-contents" rule and floats it right in the page body

  @test:archimate/scripts/archimate.test.ts::an_instance::serves_a_small_page_AT_each_node's_IRI_that_declares_the_node_and_links_its_page,_in_the_graph_and_in_a_site
  Scenario: A small page at each node's IRI declares the node and links to its page, in the graph and in a site
    Given the throwaway instance
    When its pages are generated in the graph
    Then the component's stub "1.0.0/element/id-a.html" declares its IRI with type ArchiMate ApplicationComponent, with no node problem
    And it links its JSON-LD as an alternate and loads no script
    And there are seven stubs: the model, its view, three elements and two relationships
    When its pages are generated for a site
    Then every stub is under "archimate/" and its canonical link reaches a written page at the declared route
