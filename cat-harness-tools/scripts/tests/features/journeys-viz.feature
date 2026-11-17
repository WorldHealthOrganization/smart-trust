# The journeys viewer (scripts/journeys/read.ts, render.ts, present.ts and
# scripts/gen-journeys-viz.ts) over a fixture checkout of two layers: every journey,
# each journey alone, sub-graphs, the workshop layer and its presentation pages.
# Each Scenario names the test that executes it.
Feature: The journeys viewer

  @test:scripts/tests/journeys-viz.test.ts::the_reader_finds_every_journey_the_checkout's_declarations_hold::both_instances'_journeys_and_workshops,_by_kind,_each_parsed
  Scenario: The reader finds both instances' journeys and workshops, each parsed
    Given a checkout where lower holds two journeys and top holds a group, two sub-journeys, a broken journey and a workshop
    When the journey corpus is read from top
    Then the journeys are lower's p1-checked and p2-treated and top's t-group, t1-away and t2-home
    And the only workshop is "policy"

  @test:scripts/tests/journeys-viz.test.ts::the_reader_finds_every_journey_the_checkout's_declarations_hold::a_file_that_does_not_parse_is_a_finding_with_its_reason,_not_a_silent_skip
  Scenario: A file that does not parse is a finding with its reason, not a silent skip
    Given the same corpus
    Then its only problem is top's journeys/broken.json
    And the problem's message names "zed"

  @test:scripts/tests/journeys-viz.test.ts::the_reader_finds_every_journey_the_checkout's_declarations_hold::the_edges'_targets:_actors,_stories,_blocks,_ladders,_requirements
  Scenario: The edges' targets are read: actors, stories, blocks, ladders, requirements
    Given the same corpus
    Then lower's actor ana has persona name "Ana"
    And lower's stories hold "pilgrim-1"
    And lower's block catalogue holds "wallet" but not the "stray" block from a journeys directory
    And lower's ladder "trust" has codes paper and shared
    And requirement LOW-REQ-001 is titled "Read the summary"

  @test:scripts/tests/journeys-viz.test.ts::the_declared_route::is_the_instance's_visualiser_renderedBy_journeys-viewer,_under_the_locale
  Scenario: The route is the instance's journeys-viewer visualiser, under the locale
    When the journeys route of top is read
    Then it is "en/top/journeys"
    And lower, which declares no visualiser, has no route and no journey files
    And every file for top lies under "en/top/journeys/"

  @test:scripts/tests/journeys-viz.test.ts::the_index:_all_journeys,_by_instance,_by_partOf,_along_follows::names_every_instance's_journeys,_the_declaring_instance_first
  Scenario: The index names every instance's journeys, the declaring instance first
    Given the rendered index page
    Then the top section comes before the lower section
    And it names P1 — Checked, P2 — Treated, T — The whole trip, T1 — Away and T2 — Home

  @test:scripts/tests/journeys-viz.test.ts::the_index:_all_journeys,_by_instance,_by_partOf,_along_follows::a_sub-journey_sits_inside_its_parent,_and_siblings_follow_their_chain
  Scenario: A sub-journey sits inside its parent, and siblings follow their chain
    Given the rendered index page
    Then after the group's title there is a sub-tree
    And T1 — Away comes before T2 — Home
    And P1 — Checked comes before P2 — Treated

  @test:scripts/tests/journeys-viz.test.ts::the_index:_all_journeys,_by_instance,_by_partOf,_along_follows::each_instance_is_a_sub-graph_page
  Scenario: Each instance is a sub-graph page
    When the per-instance index pages are read
    Then lower's page contains "Lower layer"
    And top's page names "journeys/broken.json"

  @test:scripts/tests/journeys-viz.test.ts::the_index:_all_journeys,_by_instance,_by_partOf,_along_follows::every_page_says_which_Tool_drew_it
  Scenario: Every page says which Tool drew it
    When every rendered HTML page is read
    Then each says it was rendered by "journeys-viewer"

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::a_lane_per_person_present,_and_the_feeling_curve
  Scenario: A journey page has a lane per person present and the feeling curve
    Given the rendered page of p2-treated
    Then it has a lane row
    And it draws two feeling curves
    And it carries Ana's colour "--c:#123456"

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::each_step:_its_anchor,_its_trust_state_from_the_ladder,_gaps
  Scenario: Each step has its anchor, its trust state from the ladder, and its gaps
    Given the rendered page of p2-treated
    Then it has the anchor of step P2
    And it shows the trust state "Shared" in bold
    And it shows the gap "No transaction for this yet."

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::the_BPMN_drawing,_inlined_in_the_common_block,_with_the_step's_flow_nodes_named_for_the_task_panel_to_highlight
  Scenario: The BPMN drawing is inlined in the common block with the step's flow nodes named for highlighting
    Given the rendered page of p2-treated
    Then it has a bpmn figure with a data-panel and data-pt-highlight "Task_Read"
    And it has no "data-jv-hl" and no XML prolog
    And the scroll box is focusable with role group
    And it loads the common task-panel stylesheet and script from "../../assets/"

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::stories,_requirements,_examples_and_blocks_resolve,_and_what_does_not_is_drawn_as_unresolved
  Scenario: Stories, requirements, examples and blocks resolve, and what does not is drawn as unresolved
    Given the rendered page of p2-treated
    Then it shows the story as "I want to show my summary abroad, so that I am treated safely."
    And it links the requirement to its GitHub file in example/lower
    And "ghost-story" is drawn unresolved
    And LOW-REQ-404 is drawn as having no req: node
    And it names "Health wallet" and says the unknown block is "not in a catalogue"
    And its only FHIR example, "Bundle/ana-ips", links to its IG page "Bundle-ana-ips.html"

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::the_workshop_layer_of_another_instance_shows_under_the_step_it_names
  Scenario: The workshop layer of another instance shows under the step it names
    Given the rendered page of p2-treated
    Then it shows the room's question "Should the family be told?"
    And it links to the top workshop's module M1 page
    And it carries a data-jv-store answer field
    And it shows the tag reason "a signature crosses"

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::a_reference's_href_resolves_from_the_site's_root,_as_the_workshop_pages_resolve_it
  Scenario: A reference's href resolves from the site's root, as the workshop pages resolve it
    Given the rendered page of p2-treated, five levels below the site root
    Then the relative references "journeys.html#p2" and "vaxlink/" are prefixed with "../../../../../"
    And the absolute and fragment references are kept as written
    And no bare relative reference is left

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::the_journey_page_and_the_workshop_pages_reach_the_same_file_for_one_relative_href
  Scenario: The journey page and the workshop pages reach the same file for one relative href
    Given the walkthrough page of P2 in the policy workshop
    When its journeys.html#p2 link is resolved from its own path
    Then it lands on the same file as the journey page's link

  @test:scripts/tests/journeys-viz.test.ts::a_journey_page::follows_and_partOf_are_links
  Scenario: Follows and partOf are links
    Given the rendered journey pages
    Then p2-treated links to p1-checked with rel "prev"
    And t1-away links to t-group with rel "up"

  @test:scripts/tests/journeys-viz.test.ts::illustrations:_the_picture_carries_no_text,_the_page_does::a_resolved_src_is_copied_beside_the_page,_with_the_step_title_above_and_the_alt_below_as_page_text
  Scenario: A resolved illustration is copied beside the page, with the step title above and the alt below
    Given the rendered page of p2-treated
    Then its illustration figure shows the image "img/<P2 anchor>.png" with the alt text
    And the step title comes before the image and the caption after it
    And the image file is emitted beside the page holding the PNG fixture

  @test:scripts/tests/journeys-viz.test.ts::illustrations:_the_picture_carries_no_text,_the_page_does::without_a_picture,_the_journey_page_carries_the_brief:_style,_cast_and_the_step's_prompt
  Scenario: Without a picture the journey page carries the illustration brief
    Given the rendered page of t1-away, whose step has a prompt and no image
    Then it has an "Illustration brief" details block
    And it includes the step's prompt, the style prompt, the cast description and the notes
    And it has no illustration figure

  @test:scripts/tests/journeys-viz.test.ts::the_workshop_layer::a_module_page_lists_its_questions_along_the_journey,_linking_each_step
  Scenario: A module page lists its questions along the journey, linking each step
    Given the module M1 page of the policy workshop
    Then the P1 question comes before the P2 question
    And it links to step P2 of p2-treated
    And it lists the objective "Name the capabilities" and the resource "Facilitator card"

  @test:scripts/tests/journeys-viz.test.ts::the_workshop_layer::a_module's_tables_are_drawn_on_its_page
  Scenario: A module's tables are drawn on its page
    When the module M2 page is read
    Then it shows the table row "Trust anchor"

  @test:scripts/tests/journeys-viz.test.ts::the_workshop_layer::the_sheets_page_carries_the_cover_and_one_sheet_per_declared_sheet,_with_its_assessment_strip
  Scenario: The sheets page carries the cover and one sheet per declared sheet, with its assessment strip
    Given the sheets page of the policy workshop
    Then it has 2 sheets, one of them the cover
    And it has an assessment strip
    And it names the capability "A viewer"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::an_overview_and_one_page_per_step,_in_the_workshop's_teaching_order
  Scenario: The presentation has an overview and one page per step, in the workshop's teaching order
    When the walkthrough pages of the policy workshop are listed
    Then they are P1 then P2
    And assets/present.css and assets/present.js are emitted

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::they_decline_the_harness_rail_and_draw_their_own_frame_from_the_workshop's_presentation
  Scenario: Presentation pages decline the harness rail and draw their own frame
    Given the overview and the P1 and P2 walkthrough pages
    Then each opts out of the navbar and is not navbar-linked
    And each shows the name "PilgrimLink" and the range "P1 → P2 (here ⇄ there)"
    And each was rendered by "journeys-viewer"
    And the overview links the IG in a new tab with its frame label "FHIR IG"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::the_overview:_the_story,_a_card_per_chapter_opening_its_first_step,_the_cast,_the_ladder
  Scenario: The overview shows the story, a card per chapter opening its first step, the cast and the ladder
    Given the overview page
    Then it shows the story and "Two moments that matter"
    And a moment card links to "../walkthrough/P1/" with the title "Checked"
    And it says "Appears in 2 of 2 steps" and links P2
    And it shows the presenter note "Lead with people."
    And its ladder has the rungs "On paper" then "Shared"
    And the "Shared" rung links P2

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::a_step:_prev_and_next_for_the_keys,_the_last_one_going_on_to_the_discussion
  Scenario: A step page has prev and next links for the keys, the last going on to the discussion
    Given the P1 and P2 walkthrough pages
    Then P1 links prev to the overview and next to P2
    And P2 links prev to P1
    And P2 shows "Discuss"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::a_step:_its_record_on_the_ladder,_whose_record_it_is,_and_that_it_moved_up
  Scenario: A step shows its record on the ladder, whose record it is, and that it moved up
    Given the P2 walkthrough page
    Then it says "Ana’s record"
    And its state is "Shared"
    And it says "▲ Moved up"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::a_step:_the_room's_question,_the_questions_by_module,_the_tables_it_touches,_the_gap_strip
  Scenario: A step shows the room's question, questions by module, the tables it touches and the gap strip
    Given the P2 walkthrough page
    Then it shows "Should the family be told?"
    And it links module M1
    And it shows "Trust anchor ★" with "— a signature crosses"
    And it has the gap strip input "policy:viewer:status"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::a_step:_the_people,_each_with_the_avatar_in_the_card's_header_(never_inside_a_sentence),_and_under_the_hood
  Scenario: A step shows the people with the avatar in the card's header, and under the hood
    Given the P2 walkthrough page
    Then a who card carries Ana's colour
    And it names "Ben (nurse)" reading the summary, with no avatar inside the name
    And under the hood it shows "Health wallet" with "shows the QR", the Task_Read highlight and the hood toggle

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_pages:_a_workshop_told_in_a_room,_with_no_site_chrome::the_workshop_page_links_to_the_presentation,_and_its_discussion_has_an_anchor
  Scenario: The workshop page links to the presentation, and its discussion has an anchor
    Given the policy workshop's page
    Then it links to "overview/"
    And it has no discussion anchor, since the workshop declares no closing discussion
    When the same workshop is rendered with a closing discussion
    Then its page links to "overview/"
    And it has a "discussion" section anchor holding the discussion's question

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::every_view_has_a_page,_in_the_frame,_and_the_tabs_link_them
  Scenario: Every view has a page in the frame, and the tabs link them
    Given the presentation views map, personas, each persona, how, how/wallet, discuss, sheets, demo and demo/S2
    Then each opts out of the navbar and shows the name "PilgrimLink"
    And the P2 page links the map, personas, how and discuss tabs, none disabled
    And the map's BPMN drawing is emitted as map/bpmn/processes-care.svg

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_map:_a_lane_per_person_to_focus_on,_the_two_toggles,_a_column_per_step,_the_technical_layer,_the_per-view_note
  Scenario: The map has a lane per person to focus on, two toggles, a column per step, the technical layer and the note
    Given the map page
    Then it can focus ana and show pain and tech
    And it has a lane row for cleo
    And it links the wallet block's page
    And a hand-off to a cast member wears their avatar, "Clinic EMR → Ana"
    And it has a hidden panel, "Open screen S2" and the note "Read across, then down."

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_persona_lens:_needs,_frustrations,_the_curve's_points_linking_to_steps,_the_touchpoints;_a_glyph_for_an_icon
  Scenario: The persona lens shows needs, frustrations, curve points linking to steps, touchpoints, and a glyph for an icon
    Given the persona page of ana
    Then it shows her need and frustration
    And a curve point links to P2 titled "P2 Step P2: Worried"
    And it says "Ana’s touchpoints (2)"
    And the personas index links "ana/"
    And Cleo, who has an icon, wears it as an icon avatar on her page and the map, while Ana keeps the initial "A"
    And the curve's axis shows happy, neutral and sad faces

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::how_it_works:_the_big_ideas,_the_grid,_a_block's_detail_with_the_moments_that_use_it
  Scenario: How it works shows the big ideas, the grid, and a block's detail with the moments that use it
    Given the how page and the wallet block page
    Then the how page shows "Carry it yourself", a teal chip linking the wallet block, and "Select a building block"
    And the wallet page shows "So what for the journey", the spec link, the role "shows the QR" and the process "Read the patient's summary"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_discussion:_the_closing_question,_the_moments_to_revisit,_the_tables_with_what_forces_each_row,_the_gap_report
  Scenario: The discussion shows the closing question, the moments, the tables' forces and the gap report
    Given the discuss page
    Then it shows "What must countries agree on?"
    And its gap-report model holds the viewer capability with its storage name, P2 link and module M1
    And the model's status options are yes and no, with no urgency scale
    And it loads gap-report.js, offers print and CSV, and assets/gap-report.js is emitted
    And it shows "Forced by:" and links the P2 walkthrough

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::a_step:_its_screen,_its_FHIR_change_with_Inspect_JSON,_the_payload_drawer,_the_IG's_process_and_scenario_pages
  Scenario: A step shows its screen, its FHIR change with Inspect JSON, the payload drawer and the IG's pages
    Given the P2 walkthrough page
    Then it links demo screen S2 with "(screen S2)"
    And it can inspect "Bundle/ana-ips", whose link reads "Ana's IPS" with the id as its tooltip
    And it shows the highlighted JSON key "resourceType"
    And it shows the change "Read, not stored" and "Intl profile"
    And it links the IG's business-processes and journeys pages from the site root
    And it has the scene strip

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_device_demo_frames_the_app's_screen_and_links_back_to_its_moments
  Scenario: The device demo frames the app's screen and links back to its moments
    Given the demo page of screen S2
    Then it frames the app at "#/demo/S2" as a tablet
    And it links the P2 walkthrough
    And it says "Stage P2 (" and "Flip the toggle"

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-01:_each_view_lists_its_ArchiMate_elements,_and_a_block's_page_the_elements_that_deploy_it,_each_linked
  Scenario: Each view lists its ArchiMate elements, and a block's page the elements that deploy it
    Given the how page and the wallet block page
    Then each says "The 1 element in this view"
    And the wallet page links the wallet-app element page
    And it shows "In the architecture (ArchiMate)" with "Application Component"
    And any other block page does not show the architecture section

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-02:_every_view_has_the_payload_drawer;_a_view_page_loads_each_payload_from_one_shared_file,_a_step_page_carries_it
  Scenario: Every view has the payload drawer, a view page loading each payload from one shared file and a step page carrying it
    Given each presentation view page
    Then each has the drawer, a tab for "Bundle/ana-ips" and a copy button
    And each loads the JSON from the one shared payload/Bundle-ana-ips.json
    And that file is the Bundle "ana-ips", emitted once
    And the demo screen says "resource on this screen"
    And the P2 step page keeps its JSON inline with no data-jp-src

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-08:_the_drawer's_bar_names_the_active_stage,_and_the_workshop's_inspector_title,_key_and_hint
  Scenario: The drawer's bar names the active stage, and the workshop's inspector title, key and hint
    Given the presentation pages
    Then the P2 page's chip says "Active Stage: P2", the map's "Active Stage: Journey map" and screen S2's "Active Stage: S2 · P2"
    And the default inspector title is "FHIR payload inspector" with no key
    And with a workshop inspector title, key and hint, the P2, map and S2 pages show the escaped title, the key with its icon, and the hint

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_lab:_the_Discussion_view_as_timed_steps,_the_journey's_questions_answered_under_the_walkthrough's_keys,_a_summary
  Scenario: The lab turns the Discussion view into timed steps, with the journey's questions and a summary
    Given the walkthrough's question write-ins keyed "policy:q:P2:0" and "policy:q:P2:1", and no lab on the plain discuss page
    When a workshop with a five-step lab, use cases, a readiness scale and a readiness table is rendered
    Then the workshop passes the schema
    And the discuss page has 5 lab tabs numbered from 0, a 5-minute timer, the Discuss prompt and the step note
    And the journey's use case comes ticked, the other not, and the statement starts from the use-case text and can be reset
    And the walkthrough's question keys reappear, readiness rows are grouped and rated, decision rights have holders, and the gap strip's radios are present
    And the summary model lists the five steps and every answer's name, with the gap report, CSV, closing-question write-in and credit link
    And a lab naming a table the workshop does not list is refused by the schema

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-07:_every_page's_header_has_Reset_Simulation,_scoped_to_the_workshop,_returning_to_the_overview
  Scenario: Every page's header has Reset Simulation, scoped to the workshop, returning to the overview
    Given the overview, P2, map, how and demo/S2 pages
    Then each has a reset scoped to "policy" pointing back to the overview at its own depth
    And each shows "Reset Simulation"
    And present.js wires every data-jp-reset element

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-11:_the_map's_moment_columns_are_narrow_enough_on_a_desktop_for_eight,_and_a_chapter's_name_wraps,_never_cut
  Scenario: The map's moment columns fit eight on a desktop, and a chapter's name wraps, never cut
    Given present.css
    Then at min-width 1280px the map grid has a 132px column and steps of at least 136px
    And 132 + 8 × 136 fits within a 1400px window less gutters
    And a chapter name is not cut with an ellipsis

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::JV-13:_How_it_works_opens_with_the_architecture_panel_from_the_ArchiMate_graph,_then_the_views,_then_the_big_ideas
  Scenario: How it works opens with the architecture panel, then the views, then the big ideas
    Given a workshop architecture spec for model "ra" with two countries, a shared group and a note, and site links supplying the panel
    When the how page is rendered
    Then it shows the country code "AA", "Country A (north)" and "Country B"
    And it shows "Wallet app" linking its IG page, its moment P2, and "Not needed in this journey"
    And it shows "Open standards", "Trust network" and the note
    And the architecture grid, the views, the big ideas and the blocks appear in that order
    And a spec naming a model not held says it "is not in this layer's ArchiMate graph"
    And the workshop passes the schema

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::the_drawer's_script_colours_JSON_exactly_as_the_build_does
  Scenario: The drawer's script colours JSON exactly as the build does
    Given the esc and highlightJson functions extracted from present.js
    When they colour a JSON document with strings, numbers, booleans, null, quotes and markup
    Then the result equals the build's highlightJson
    And the script falls back to a link when opened over file:

  @test:scripts/tests/journeys-viz.test.ts::the_presentation_views:_map,_persona_lens,_how_it_works,_discussion,_sheets,_device_demo::no_font_is_shipped:_the_slides_use_the_system's_own_(owner,_2026-11-12)
  Scenario: No font is shipped; the slides use the system's own
    Given the rendered files
    Then none is under assets/fonts/
    And present.css has no @font-face
    And it sets the sans and mono stacks to system-ui and ui-monospace

  @test:scripts/tests/journeys-viz.test.ts::a_workshop_with_none_of_the_optional_data_still_presents::no_device_demo,_no_IG,_no_catalogue,_no_index:_the_views_draw_what_there_is
  Scenario: A workshop with none of the optional data still presents
    Given the corpus with no blocks, no examples and no presentation, rendered with no site links
    Then the P2 walkthrough has no drawer
    And its device tab is disabled, saying no device screen shows a step
    And the how page says no building-block catalogue is declared
    And no demo pages are emitted

  @test:scripts/tests/journeys-viz.test.ts::architecturePanel:_the_How_it_works_panel_read_from_an_ArchiMate_model_(JV-13)::rows_are_the_root's_groupings,_columns_the_countries
  Scenario: The architecture panel's rows are the root's groupings and its columns the countries
    Given an ArchiMate model of layers, blocks, two countries and a shared grouping
    When the architecture panel is read for root "root"
    Then the rows are Point of service, Foundational and Interop
    And the countries are Country A and Country B

  @test:scripts/tests/journeys-viz.test.ts::architecturePanel:_the_How_it_works_panel_read_from_an_ArchiMate_model_(JV-13)::a_system's_parts_go_in_the_row_of_the_block_their_country's_instance_specializes,_with_the_BPMN_it_serves
  Scenario: A system's parts go in the row of the block their country's instance specializes, with the BPMN it serves
    Given the same panel
    Then Country A's Point of service cell holds Birth EHR under Provider Systems, with its IG link and processes/j1.bpmn
    And Country A's Foundational cell holds DVC signer
    And Country B's Point of service cell holds Family wallet under Citizen Apps with processes/j4.bpmn

  @test:scripts/tests/journeys-viz.test.ts::architecturePanel:_the_How_it_works_panel_read_from_an_ArchiMate_model_(JV-13)::a_block_two_layers_hold_sits_in_the_first;_a_row_no_country_uses_lists_its_own_blocks
  Scenario: A block two layers hold sits in the first, and a row no country uses lists its own blocks
    Given the same panel
    Then Country B's Foundational cell holds Gateway
    And every Interop cell is empty
    And the Interop row lists Mediator and Open standards

  @test:scripts/tests/journeys-viz.test.ts::architecturePanel:_the_How_it_works_panel_read_from_an_ArchiMate_model_(JV-13)::the_shared_grouping_is_the_foundation;_a_ref_the_model_lacks_gives_no_panel
  Scenario: The shared grouping is the foundation, and a ref the model lacks gives no panel
    Given the same panel
    Then its shared members are Trust network
    And a panel for root "nowhere" is undefined

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::shortTitle_drops_a_step_code_and_its_dash,_and_nothing_else
  Scenario: shortTitle drops a step code and its dash, and nothing else
    When step titles are shortened
    Then "J1 — Born abroad" gives "Born abroad" and "J4.0 — Crossing back: one family" gives "Crossing back: one family"
    And "T — The whole trip" gives "The whole trip" and "P0 · Before the season" gives "Before the season"
    And "Born abroad" and "Ministry of Health — the track" are unchanged

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::chapterRoots:_one_level_below_what_every_taught_journey_shares
  Scenario: Chapter roots are one level below what every taught journey shares
    Given the corpus
    When the chapter roots of t1-away and t2-home are found
    Then each is its own chapter
    And with p1-checked added, the chapters are p1-checked, t-group and t-group

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::presentationOf:_chapters,_keys_and_the_cast_in_order_of_first_appearance
  Scenario: The presentation has chapters, keys and the cast in order of first appearance
    When the presentation of the policy workshop is built
    Then its chapters are Checked and Treated
    And its steps are P1 in chapter 0 and P2 in chapter 1
    And its cast is ana, ben, cleo
    And step P2 carries the room's question

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::an_overview_card:_the_picture_first,_the_strip_(labelled,_VaxLink's_size)_and_the_people_at_its_foot
  Scenario: An overview card shows the picture first, the labelled strip and the people at its foot
    Given the overview's moment card that has a picture
    Then the picture comes before the moment title
    And the summary comes before the foot
    And the scene strip is medium-sized and labelled "A clinic"

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::JV-09:_presentation.tagRows_groups_a_step's_tags_into_the_policy_card's_rows,_with_their_glyphs,_in_its_order
  Scenario: presentation.tagRows groups a step's tags into the policy card's rows, with glyphs, in its order
    Given a workshop whose tagRows are "Cost driver" over an unlisted table and "Forces" over the rights table
    When the P2 walkthrough is rendered
    Then its forces list has a "Forces" row with a glyph and the pill "Trust anchor ★"
    And it does not show the table title "Decision rights" or the empty "Cost driver" row
    And the schema refuses the workshop whose row names an unlisted table, and accepts it with only the Forces row

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::JV-14:_the_sheets_open_with_a_cover,_its_own_page:_the_blanks,_the_scope_promise,_the_ways_to_start
  Scenario: The sheets open with a cover page holding the blanks, the scope promise and the ways to start
    Given the default sheets page
    Then it opens with an A3 cover before sheet s1, with blanks Country, Delegation, Table and Facilitator, and no ways to start
    When a workshop with a promise and a cover of fields Country and Table over the rights table is rendered
    Then its sheets page shows the scope promise and the rights rows as ways to start, beginning "Trust anchor"
    And it has no Delegation blank and says "A cover and 1 sheet,"
    And journeys.css breaks every printed sheet to its own page
    And the schema accepts that workshop and refuses a cover naming an unlisted table

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::presentation.cast_orders_the_cast_everywhere;_presentation.chapterTitles_names_a_chapter
  Scenario: presentation.cast orders the cast everywhere, and presentation.chapterTitles names a chapter
    Given a workshop whose presentation cast is cleo, ghost, ana and which titles p2-treated "Crossing back"
    When its presentation is built
    Then the cast is cleo, ana, ben
    And the chapters are Checked and Crossing back
    And castOrder keeps the order with no declaration, and puts declared ids first, once, dropping unknown ones

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::personaText_marks_whole-word_names,_longest_first,_puts_no_avatar_in_the_sentence,_and_escapes_the_rest
  Scenario: personaText marks whole-word names, longest first, with no avatar and the rest escaped
    Given people named "Anan" and "Dr. Anan"
    When "Dr. Anan meets Ananda <b>" is marked
    Then only "Dr. Anan" is wrapped as a named span, "Ananda" is untouched and "<b>" is escaped

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::mentioned:_the_people_a_sentence_names,_in_the_cast's_order,_without_the_card's_own_person;_their_chips_go_in_the_header
  Scenario: mentioned finds the people a sentence names, in cast order, without the card's own person
    Given people Somsack, Khamla and Vilay
    Then a sentence naming Vilay, Somsack and Vilay again mentions s then v
    And "Khamla brings Somsack" for Khamla's own card mentions only s
    And a sentence naming nobody gives no chips
    And "Tells Vilay" gives a mentions chip with Vilay's small avatar

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::links_out:_kramdown_anchors,_page_patterns,_the_site's_root,_JSON_colouring
  Scenario: Links out: kramdown anchors, page patterns, the site's root and JSON colouring
    When the link helpers are applied
    Then kramdownSlug turns step titles into GitHub-style anchors such as "j1--born-abroad-thailand-birth-day"
    And fillPattern fills "{type}-{id}" placeholders
    And fromSite prefixes a relative href but keeps absolute and root-relative ones
    And siteRootFrom climbs out of the route "en/h/journeys" to "../../../../../"
    And highlightJson wraps punctuation, keys, strings, numbers, booleans and null in spans, escaping markup and keeping escaped quotes inside a string

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::unescapeXml_resolves_each_entity_once:_an_escaped_ampersand_is_not_unescaped_again
  Scenario: unescapeXml resolves each entity once
    When "&amp;lt;" is unescaped
    Then it gives "&lt;"
    And the numeric, named and quote entities each resolve
    And an unknown entity and a bare ampersand are kept

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::the_views'_pure_helpers:_feeling_points,_block_usage,_step_refs,_screens
  Scenario: The views' pure helpers give feeling points, block usage, step refs and screens
    Given the policy workshop's presentation
    Then ana's feeling points are emotion 1 at 0 and -1 at 1, and cleo has none
    And the wallet is used at P2 to "shows the QR"
    And step refs resolve "p2-treated#P2" and "P1", but not a journey the workshop does not teach
    And the demo is "frame", P2's screens are S2, and S2's href is "../app/#/demo/S2"

  @test:scripts/tests/journeys-viz.test.ts::presentation_helpers::small_ones
  Scenario: Small presentation helpers
    Then countWord spells 4 as "Four" and leaves 40 as digits
    And rangeLabel joins first and last step ids with the scope, or gives one id alone
    And countryTones assigns amber, sky and indigo to distinct countries in order
    And rungOf gives a step's record state's index on the ladder, or -1 without one
    And viewBoxWidth reads the viewBox width, else the width attribute, else nothing

  @test:scripts/tests/journeys-viz.test.ts::helpers::orderByFollows_walks_each_chain_from_its_start
  Scenario: orderByFollows walks each chain from its start
    Given journeys c follows b, a, b follows a, and z follows one outside the set
    When they are ordered by follows
    Then the order is a, b, c, z

  @test:scripts/tests/journeys-viz.test.ts::helpers::bpmnFigure_never_assembles_a_comment_opener_from_a_drawing's_pieces
  Scenario: bpmnFigure never assembles a comment opener from a drawing's pieces
    Given a drawing whose comment fragments could join into "<!--"
    When the figure is built highlighting A with caption "c"
    Then the fragments are kept as they were and no unclosed comment opener precedes the group
    And it highlights A and has the caption "c"

  @test:scripts/tests/journeys-viz.test.ts::helpers::bpmnFigure_leaves_a_drawing_alone:_no_task_named,_no_highlight;_no_sidecar,_no_panel
  Scenario: bpmnFigure leaves a drawing alone with no task named, and adds no panel without a sidecar
    When a figure is built with no tasks and no sidecar
    Then the drawing's group is unchanged with no highlight and no data-panel
    And with tasks A, B, A and a sidecar the figure carries the panel and the highlight "A B"

  @test:scripts/tests/journeys-viz.test.ts::helpers::the_common_task_panel's_client_and_styles_are_written_with_the_assets,_and_only_a_page_with_a_drawing_loads_them
  Scenario: The common task panel's client and styles are written with the assets, and only a page with a drawing loads them
    Then assets/task-panel.js and task-panel.css are the common panel script and styles
    And the index page does not load the task panel
    And panelHead of a page with no drawing is empty

  @test:scripts/tests/journeys-viz.test.ts::the_drawings_are_clickable_the_way_the_KG_site_renders_them::a_BPMN_step's_TITLE_links_to_its_page_(linkSteps),_from_the_journey_page's_depth_and_the_walkthrough's
  Scenario: A BPMN step's title links to its page from the journey page and the walkthrough
    Given the p2-treated journey page and the P2 walkthrough
    Then each has 2 task-title links, landing on the Task_Read and Task_Other step pages
    And the title link targets the top frame with the accessible name "Open step: Read the summary"
    And the Task_Read highlight is kept
    And the panel sidecar lands on "en/kg/processes/care.tasks.json"

  @test:scripts/tests/journeys-viz.test.ts::the_drawings_are_clickable_the_way_the_KG_site_renders_them::an_absolute_step_page_(a_subject_IRI)_is_linked_as_it_is
  Scenario: An absolute step page is linked as it is
    Given site links whose step pages are absolute IRIs
    When the journey page is rendered
    Then a task-title link is "https://example.org/kg/process/P/node/Task_Read"

  @test:scripts/tests/journeys-viz.test.ts::the_drawings_are_clickable_the_way_the_KG_site_renders_them::where_no_step_page_is_published_(a_downstream_site),_a_title_links_the_process's_section_in_the_IG_instead
  Scenario: Where no step page is published, a title links the process's section in the IG
    Given site links that publish no step page
    When the journey page and the P2 walkthrough are rendered
    Then each has 2 task-title links, all landing on business-processes.html
    And each ends with "#read-the-patients-summary"

  @test:scripts/tests/journeys-viz.test.ts::the_drawings_are_clickable_the_way_the_KG_site_renders_them::an_ArchiMate_view_is_an_<object>,_so_the_elements_in_it_open_their_pages;_its_data_and_caption_resolve_from_the_page
  Scenario: An ArchiMate view is an object, so its elements open their pages, with data and caption resolved from the page
    Given the p2-treated journey page
    Then no ArchiMate view is drawn as an img
    And an object labelled "P2 on the RA" has data landing on archimate/ra/views/v-p2.svg
    And a DAK link lands on the view's page "en/lower/archimate/ra/views/v-p2/"

  @test:scripts/tests/journeys-viz.test.ts::personas_and_other_DAK_assets_link_to_their_pages_in_the_IG::a_persona_plays_a_role_the_IG_defines:_its_name_links_to_that_ActorDefinition;_one_with_none_stays_text
  Scenario: A persona's name links to the ActorDefinition of the role it plays; one with none stays text
    Then pascal turns "birth-clinic-vaccinator" into "BirthClinicVaccinator"
    And ana's persona artifact is "ActorDefinition/Demo.Role.Pilgrim" while ben has none
    And the walkthrough, journey page and overview each link the ActorDefinition page
    And Ben appears as plain bold text
    And personaText links Ana's name in prose with no avatar, and leaves Ben a plain named span

  @test:scripts/tests/journeys-viz.test.ts::personas_and_other_DAK_assets_link_to_their_pages_in_the_IG::a_FHIR_example_links_to_its_IG_page,_in_the_hood_and_in_the_payload_drawer;_a_profile_the_index_does_not_list_stays_text
  Scenario: A FHIR example links to its IG page in the hood and the payload drawer; an unlisted profile stays text
    Given the P2 walkthrough
    Then a DAK link lands on "Bundle-ana-ips.html"
    And the drawer's pane links the same page
    And the profile "ips-bundle" is plain text reading "Intl profile"

  @test:scripts/tests/journeys-viz.test.ts::a_step's_DAK_assets:_one_row,_grouped_by_what_each_is_to_the_step,_linked_into_the_IG::the_walkthrough's_hood_draws_Data,_Decision_logic,_Indicators_in_that_order,_each_asset_linked;_one_the_index_does_not_list_stays_text
  Scenario: The walkthrough's hood draws Data, Decision logic and Indicators in order, each linked; an unlisted one stays text
    Given the P2 walkthrough's DAK row
    Then its groups are data, decides, measures, labelled Data, Decision logic, Indicators
    And its links land on the data set, decision table and indicator pages in that order
    And the data set link is titled with its key and description
    And Measure/IND99, which the index does not list, is plain text "IND99"

  @test:scripts/tests/journeys-viz.test.ts::a_step's_DAK_assets:_one_row,_grouped_by_what_each_is_to_the_step,_linked_into_the_IG::the_journey_page's_step_lists_the_same_assets_under_DAK_assets
  Scenario: The journey page's step lists the same assets under DAK assets
    Given the p2-treated journey page's DAK assets list
    Then its terms are Data, Decision logic, Indicators
    And its links land on the same three pages
    And IND99 is plain text

  @test:scripts/tests/journeys-viz.test.ts::a_step's_DAK_assets:_one_row,_grouped_by_what_each_is_to_the_step,_linked_into_the_IG::a_step_that_names_none_draws_no_row
  Scenario: A step that names no DAK asset draws no row
    When the P1 walkthrough is read
    Then it has no DAK row

  @test:scripts/tests/journeys-viz.test.ts::the_check_over_a_staged_site:_every_DAK_link_resolves_to_a_file::every_rendered_DAK_link_names_a_page_the_IG_and_the_KG_publish
  Scenario: Every rendered DAK link names a page the IG and the KG publish
    Given a staged site of the rendered files plus a page for every target
    Then the targets include the ActorDefinition, Bundle, PlanDefinition, Measure, StructureDefinition and Task_Read step pages
    When the DAK links are checked
    Then there are no findings and more than 10 links were checked

  @test:scripts/tests/journeys-viz.test.ts::the_check_over_a_staged_site:_every_DAK_link_resolves_to_a_file::a_page_that_is_not_there,_an_element_link_inside_a_drawing_that_is_not_there,_and_the_bare_IHE_VHL_root_are_findings
  Scenario: A missing page, a missing element link inside a drawing, and the bare IHE VHL root are findings
    Given the staged site with the ActorDefinition page and the wallet element page removed, and a page linking the bare VHL root and a VHL page
    When the DAK links are checked
    Then findings name the missing ActorDefinition page and, from the view SVG, the missing element page
    And exactly one finding names the bare IHE VHL root
    And a link to an anchor missing from its page is a finding 'no id "nowhere" in Bundle-ana-ips.html'
    And the bare-VHL pattern matches the root but not a page under it

  @test:scripts/tests/journeys-viz.test.ts::composition_(user-scenario_0.4.0):_a_parent's_parts,_in_its_order,_and_a_step_that_is_a_journey::the_parent's_page_lists_its_parts_in_its_order,_marking_an_optional_or_repeating_one
  Scenario: The parent's page lists its parts in its order, marking an optional or repeating one
    Given a 0.4.0 layer where trip has parts home and away, away optional and repeating
    When the trip page is rendered
    Then under "Parts, in story order" C1 — Home comes before C2 — Away
    And C2 — Away is marked "optional" and "repeats"
    And trip's personas are derived as ana

  @test:scripts/tests/journeys-viz.test.ts::composition_(user-scenario_0.4.0):_a_parent's_parts,_in_its_order,_and_a_step_that_is_a_journey::the_index_nests_the_parts_in_that_order;_a_part's_neighbours_are_its_parent's
  Scenario: The index nests the parts in order, and a part's neighbours are its parent's
    Given the same layer
    Then the index shows "2 parts" with C1 — Home before C2 — Away
    And the home page links up to trip and next to away

  @test:scripts/tests/journeys-viz.test.ts::composition_(user-scenario_0.4.0):_a_parent's_parts,_in_its_order,_and_a_step_that_is_a_journey::a_step_that_includes_a_journey_links_to_it
  Scenario: A step that includes a journey links to it
    When the home page is read
    Then it says the step is the journey "C2 — Away", linked
