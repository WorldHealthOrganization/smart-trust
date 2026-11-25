# The state dashboards: their route, and what each page can and cannot claim,
# read from the pages the generator wrote. Each Scenario names the test that
# executes it.
Feature: State graph dashboards

  @test:scripts/tests/state-visualizer.test.ts::the_route_is_the_policy,_not_this_generator's_choice::the_visualiser_is_AT_its_declared_route,_`<harness>/<visualiser>/`,_one_per_declared_visualiser
  Scenario: Each dashboard is at its declared route
    Given the beans, todos, qa, health, issue-marks and uploads dashboards are built
    Then each has a page at its declared route
    And none has a page at the site root

  @test:scripts/tests/state-visualizer.test.ts::the_route_is_the_policy,_not_this_generator's_choice::no_stub_segment,_and_no_invented_one
  Scenario: No stub or invented route segment
    Then the site has no folio-assistant, state or state-visualizer directory
    And the beans dashboard has no dashboard sub-directory

  @test:scripts/tests/state-visualizer.test.ts::the_route_is_the_policy,_not_this_generator's_choice::the_segment_is_the_declared_ID,_because_two_paths_basename_alike
  Scenario: The route segment is the declared id
    Given the qa and health dashboards are built
    Then both pages exist
    And there is no "results" dashboard

  @test:scripts/tests/state-visualizer.test.ts::each_page_reads_the_projection_that_already_exists::relative_to_itself,_at_the_depth_its_own_route_implies
  Scenario: The beans page links its projection relative to itself
    Given the beans dashboard is built
    Then it links assets/beans/index.json with one ../ per route segment

  @test:scripts/tests/state-visualizer.test.ts::each_page_reads_the_projection_that_already_exists::and_that_projection_is_really_there
  Scenario: The beans and todos projections exist
    Given the docs projections are built
    Then assets/beans/index.json and assets/todos/index.json exist

  @test:scripts/tests/state-visualizer.test.ts::each_page_reads_the_projection_that_already_exists::a_graph_page_names_only_its_own_graph
  Scenario: A dashboard names only its own graph
    Given the beans and todos dashboards are built
    Then the beans page has neither source meta and asks its container for beans only
    And the todos page has neither source meta

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::a_graph_with_no_projection_says_so_instead_of_rendering_zeros
  Scenario: A graph with no projection says so
    Given the issue-marks dashboard is built
    Then it says "declared" and names 2krx
    And it mounts no work-plan container and carries no source meta

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::every_page_carries_the_registry,_so_the_set_is_navigable_from_any_of_them
  Scenario: Every dashboard but todos carries the registry
    Given the beans, qa, health and uploads dashboards are built
    Then each says "State graphs this harness declares"
    And qa links ../beans/ and beans links ../todos/

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::a_page_never_links_to_itself
  Scenario: A page never links to itself
    Then the beans page does not link ../beans/ and the todos page does not link ../todos/
    And the beans page shows beans as the current row

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::EVERY_dashboard_is_a_themed_page,_so_every_one_carries_the_top_band_(#2418)
  Scenario: Every dashboard is a themed page
    Given at least one of the eight dashboards is built
    Then each built one starts with default-layout front matter and has no doctype
    And none inlines the renderer or any script
    And each has an h1 with an explicit id

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::the_beans_page_is_THEMED,_so_it_carries_the_site's_top_band_(#2418)
  Scenario: The beans page is themed
    Then it starts with default-layout front matter, has no doctype and inlines no renderer
    And it has the beans-only work-plan container and the registry

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::the_todos_page_is_the_landing's_sticky_panel,_open,_on_a_themed_page_(#1906)
  Scenario: The todos page is the landing's open sticky panel
    Then it is a themed page with no doctype and no inlined renderer
    And it includes landing.html with open=true
    And it has neither the registry nor the by-node list
    And it has no renders: line and names rendered-by: state-viewer

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::the_landing_include_opens_the_panel_only_when_asked
  Scenario: The landing include opens the panel only when asked
    Then landing.html opens its sticky panel only if include.open
    And the site index includes landing.html bare

  @test:scripts/tests/state-visualizer.test.ts::what_a_page_may_claim::every_page_carries_the_do-not-hand-edit_notice
  Scenario: Every dashboard says not to hand-edit it
    Then the beans, todos and qa pages each say "Do not hand-edit"

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::a_graph_whose_declaration_names_a_visualiser_says_so,_and_links_to_it
  Scenario: A graph with a declared visualiser says it is rendered elsewhere
    Then the uploads page says "rendered elsewhere" and not that nothing publishes a projection

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::the_link_is_a_real_directory_under_this_site,_not_a_fabricated_path
  Scenario: The rendered-elsewhere link resolves
    Then the uploads page's rendered-elsewhere link resolves to a directory holding index.html

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::it_is_labelled_with_the_URL_a_reader_sees,_never_the_repo_path
  Scenario: The rendered-elsewhere link is labelled with a URL
    Then the link's label starts with "/" and does not contain "docs/"

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::and_the_graph_that_page_renders_really_is_the_one_being_pointed_at
  Scenario: The linked page renders the uploads queue
    Then the page the link reaches mentions "uningested"

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::a_graph_with_NO_declared_visualiser_still_says_nothing_renders_it
  Scenario: A graph with no declared visualiser says nothing publishes it
    Then the issue-marks page says nothing publishes a projection for it yet, not "rendered elsewhere"

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::health_and_attestations_point_at_this_instance's_own_per-instance_page_(bean_folio-assistant-1nu0)
  Scenario: Health and attestations point at their per-instance page
    Then the health and attestations pages say "rendered elsewhere" and link cat-harness/

  @test:scripts/tests/state-visualizer.test.ts::no_projection_here_is_not_the_same_as_nothing_renders_this::no_page_claims_a_visualiser_that_is_not_there
  Scenario: No dashboard claims a missing visualiser
    # Gap: a corpus check only; the unresolved state it guards is exercised by the fixture scenarios below, not here.
    Then none of the six built dashboards says "not there"

  @test:scripts/tests/state-visualizer.test.ts::declaredVisualiserFor_—_the_four_outcomes,_against_fixtures::no_declared_visualiser_is_`declared`_—_unchanged,_and_the_common_case
  Scenario: No declared visualiser is declared
    Then qa with no declared visualiser is "declared"

  @test:scripts/tests/state-visualizer.test.ts::declaredVisualiserFor_—_the_four_outcomes,_against_fixtures::a_declared_visualiser_that_resolves_is_`elsewhere`,_with_a_page-relative_href
  Scenario: A resolving declared visualiser is elsewhere with an href
    Given a page that exists under the site
    Then uploads declaring it is "elsewhere" with the page-relative href and the declared path

  @test:scripts/tests/state-visualizer.test.ts::declaredVisualiserFor_—_the_four_outcomes,_against_fixtures::a_declared_visualiser_that_is_NOT_there_is_`unresolved`,_never_`elsewhere`
  Scenario: A missing declared visualiser is unresolved
    Then uploads declaring a page that does not exist is "unresolved" with no href, keeping the declared path

  @test:scripts/tests/state-visualizer.test.ts::declaredVisualiserFor_—_the_four_outcomes,_against_fixtures::a_visualiser_OUTSIDE_the_site_is_`elsewhere`_but_carries_no_href
  Scenario: A visualiser outside the site has no href
    Then uploads declaring an existing page outside the site is "elsewhere" with no href

  @test:scripts/tests/state-visualizer.test.ts::declaredVisualiserFor_—_the_four_outcomes,_against_fixtures::resolution_is_against_the_REPO_root,_not_the_instance_root
  Scenario: Resolution is against the repository root
    Then the repo-root spelling of an existing page is "elsewhere"
    And the instance-relative spelling of it is "unresolved"

  @test:scripts/tests/state-visualizer.test.ts::this_generator's_own_pages_are_own_at_EITHER_address_—_the_first_run_after_the_locale_move::only_the_OLD-address_page_is_on_disk:_the_ref_names_it,_and_it_is_own
  Scenario: Only the old-address page exists, and it is own
    Given a site holding only cat-harness/health/index.html
    Then health's page ref is the old address
    And it is one of the generator's own refs

  @test:scripts/tests/state-visualizer.test.ts::this_generator's_own_pages_are_own_at_EITHER_address_—_the_first_run_after_the_locale_move::the_localised_page_is_on_disk:_the_ref_names_it,_and_it_is_own
  Scenario: The localised page exists, and it is own
    Given both the old and the localised health pages exist
    Then health's page ref is the localised page
    And it is one of the generator's own refs

  @test:scripts/tests/state-visualizer.test.ts::this_generator's_own_pages_are_own_at_EITHER_address_—_the_first_run_after_the_locale_move::an_`index.md`_at_the_old_address_is_own_too
  Scenario: An index.md at the old address is own
    Given a site holding cat-harness/issue-marks/index.md
    Then issue-marks' page ref ends in /index.md and is own

  @test:scripts/tests/state-visualizer.test.ts::this_generator's_own_pages_are_own_at_EITHER_address_—_the_first_run_after_the_locale_move::no_page_yet:_the_ref_is_the_localised_`index.html`,_and_it_is_own
  Scenario: With no page yet the ref is the localised index.html
    Given an empty site
    Then health's page ref is the localised index.html and is own

  @test:scripts/tests/state-visualizer.test.ts::this_generator's_own_pages_are_own_at_EITHER_address_—_the_first_run_after_the_locale_move::a_visualiser_this_generator_does_NOT_draw_is_not_own,_at_either_address
  Scenario: A visualiser this generator does not draw is not own
    Given a site holding the old-address qa page and own refs for health only
    Then neither qa's page ref nor its localised address is own

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::a_backticked_span_becomes_code
  Scenario: A backticked span becomes code
    Then "what the sweep under `test/health/` wrote" renders test/health/ as a code element

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::several_spans_on_one_line_each_become_their_own_code_element
  Scenario: Several spans each become code
    Then "`a`, `b` and `c`" renders three code elements

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::ANGLE_BRACKETS_INSIDE_a_span_stay_escaped_—_the_order_is_the_fix
  Scenario: Angle brackets inside a span stay escaped
    Then "one `<bib-slug>/` per document" renders a code element holding &lt;bib-slug&gt;/

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::markup_outside_a_span_is_escaped,_never_emitted
  Scenario: Markup outside a span is escaped
    Then an img tag with an onerror handler renders fully escaped
    And "a & b" renders "a &amp; b"

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::an_UNPAIRED_backtick_is_left_alone,_not_greedy_to_end_of_line
  Scenario: An unpaired backtick is left alone
    Then "a ` b" and "`open and never closed" render unchanged

  @test:scripts/tests/state-visualizer.test.ts::a_declared_description_is_escaped_BEFORE_its_code_spans_are_made::the_corpus_renders_with_no_literal_backtick_left_in_a_registry_row
  Scenario: No registry row on a built dashboard shows a raw backtick
    Given the six dashboards are built
    Then no paragraph in any dashboard's registry list contains a backtick

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::a_page_carrying_our_marker,_under_no_wanted_id,_is_an_orphan
  Scenario: A marked page under no wanted id is an orphan
    Given a site with a generator-marked page under gone/
    Then with beans wanted, gone/index.html is prunable

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::a_page_for_a_WANTED_id_is_never_an_orphan
  Scenario: A marked page for a wanted id is not an orphan
    Given a site with a generator-marked page under beans/
    Then with beans wanted, nothing is prunable

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::a_page_WITHOUT_our_marker_is_never_touched,_even_with_nothing_wanted
  Scenario: Unmarked pages are never prunable
    Given a site of guides, reference and assets pages without the marker
    Then with nothing wanted, nothing is prunable

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::a_directory_with_no_index.html_at_all_is_not_a_candidate
  Scenario: A directory with no index.html is not a candidate
    Given a site with only stuff/notes.md
    Then nothing is prunable

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::ours_and_theirs_side_by_side:_only_ours_is_selected
  Scenario: Only our orphan is selected beside others' pages
    Given a site with a marked gone/, an unmarked guides/ and a marked beans/
    Then with beans wanted, only gone/index.html is prunable

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::a_site_that_does_not_exist_yields_nothing_rather_than_throwing
  Scenario: A missing site yields nothing
    Then a site directory that does not exist gives no prunable pages

  @test:scripts/tests/state-visualizer.test.ts::orphan_dashboards_—_a_page_that_answers_to_no_declaration::ON_THE_REAL_CORPUS:_an_empty_keep-set_selects_only_pages_we_wrote
  Scenario: On the real site an empty keep-set selects only our dashboards
    Given the nine dashboards are built
    And the declaration draws at least one per-instance hub
    When prunable pages are found with nothing wanted
    Then they are exactly the dashboards and hubs this generator writes
    And the site root holds none

  @test:scripts/tests/state-visualizer.test.ts::the_renderer_is_chosen_by_the_projection's_`$schema`,_not_by_the_graph's_id::the_qa_page_mounts_NO_work-plan_container_and_declares_no_src_meta
  Scenario: The qa page mounts no work-plan renderer
    Then the qa page has no work-plan container and no source meta

  @test:scripts/tests/state-visualizer.test.ts::the_renderer_is_chosen_by_the_projection's_`$schema`,_not_by_the_graph's_id::beans_and_todos_still_get_theirs,_so_the_dispatch_did_not_simply_stop_working
  Scenario: Beans and todos still get their renderers
    Then the beans page asks its container for beans only
    And the todos page includes the open landing panel and does not say it has no renderer

  @test:scripts/tests/state-visualizer.test.ts::the_renderer_is_chosen_by_the_projection's_`$schema`,_not_by_the_graph's_id::the_qa_page_renders_one_panel_per_family,_server-side
  Scenario: The qa page renders a panel per family
    Then it names kg-qa/v1, qa-witness/v1 and block-qa/v1 as code

  @test:scripts/tests/state-visualizer.test.ts::the_renderer_is_chosen_by_the_projection's_`$schema`,_not_by_the_graph's_id::and_SAYS_there_is_no_total,_rather_than_leaving_its_absence_to_be_noticed
  Scenario: The qa page says there is no total
    Then it says "no total across these families"
    And it names totals, counts and warn as code

  @test:scripts/tests/state-visualizer.test.ts::the_renderer_is_chosen_by_the_projection's_`$schema`,_not_by_the_graph's_id::both_third_states_are_printed_even_at_zero
  Scenario: Both third states are printed
    Then the qa page says "could not determine" and "<n> would not parse"

  @test:scripts/tests/state-visualizer.test.ts::the_bucket_counts_are_a_KPI_row,_not_nested_panels::each_count_is_a_stat_tile_with_a_value_and_a_label
  Scenario: Each count is a stat tile
    Then the qa page has an sv-counts list of sv-count tiles, each a number and a label

  @test:scripts/tests/state-visualizer.test.ts::the_bucket_counts_are_a_KPI_row,_not_nested_panels::a_count_is_never_a_`.sv-item`,_which_is_the_registry's_card
  Scenario: A count is not a registry card
    Then the qa page's panels above the registry carry sv-count but no sv-item

  @test:scripts/tests/state-visualizer.test.ts::the_bucket_counts_are_a_KPI_row,_not_nested_panels::no_bucket_carries_a_status_colour
  Scenario: No count carries a status colour
    Then no count in the qa panels has a status class or an inline style

  @test:scripts/tests/state-visualizer.test.ts::the_e2e_spec's_copy_of_the_marker_agrees_with_the_generator's_—_bean_`5wrg`::the_spec_carries_the_exact_marker_the_generator_writes
  Scenario: The e2e spec's marker matches the generator's
    Then state-dashboards.e2e.ts declares MARKER as the generator's marker string

  @test:scripts/tests/state-visualizer.test.ts::the_e2e_spec's_copy_of_the_marker_agrees_with_the_generator's_—_bean_`5wrg`::and_the_marker_is_really_in_the_pages,_so_neither_copy_is_hypothetical
  Scenario: The marker is in the built pages
    Then the qa page contains the generator's marker

  @test:scripts/tests/state-visualizer.test.ts::per-instance_QA_pages_(bean_folio-assistant-1nu0)::one_subject_per_instance_holding_the_kind,_named_by_its_member,_sorted
  Scenario: One QA subject per instance, named by member, sorted
    Given qa directories of who-iris, of cat-harness-tools declared by cat-harness, of cat-harness, and a beans directory
    Then the qa subjects are cat-harness, cat-harness-tools and who-iris

  @test:scripts/tests/state-visualizer.test.ts::per-instance_QA_pages_(bean_folio-assistant-1nu0)::the_instance_root_is_recovered_from_the_declared_path,_not_composed
  Scenario: The instance root is recovered from the declared path
    Then who-iris's qa subject at /x/who-iris/test/results has instance root /x/who-iris

  @test:scripts/tests/state-visualizer.test.ts::per-instance_QA_pages_(bean_folio-assistant-1nu0)::a_declared_directory_that_is_not_on_disk_still_gets_a_subject,_so_its_tile_has_a_page
  Scenario: An absent declared directory still gets a subject
    Then a qa directory that does not exist still gives the subject smart-base

  @test:scripts/tests/state-visualizer.test.ts::per-instance_QA_pages_(bean_folio-assistant-1nu0)::an_instance_page_with_no_corpus_says_UNKNOWN,_links_back_and_to_its_siblings
  Scenario: A QA page with no corpus says unknown
    When instance a's QA page is drawn from an unknown corpus
    Then it says "unknown, not zero"
    And it links back to the hub and to b, not to itself, and carries the marker

  @test:scripts/tests/state-visualizer.test.ts::per-instance_QA_pages_(bean_folio-assistant-1nu0)::an_instance_page_with_a_corpus_renders_its_families
  Scenario: A QA page with a corpus renders its families
    When a QA page is drawn from a corpus of two kg-qa/v1 documents
    Then it names kg-qa/v1 and says "over 2 document(s)"

  @test:scripts/tests/state-visualizer.test.ts::per-instance_beans_pages_(bean_folio-assistant-1nu0)::lists_the_store's_OPEN_beans,_by_priority,_and_counts_the_rest
  Scenario: A beans page lists open items by priority
    Given store a with a todo, a completed and a high-priority in-progress item
    When its beans page is drawn
    Then it says 2 of 3 are open and explains the navbar badge
    And the high-priority item comes first and the completed one is not listed
    And it links sibling b and carries the marker

  @test:scripts/tests/state-visualizer.test.ts::per-instance_beans_pages_(bean_folio-assistant-1nu0)::an_unreachable_store_is_UNKNOWN,_and_no_store_is_not_an_empty_one
  Scenario: An unreachable store is unknown and no store is not empty
    Then an unreachable store's page says "unknown, not zero"
    And a page with no store says "no store, not an empty one"

  @test:scripts/tests/state-visualizer.test.ts::a_bean_store's_notes_and_workflow_instances_(bean_folio-assistant-750a)::the_store's_parts_are_the_kinds_its_page_draws
  Scenario: The store's parts are its drawn kinds
    Then the bean store kinds are bean-defs, bean-notes, beans, merge-queue, session-survey, sweep-marks and workflow-state

  @test:scripts/tests/state-visualizer.test.ts::a_bean_store's_notes_and_workflow_instances_(bean_folio-assistant-750a)::lists_the_merge_steward's_decisions,_links_each_PR,_and_keeps_a_bad_entry_visible_(bean_folio-assistant-30jr)
  Scenario: The store section lists merge-queue decisions and keeps a bad entry
    Given a store declaring a merge queue with a README, one valid blocked override entry and one carrying headSha
    When the store parts section is drawn
    Then it says "Merge queue — 1 decision(s), 1 unreadable" and links o/r#7 to its pull request
    And the row shows blocked, override at position 1, and the hold on o/r#6 until its expiry
    And the reason is escaped
    And the headSha entry is listed by file name saying headSha is a fact GitHub owns
    And the README is not listed

  @test:scripts/tests/state-visualizer.test.ts::a_bean_store's_notes_and_workflow_instances_(bean_folio-assistant-750a)::lists_the_notes_and_the_instances_its_beans.json_declares,_read_from_disk
  Scenario: The store section lists declared notes and workflow instances
    Given a store declaring notes and workflows, with one note, a README and one workflow instance
    When the store parts section is drawn
    Then it says "Bean notes — 1" with the note's branch, and no README
    And it says "Workflow instances — 1" with Process_CRDM, running, A_Step
    And it starts inside a Liquid raw block

  @test:scripts/tests/state-visualizer.test.ts::a_bean_store's_notes_and_workflow_instances_(bean_folio-assistant-750a)::a_store_declaring_no_parts_lists_none,_rather_than_guessing_paths
  Scenario: A store declaring no parts lists none
    Given a store with a notes directory but no beans.json
    When the store parts section is drawn
    Then it says "Bean notes — 0" and "Workflow instances — 0"
    And it says no merge-queue decision, session survey or sweep mark is recorded

  @test:scripts/tests/state-visualizer.test.ts::a_bean_store's_notes_and_workflow_instances_(bean_folio-assistant-750a)::lists_session_surveys_and_sweep_marks,_and_keeps_a_bad_entry_visible_(bean_folio-assistant-750a)
  Scenario: The store section lists surveys and sweep marks and keeps bad entries
    Given a store declaring surveys and marks, with a valid and an invalid survey, a valid mark and an unparseable one
    When the store parts section is drawn
    Then it says "Session surveys — 1 survey(s), 1 unreadable" with the abbreviated range, branch, 12 commits and "1 of 2" axes covered
    And the surveyor is escaped and the invalid survey is listed as "not a valid entry — from:"
    And it says "Sweep marks — 1 mark(s), 1 unreadable" with session-staleness's row, and broken.json as "not readable JSON"
    And the README is not listed

  @test:scripts/tests/state-visualizer.test.ts::the_todo_graph's_feedback_and_boards_(bean_folio-assistant-750a)::lists_each_feedback_todo's_block,_submitter_and_status,_and_each_board's_filter_and_placed_notes
  Scenario: The todo graph section lists feedback and boards
    Given a todo graph with a feedback todo, a stray file with no todo tag, two boards, a board with an empty filter and board positions
    When the todo parts section is drawn
    Then it says "Feedback — 1 todo(s), 1 unreadable" with the todo's escaped summary, target, submitter and status
    And the stray file is listed as carrying no tag
    And it says "Boards — 2 board(s), 1 unreadable" with ch1's filter and 2 placed notes, and whole as the whole folio with 0
    And bad.json is listed, the positions file is not a board, and the README is not listed
    And it starts inside a Liquid raw block
    And the todos page includes the open landing panel and the todo-feedback section

  @test:scripts/tests/state-visualizer.test.ts::the_todo_graph's_feedback_and_boards_(bean_folio-assistant-750a)::an_empty_graph_says_so,_part_by_part
  Scenario: An empty todo graph says so part by part
    Given a todo graph with empty feedback and boards directories
    When the todo parts section is drawn
    Then it says no feedback todo, no board, and that no note has been placed

  @test:scripts/tests/state-visualizer.test.ts::per-instance_health_and_attestations_pages_(bean_folio-assistant-1nu0)::health_and_attestations_have_a_per-instance_renderer;_a_kind_without_one_does_not
  Scenario: Health and attestations draw per instance
    Then health and attestations are per-instance kinds and beans is not

  @test:scripts/tests/state-visualizer.test.ts::per-instance_health_and_attestations_pages_(bean_folio-assistant-1nu0)::subjects_of_`health`_are_every_instance_declaring_it,_whatever_its_path
  Scenario: Every instance declaring health is a subject
    Given health declared by cat-harness and cat-harness-tools at different paths, and a qa directory
    Then the health subjects are cat-harness and cat-harness-tools, the latter rooted at /x/cat-harness-tools

  @test:scripts/tests/state-visualizer.test.ts::per-instance_health_and_attestations_pages_(bean_folio-assistant-1nu0)::an_absent_health_directory_is_UNKNOWN,_not_zero,_and_the_page_says_no_QA_no-total_claim
  Scenario: An absent health directory is unknown
    Given a health directory that does not exist
    Then its projection's availability is "unknown"
    And its page says "unknown, not zero", names test/health/results/ and carries the marker

  @test:scripts/tests/state-visualizer.test.ts::per-instance_health_and_attestations_pages_(bean_folio-assistant-1nu0)::a_present_attestations_directory_is_counted_by_its_documents'_$schema
  Scenario: An attestations directory is counted by $schema
    Given an attestations directory with two qa-attestations/v1 documents
    Then its subject is rooted at the instance
    And its page names qa-attestations/v1 "over 2 document(s)" without the QA no-total text

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::every_registry_kind_draws_per_instance
  Scenario: Every registry kind draws per instance
    Then typologies, validators, qa-checkers, block-kinds, content-adapters, code-list, pipeline-plugins and editor-checkers are registry kinds and per-instance kinds

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::a_registry_page_lists_each_node,_by_id_and_title,_and_is_not_run_through_Liquid
  Scenario: A registry page lists each node and turns Liquid off
    Given a validators directory with a node with id and title, one with only a summary, and an unparseable file
    Then the rows are a, b-check and bad, with a's summary as text and bad noted as not parsing
    And the page turns Liquid off, says "Nodes — 3", lists b-check and keeps its title's braces literally

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::the_listed_kinds_draw_per_instance_as_registries_do,_JSON-LD_included_(bean_folio-assistant-6gme)
  Scenario: Listed kinds draw as registries, JSON-LD included
    Then scenarios, policies, test-plan, tool-release, vocab-mapping and substrate-snapshot are listed, registry and per-instance kinds
    And a policies directory with one JSON-LD file gives the row defaults, "the floor"
    And its page says "over 1 document(s)" and "Nodes — 1"

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::a_QA_page_carries_no_node_table_and_keeps_Liquid_as_it_was
  Scenario: A QA page has no node table and keeps Liquid
    Then a QA page does not turn Liquid off and has no node table

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::a_QA_page_whose_layer_keeps_its_results_on_a_branch_loads_them_in_the_browser
  Scenario: A QA page for branch-kept results loads them live
    Given a qa directory stored on cat/cat-harness/qa-reports
    Then its subject records that branch
    And its page with a live source has the sv-qa-live element, turns Liquid off and does not say it is not available

  @test:scripts/tests/state-visualizer.test.ts::per-instance_registry_pages_(bean_folio-assistant-k7ro)::the_hub_lists_every_instance_page
  Scenario: The hub lists every instance page
    Then the validators hub links a/ and b/ and carries the marker

  @test:scripts/tests/state-visualizer.test.ts::per-instance_code_pages_(bean_folio-assistant-svgx)::an_instance's_code_page_lists_EVERY_code_directory_it_declares,_not_just_the_first
  Scenario: A code page lists every code directory
    Given core declaring scripts and pipeline as code and docs as docs, and other declaring scripts
    Then core's code directories are scripts and pipeline, with pipeline's description
    And the code subjects are core and other

  @test:scripts/tests/state-visualizer.test.ts::per-instance_code_pages_(bean_folio-assistant-svgx)::files_are_listed_relative_to_the_directory,_sorted,_skipping_node_modules_and_dot_directories;_absent_is_null
  Scenario: Code files are listed relative and sorted
    Given a directory with b.ts, a/x.ts, a node_modules file and a .git file
    Then the files are a/x.ts and b.ts, total 2
    And with a limit of 1 only a/x.ts is listed, total 2
    And an absent directory gives null

  @test:scripts/tests/state-visualizer.test.ts::per-instance_code_pages_(bean_folio-assistant-svgx)::links_go_to_GitHub_at_the_pinned_commit_from_index.lock.json,_and_nowhere_when_not_locked
  Scenario: Code links go to the pinned commit
    Given a lock pinning core to o/core at a commit
    Then core's blob base is that GitHub commit URL
    And another instance, or a missing lock, has none

  @test:scripts/tests/state-visualizer.test.ts::per-instance_code_pages_(bean_folio-assistant-svgx)::the_page_links_each_file,_says_unknown_for_an_absent_directory,_and_turns_Liquid_off
  Scenario: A code page links files, says unknown for absent, and turns Liquid off
    When core's code page is drawn with a file named with Liquid braces and an absent pipeline directory
    Then it turns Liquid off and links the file at the pinned base, URL-encoded
    And it says "unknown, not none" and links sibling other

  @test:scripts/tests/state-visualizer.test.ts::drawsInstanceHub:_a_per-instance_visualiser_no_dashboard_draws_gets_its_own_route::`code`_gets_a_hub_(en/cat-harness/code/,_2026-10-15)
  Scenario: code gets a hub
    Then code with no dashboard and 3 instance pages draws a hub

  @test:scripts/tests/state-visualizer.test.ts::drawsInstanceHub:_a_per-instance_visualiser_no_dashboard_draws_gets_its_own_route::a_registry_kind_gets_a_hub
  Scenario: A registry kind gets a hub
    Then a registry kind with no dashboard and one instance page draws a hub

  @test:scripts/tests/state-visualizer.test.ts::drawsInstanceHub:_a_per-instance_visualiser_no_dashboard_draws_gets_its_own_route::not_when_a_dashboard_already_draws_the_route,_nor_with_no_instance_pages,_nor_for_a_state_kind
  Scenario: No hub where a dashboard draws, with no pages, or for a state kind
    Then code with a dashboard, code with no instance pages, and beans each draw no hub

  @test:scripts/tests/state-visualizer.test.ts::per-instance_memory_pages_(the_library_page's_last_"no_viewer_yet"_row)::a_memory_directory's_lessons,_interaction_node_and_waivers_are_all_listed;_absent_is_null
  Scenario: A memory directory's files are all listed, and an absent directory is null
    # Gap: no waiver file is in the fixture; only lessons, an interaction node and an unparseable JSON file are listed
    Given a memory directory holding a README, a lesson, an archived lesson, an interaction node and a file that does not parse as JSON
    When its rows are read
    Then the four non-README files are listed sorted, the archived lesson marked archived, the lesson's label and summary kept, and the bad file noted "does not parse as JSON"
    And an absent directory reads as null
    When the instance's memory page is rendered
    Then it turns Liquid off, says "2 lessons (1 archived), 2 other nodes", links the lesson at the pinned blob URL, keeps the summary's braces, and carries the generated-by mark

  @test:scripts/tests/state-visualizer.test.ts::per-instance_memory_pages_(the_library_page's_last_"no_viewer_yet"_row)::an_instance_whose_memory_is_not_in_the_build_says_unknown,_not_empty
  Scenario: An instance whose memory is not in the build says unknown, not empty
    Given an instance whose memory rows are null
    When its memory page is rendered
    Then it says "unknown", not empty

  @test:scripts/tests/state-visualizer.test.ts::per-instance_memory_pages_(the_library_page's_last_"no_viewer_yet"_row)::memory_is_drawn_per_instance,_with_a_hub,_and_is_not_refused_as_unread
  Scenario: Memory is drawn per instance, with a hub, and is not refused as unread
    Then memory is a memory kind and draws an instance hub
    And this repository's per-instance subjects for memory are drawn with nothing unread

  @test:scripts/tests/state-visualizer.test.ts::pipeline_plugins_and_editor_checkers_are_registries_(cat-harness-tools#386)::a_plugin_is_listed_by_its_slot_and_rationale
  Scenario: A pipeline plugin is listed by slot and rationale
    Given a pipeline-plugins directory with one plugin
    Then its row's id is its slot and its text its rationale
    And pipeline-plugins and editor-checkers each draw a hub

  @test:scripts/tests/state-visualizer.test.ts::merge_reviews_(bean_w8jq)::one_row_per_verdict,_newest_review_first,_the_pull_request_linked_when_the_repository_is_named
  Scenario: Merge reviews list one row per verdict, newest first
    Given a verdict for o/r#7 with two failing reviews and a verdict for #9 with no repository and one passing review
    When the merge reviews section is drawn
    Then it says "Verdicts — 2 verdict(s)" and links o/r#7 but not #9
    And it shows the abbreviated head, "fail (+1 earlier)" and the reviewer's session and model
    And the latest review's open blocking flags count 1
    And #9's newer review is listed before o/r#7

  @test:scripts/tests/state-visualizer.test.ts::merge_reviews_(bean_w8jq)::an_unreadable_or_invalid_file_is_listed_with_its_reason,_never_dropped;_a_misnamed_head_is_said
  Scenario: Unreadable or invalid merge reviews are listed with reasons
    Given an unparseable file, an invalid verdict and a verdict whose file name differs from its head
    When the merge reviews section is drawn
    Then it says "Verdicts — 1 verdict(s), 2 unreadable"
    And bad.json is not readable JSON and invalid.json is not a valid verdict naming base_sha
    And the misnamed file is said, with no review recorded
    And a repository that is not owner/repo is neither linked nor echoed

  @test:scripts/tests/state-visualizer.test.ts::merge_reviews_(bean_w8jq)::an_empty_store_says_none;_an_unmounted_one_says_unknown,_not_none
  Scenario: An empty review store says none and an unmounted one unknown
    Then a page over an empty store says no verdict is recorded, turns Liquid off and carries the marker
    And a page over no store says "unknown, not none" and not that no verdict is recorded

  @test:scripts/tests/state-visualizer.test.ts::the_workflow_view:_per-instance_pages_and_the_store's_stuck_column_(bean_folio-assistant-v49e)::with_a_view,_each_instance_links_its_page_and_carries_its_stuck_states;_the_third_state_is_stated
  Scenario: With a view, workflow instances link their pages and show stuck states
    Given a store with one stale running instance and two items, one with no instance
    When the store section is drawn with the items and a date
    Then the instance links workflows/crdm--x-ab12/ and a stuck column shows enabled-not-taken and refused-gate
    And it counts 2 items, 1 with no instance recorded, naming x-cd34 as a third state
    And without a view there is no stuck column and no instance link

  @test:scripts/tests/state-visualizer.test.ts::the_workflow_view:_per-instance_pages_and_the_store's_stuck_column_(bean_folio-assistant-v49e)::an_instance_page_reads_the_dynamic-state_document_when_given_one_(bean_6h47),_and_says_what_it_was_built_with
  Scenario: An instance page reads the dynamic state document when given one
    When an instance page is drawn with a state document
    Then it names the document and the instance's IRI, says "Latest exported state", and carries the built stuck kinds and the reader selector
    And drawn without one it names no state document

  @test:scripts/tests/state-visualizer.test.ts::the_workflow_view:_per-instance_pages_and_the_store's_stuck_column_(bean_folio-assistant-v49e)::an_instance_page_states_position,_stuck_states,_the_not-recorded_gate_and_a_missing_diagram_in_words
  Scenario: An instance page states its position and gaps in words
    Given a stale instance whose diagram is missing, an item blocked without expiry and a todo tagged with its process
    When its page is drawn
    Then it says where it is, lists 2 stuck states including enabled-not-taken and blocked-without-expiry
    And it says the diagram was not found, the position is in words only and the acting steps are unknown
    And it lists the 1 todo tagged with Process_CRDM
    And it says refused steps are not recorded and the working context is not computed
    And it says uncommitted state is not read, escapes the history note, turns Liquid off and carries the marker

  @test:scripts/tests/state-visualizer.test.ts::the_workflow_view:_per-instance_pages_and_the_store's_stuck_column_(bean_folio-assistant-v49e)::a_published_drawing_is_fetched_by_the_page_and_keyed_on_the_token's_BPMN_id
  Scenario: A published drawing is fetched and keyed on the token
    Then with no loaded model no diagram figure is drawn
    And with a model loaded from a moved source the page fetches the drawing, links the process page from header and caption, carries the tokens, and says it was drawn from crdm.bpmn

  @test:scripts/tests/state-visualizer.test.ts::the_workflow_view:_per-instance_pages_and_the_store's_stuck_column_(bean_folio-assistant-v49e)::the_hub_lists_every_instance,_an_unreadable_one_with_its_reason
  Scenario: The workflow hub lists every instance
    Given a store with one instance and an unparseable file
    When the workflow hub is drawn
    Then it links crdm--x-ab12/ and lists broken.json as not readable JSON

  @test:scripts/tests/state-visualizer.test.ts::hostedVisualisers:_another_layer's_state-viewer_page,_built_on_the_host_site::picks_only_another_layer's_builtOnHostSite,_per-instance,_state-viewer_visualisers
  Scenario: Only another layer's hosted per-instance state-viewer pages are hosted
    Given cat-harness and a layer "top" declaring a hosted per-instance editor-checkers page, an unhosted one, another Tool's and a hosted dashboard
    Then the visualisers hosted on cat-harness are top/editor-checkers only
    And none are hosted on top
