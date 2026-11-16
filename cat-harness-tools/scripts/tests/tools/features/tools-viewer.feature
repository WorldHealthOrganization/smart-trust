# scripts/gen-tools-viz.ts renders the Tools page: a markdown page of its own, separate from
# skills, joining every Tool to the skills it satisfies. Each Scenario names the test that executes it.
Feature: Tools viewer page

  @test:scripts/tests/tools/tools-viewer.test.ts::the_page_reports_the_join_in_both_directions::names_the_unresolved_ones_when_there_are_any
  Scenario: The page names a Tool whose satisfies names no skill
    Given the harness's Tool rows plus a planted Tool "planted" satisfying "no-such-skill"
    When the page is rendered against the known skills
    Then it contains "no-such-skill" and "`planted`"
    And it does not claim that all satisfies resolve

  @test:scripts/tests/tools/tools-viewer.test.ts::the_page_reports_the_join_in_both_directions::names_a_tool_that_satisfies_nothing,_as_a_separate_finding
  Scenario: The page names a Tool that satisfies nothing
    Given the Tool rows plus a planted Tool "orphan" with no satisfies
    When the page is rendered
    Then it contains "satisfy no skill at all" and "`orphan`"

  @test:scripts/tests/tools/tools-viewer.test.ts::the_rendered_page::keeps_the_direction_of_the_relation_explicit
  Scenario: The page states the relation runs from a tool to a skill
    When the page is rendered from the harness's Tools
    Then it contains "from a tool to a skill"

  @test:scripts/tests/tools/tools-viewer.test.ts::the_rendered_page::lists_every_tool
  Scenario: The page lists every Tool
    When the page is rendered
    Then every Tool id appears in it as code

  @test:scripts/tests/tools/tools-viewer.test.ts::the_rendered_page::carries_no_Liquid_syntax,_because_Jekyll_renders_it_as_a_page
  Scenario: The page body carries no Liquid syntax
    When the page is rendered and its front matter removed
    Then the body contains neither "{%" nor "{{"

  @test:scripts/tests/tools/tools-viewer.test.ts::the_rendered_page::is_markdown,_not_HTML_wearing_front_matter
  Scenario: The page is markdown
    When the page body is read without its front matter and style blocks
    Then it has a "## " heading line and a "|---" table separator line
    And it has no "<table" element and no "<h1" or "<h2" element

  @test:scripts/tests/tools/tools-viewer.test.ts::the_rendered_page::declares_no_theme_CSS_of_its_own
  Scenario: The page's own style block declares no theme CSS
    # Gap: only "body{" and "prefers-color-scheme" are checked for, not theme CSS in general.
    When the page's style block is read
    Then it does not contain "body{"
    And it does not contain "prefers-color-scheme"

  @test:scripts/tests/tools/tools-viewer.test.ts::the_generator_writes_where_the_declaration_says::resolves_its_page_path_from_the_declaration,_not_a_literal
  Scenario: The page path comes from the declaration under the page locale
    When pageRelPath is asked for the repository
    Then a path is returned
    And it starts with the page locale directory

  @test:scripts/tests/tools/tools-viewer.test.ts::the_generator_writes_where_the_declaration_says::and_the_page_is_at_that_path
  Scenario: The generated page exists at the declared path
    # Skipped: when neither the declared path nor its locale-less form exists in the docs layer and the site is not built.
    Given the declared page path and the same path without the locale
    Then one of them exists under the base docs directory

  @test:scripts/tests/tools/tools-viewer.test.ts::satisfies_links_what_resolves_(qgjh)::links_a_skill_whose_page_exists,_relative_to_the_page_it_sits_on
  Scenario: A satisfied skill with a published page is linked relatively
    Given a Tool row satisfying a skill whose instruction page exists
    When the page is rendered at the declared Tools page path
    Then that row's satisfies cell links the skill to "reference/skill-instructions/<skill>.html" with one "../" per directory of the page path

  @test:scripts/tests/tools/tools-viewer.test.ts::satisfies_links_what_resolves_(qgjh)::leaves_a_skill_with_no_page_as_code
  Scenario: A satisfied skill with no page stays code
    Given the same skill with no published page
    When the page is rendered
    Then the satisfies cell holds the skill as code
    And it is not a link

  @test:scripts/tests/tools/tools-viewer.test.ts::wireframe_fixes_(qbfm)::renders_stat_boxes_as_links_into_page_sections
  Scenario: Stat boxes link into page sections
    When the page is rendered
    Then it has "tg-stat" links to "#every-tool", "#does-every-satisfies-name-a-skill-that-exists" and "#how-they-are-invoked-and-installed"

  @test:scripts/tests/tools/tools-viewer.test.ts::wireframe_fixes_(qbfm)::renders_tool_ids_as_in-page_anchors_and_links
  Scenario: Tool ids are in-page anchors and links
    When the page is rendered
    Then every Tool id has an anchor with that id followed by a code link to "#<id>"

  @test:scripts/tests/tools/tools-viewer.test.ts::wireframe_fixes_(qbfm)::provides_mobile_scroll_cue_for_the_table_wrapper
  Scenario: The page styles a scroll cue for the table wrapper
    # Gap: only checks the page text contains the CSS terms, not how they render on mobile.
    When the page is rendered
    Then it contains ".table-wrapper", "mask-image" and "animation-timeline"

  @test:scripts/tests/tools/tools-viewer.test.ts::a_Tool's_page_links_its_QA_verdict_(tdir)::links_every_Tool_row_to_its_qa-reports_verdict,_never_blob/main
  Scenario: Every Tool row links its qa-reports verdict
    When the page is rendered
    Then the table header has a "qa" column
    And every row's qa link is under "/blob/cat/cat-harness/qa-reports/" and never "/blob/main/"
    And each row's qa cell links that address

  @test:scripts/tests/tools/tools-viewer.test.ts::a_Tool's_page_links_its_QA_verdict_(tdir)::addresses_each_Tool's_kg-qa_sidecar_under_the_qa-reports_entry_key_when_known
  Scenario: A known qa-reports key addresses each Tool's kg-qa sidecar
    Given a qa-reports entry key "main/0123…"
    When the Tool rows are built with that key
    Then each qa link sits under that key on qa-reports
    And ends with "/<tool id>.kg-qa.json"

  @test:scripts/tests/tools/tools-viewer.test.ts::a_Tool's_page_links_its_QA_verdict_(tdir)::renders_the_sidecar_verdict_as_the_link_label_when_present,_and_qa-reports_when_not_fetched_locally
  Scenario: The qa link label is the verdict when known, else "qa-reports"
    Given a Tool row with the verdict "pass"
    Then its qa cell is the link "pass" to its qa address
    And with no local verdict its qa cell is the link "qa-reports"
