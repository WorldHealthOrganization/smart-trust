# The task panel on process pages (scripts/lib/task-panel.ts, scripts/gen-processes-viz.ts): markers on the
# drawn BPMN shapes open a lazily fetched object view of task, skills, methodologies and lane role,
# each a link where a page exists. Each Scenario names the test that executes it.
Feature: The task panel on process pages

  @test:scripts/tests/ui/task-panel.test.ts::marker_placement::the_viewBox_is_read_off_the_SVG_root
  Scenario: The viewBox is read off the SVG root
    Given an svg tag with viewBox "155 55 830 530"
    When its viewBox is read
    Then it is x 155, y 55, width 830, height 530
    And a bare svg tag has no viewBox

  @test:scripts/tests/ui/task-panel.test.ts::marker_placement::a_marker_sits_on_the_shape's_top-right_corner,_in_percent;_a_task_with_no_shape_gets_none
  Scenario: A marker sits on its shape's top-right corner in percent, and a task with no shape gets none
    Given a BPMN diagram where task T1 has a shape at 200,100 sized 100 by 80 and task T2 has none
    When its bounds are read and markers placed in a viewBox at 100,50 sized 400 by 200
    Then T1's bounds are read as drawn
    And only T1 gets a marker, at left 50% and top 25%
    And its click box is the expand marker's hit area, at left 34.38%, top 52.5%, 6% wide and 12% high

  @test:scripts/tests/ui/task-panel.test.ts::marker_placement::the_[+]_hit_area_is_centred_on_bpmn-js's_marker,_24_square
  Scenario: The expand hit area is a 24-square centred on bpmn-js's marker
    Given a shape at 0,0 sized 120 by 120
    When its expand marker box is computed
    Then it is at 47.5,95 sized 24 by 24

  @test:scripts/tests/ui/task-panel.test.ts::the_page_block::markers_and_an_empty_panel,_and_the_data_is_NOT_inlined
  Scenario: The page block carries markers and an empty panel, with the panel data fetched only on open
    Given a diagram block with one marker named "One <b>" and a panel sidecar "p.tasks.json"
    Then the block names the sidecar in data-panel and the task in data-task
    And the marker sits at left 50% and top 25%
    And the marker name is escaped
    And the panel is empty and hidden
    And the panel script fetches only inside its load function
    And the script has no Liquid double brace or tag
    And it never uses innerHTML

  @test:scripts/tests/ui/task-panel.test.ts::the_page_block::a_call_activity's_shape_links_to_the_called_process;_a_plain_task's_does_not
  Scenario: A call activity's shape links to the called process and a plain task's does not
    Given a diagram block with a call activity marker linking to "sub.html" and a plain task marker, both with a click box
    Then exactly one pt-go link is drawn, to "sub.html", at the click box's position and size
    And the links sit inside the pt-layer and the markers before the panel
    And both tasks still carry their data-task marker

  @test:scripts/tests/ui/task-panel.test.ts::the_page_block::no_markers_→_the_plain_image_it_always_was
  Scenario: A diagram with no markers is a plain image
    Given a diagram block with no markers
    Then it is a single img tag at full width

  @test:scripts/tests/ui/task-panel.test.ts::link_spellings::a_methodology_page_is_<instance>/<name>/,_as_#422_spells_it
  Scenario: A methodology page is spelled <instance>/<name>/
    When the page directory of methodology "raci" in "cat-harness" is spelled
    Then it is "cat-harness/raci/"

  @test:scripts/tests/ui/task-panel.test.ts::link_spellings::a_role_link_lands_on_gen-auto-docs'_row_id
  Scenario: A role link lands on gen-auto-docs' row id
    When the row id for "cat-harness/scenarios/roles.json#reviewer" is spelled
    Then it is "a-cat-harness-scenarios-roles-json-reviewer"

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::the_step,_its_lane_and_its_process_link_to_their_own_pages_—_subject_IRIs,_not_fragments_(#603)
  Scenario: The step, its lane and its process link to their subject pages, not fragments
    Given a process P under procs/ whose subject pages are published, with task T1 in lane L1
    When its panel data is built
    Then the process links to its process subject IRI
    And T1 links to the process's node/T1 IRI and its lane to lane/L1
    And none of the three links has a fragment

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::a_call_goes_to_the_called_process's_page,_keeping_its_diagram_one_step_away
  Scenario: A call goes to the called process's page, with its diagram one step away
    Given call activity C1 calling process Q under procs/ and C2 calling process R under boot/
    When the panel data is built
    Then C1 calls Q at its subject IRI with diagram "q.html"
    And C2, with no published page, calls R at its diagram "r.html"

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::task_→_skills_→_methodologies,_each_a_link_where_a_page_exists
  Scenario: A task's skills and their methodologies are links where a page exists
    Given task T1 naming skills "review" and "unpaged", where review uses methodologies "raci" and "unknown-method"
    When the panel data is built
    Then review links to its instruction page, with raci linked and unknown-method as plain text
    And unpaged has no link and no methodologies

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::lane_Role_→_its_skills,_inherited_ones_naming_where_they_came_from
  Scenario: A lane's role lists its skills, inherited ones naming where they came from
    Given lane Reviewers bound to role "lead", titled "Lead reviewer", with skill review via reviewer and its own skill sign-off
    When T1's panel data is built
    Then its role is "lead", linked to the #a-lead row, titled "Lead reviewer"
    And its skills are review via reviewer and sign-off, each linked to its instruction page

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::a_lane_naming_no_role_says_why,_rather_than_showing_nothing
  Scenario: A lane naming no role shows its binding instead
    Given task T2 in a lane with a variable binding and no role
    When the panel data is built
    Then T2 has no role
    And its binding is "variable"

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::skills_are_shown_unless_the_site_switches_them_off,_and_the_data_says_which
  Scenario: Skills are shown unless the site switches them off, and the data says which
    Given the panel data built with no option
    Then it has no skills flag
    When it is built with skills off
    Then its skills flag is false
    And T1 lists no skills and its role lists no skills
    And T1's link, its role name and C1's call are unchanged

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::the_title_opens_the_step's_description_on_its_process_page;_the_subject_page_stays_on_the_id
  Scenario: A task's title opens its description on the process page while its subject link stays on the id
    Given the panel data for process P
    Then T1's step link is "p.html#step-T1"
    And its subject link is the node/T1 IRI
    And the process page carries a step-T1 anchor

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::with_no_subject_pages,_the_lane_lands_on_its_row_and_the_process_on_its_page
  Scenario: With no subject pages the lane lands on its row and the process on its page
    Given process P under boot/, where no subject pages are published
    When its panel data is built
    Then the process links to "p.html"
    And T1 has no subject link
    And its lane links to "p.html#lane-L1"
    And the process page carries a lane-L1 anchor

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::the_QA_report_names_every_panel_name_that_links_nowhere,_once_per_kind
  Scenario: The QA report names every panel name that links nowhere
    # Gap: "once per kind" de-duplication is not checked
    Given the panel data for process P
    When its unlinked references are listed
    Then skill "unpaged" and methodology "unknown-method" at T1 are among them
    And neither "review" nor "lead" is
    And the report has a "## skill" section linking P's step T1
    And a report with no unlinked references says every name in every panel links
    And with skills switched off no skill is reported

  @test:scripts/tests/ui/task-panel.test.ts::the_object_view::the_markers_travel_with_the_data,_so_another_page_can_draw_them
  Scenario: The markers travel with the panel data
    Given a process row carrying a marker for T1
    When its panel data is built
    Then the data carries the same markers
    And a row without markers gives data without markers

  @test:scripts/tests/ui/task-panel.test.ts::the_site's_switch_(index.config.json_site.taskSkills)::absent_→_on,_as_every_knowledge-graph_site_has_it
  Scenario: With no site taskSkills declared, task skills are on
    Given an index.config.json with no site block
    Then task skills are declared on
    And a directory with no index.config.json also has them on

  @test:scripts/tests/ui/task-panel.test.ts::the_site's_switch_(index.config.json_site.taskSkills)::declared_→_as_declared
  Scenario: A declared site taskSkills is taken as declared
    Given an index.config.json with site taskSkills false
    Then task skills are off
    And with site taskSkills true they are on

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::hrefs_resolve_against_the_sidecar,_not_the_page_that_loads_it
  Scenario: The client resolves panel links against the sidecar, not the loading page
    # Gap: only the client script's source text is checked; it is not run
    Given the panel client script
    Then it reads the sidecar from data-panel
    And it builds a URL from the sidecar against the page location
    And it sets each link's href through abs()

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::with_no_server-drawn_layer,_the_markers_come_from_the_data
  Scenario: With no server-drawn layer, the client takes the markers from the data
    # Gap: only the client script's source text is checked; it is not run
    Given the panel client script
    Then it reads "j.markers || []"

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::skills_switched_off:_no_skill_box,_no_role_skill_list,_no_'names_no_skill'
  Scenario: With skills switched off the client shows no skill box, role skill list or 'names no skill'
    # Gap: only the client script's source text is checked; it is not run
    Given the panel client script
    Then it tests "data.skills === false"
    And it shows the empty-skills note only when skills are on

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::it_parses,_and_a_page_can_pick_out_steps_(data-pt-highlight),_as_a_journey's_step_does
  Scenario: The client parses, and a page can pick out steps with data-pt-highlight
    # Gap: highlighting is checked only as source text; the script is parsed, not run
    Given the panel client script
    Then it compiles as a function without error
    And it reads the data-pt-highlight attribute and splits it on whitespace

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::the_client_and_styles_are_published_as_files_under_fixed_names
  Scenario: The client and styles are published under fixed names
    Then the panel client is "task-panel.js" with style "task-panel.css"
    And the panel sidecar for "care" is "care.tasks.json"

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::an_inline_drawing's_viewBox_is_split_on_its_spaces,_so_the_markers_keep_its_aspect
  Scenario: An inline drawing's viewBox is split on spaces or commas
    # Gap: only the client script's source text is checked; it is not run
    Given the panel client script
    Then it splits the viewBox on whitespace or commas and maps it to numbers

  @test:scripts/tests/ui/task-panel.test.ts::the_client,_for_a_page_other_than_the_process_page::a_drawing_with_no_sidecar_is_highlighted_and_fetches_nothing
  Scenario: A drawing with no sidecar fetches nothing
    # Gap: only the client script's source text is checked; it is not run
    Given the panel client script
    Then it reads the sidecar from data-panel
    And it loads only when nothing is drawn and a sidecar is named

  @test:scripts/tests/ui/task-panel.test.ts::a_skill's_link::its_instruction_page,_else_its_source_file,_else_nothing
  Scenario: A skill links to its instruction page, else its source file, else nowhere
    Given an instruction page for "paged" and a source file for "sourced"
    Then "paged" links to its reference/skill-instructions page
    And "sourced" links to its source file on GitHub
    And "nowhere" has no link
    And with no pages or sources "sourced" has no link

  @test:scripts/tests/ui/task-panel.test.ts::a_skill's_link::a_page_rendered_on_this_site_wins_over_the_source_link
  Scenario: A skill page rendered on this site wins over the source link
    Given skill "s" with both a source file and a locally rendered page
    When its link target is resolved
    Then it is the local page "../../en/h/processes/skills/s.html"

  @test:scripts/tests/ui/task-panel.test.ts::a_skill's_link::a_skill_rendered_from_its_source_keeps_its_body,_and_its_relative_links_resolve
  Scenario: A skill rendered from its source keeps its body with its relative links resolved
    Given a skill source with a folded description and links to a paged skill, an unpaged .md, a schema, the web and a fragment
    When its page is rendered with "t" paged
    Then its description is "Does a thing."
    And the body carries no front matter
    And the paged skill link goes to "t.html#x"
    And the unpaged .md and the schema link to their files on GitHub
    And the web link and the fragment link are unchanged

  @test:scripts/tests/ui/task-panel.test.ts::the_real_corpus::a_rendered_diagram_gets_markers,_and_its_page_carries_the_panel
  Scenario: A rendered diagram in the real corpus gets markers and its page carries the panel
    # Skipped: when the checkout has no rendered process art (reported as skipped, not passed)
    Given the real corpus's process rows with rendered diagrams
    Then at least one row has markers
    And each of its markers lies within 0 to 100% left and top
    And its process page names its "<stem>.tasks.json" sidecar

  @test:scripts/tests/ui/task-panel.test.ts::the_real_corpus::the_host's_process,_step_and_lane_link_to_their_subject_IRIs_(#603)
  Scenario: The host's process, step and lane link to their subject IRIs in the real corpus
    # Gap: the lane's link is not checked
    Given the real corpus's first cat-harness process with steps and lanes
    When its panel data is built
    Then the process links to an http IRI ending in process/<id>, with no fragment
    And its first step links to the process IRI's node/<step id>

  @test:scripts/tests/ui/task-panel.test.ts::the_real_corpus::every_skill_a_panel_names_links_somewhere_—_bootstrap's_confirm-harness_to_its_source_(owner,_2026-11-08)
  Scenario: Bootstrap's confirm-harness links to its source, and every linkable skill a real-corpus panel names has a link
    # Skipped: when Process_Discussion is absent or confirm-harness is not linkable from this checkout (reported as skipped, not passed)
    Given the real corpus's process rows and the skills this checkout can link
    And Process_Discussion is present and confirm-harness is linkable
    Then its A_ListHarnesses task links confirm-harness to an .html or .md file
    And no panel names a linkable skill or role skill without a link

  @test:scripts/tests/ui/task-panel.test.ts::the_real_corpus::every_linkable_skill_a_panel_names_has_a_link,_whichever_layers_this_checkout_holds
  Scenario: Every linkable skill a real-corpus panel names has a link, whatever layers are present
    Given the real corpus's process rows and the skills this checkout can link
    When every panel's data is built
    Then no panel names a linkable skill or role skill without a link
