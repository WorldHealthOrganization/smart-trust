# scripts/gen-uploads-viz.ts renders the themed uploads queue viewer, a view of what waits to be ingested
# that reads the library projection rather than publishing its own. Each Scenario names the test that executes it.
Feature: Uploads queue viewer

  @test:scripts/tests/gen-uploads-viz.test.ts::ONE_dataset_—_this_harness_publishes_no_projection_of_its_own::the_generator_source_emits_no_assets/uploads_projection
  Scenario: The generator emits no uploads projection of its own
    Given the source text of scripts/gen-uploads-viz.ts
    Then it has no call emitting a file joined under the data directory

  @test:scripts/tests/gen-uploads-viz.test.ts::ONE_dataset_—_this_harness_publishes_no_projection_of_its_own::the_viewer_is_pointed_at_the_LIBRARY_projection
  Scenario: The viewer is pointed at the library projection
    # Gap: the resolved href is not checked; only the call's source text
    Given the source text of scripts/gen-uploads-viz.ts
    Then it contains the call placing the viewer with the "library" segment

  @test:scripts/tests/gen-uploads-viz.test.ts::state_is_read_from_the_corpus_link,_not_guessed::a_unit_no_library_slug_names_is_waiting
  Scenario: A unit no library slug names is waiting
    Given an upload item with no ingestedBy slug
    When its state is read
    Then it is "waiting"

  @test:scripts/tests/gen-uploads-viz.test.ts::state_is_read_from_the_corpus_link,_not_guessed::a_unit_a_slug_names_is_ingested
  Scenario: A unit a slug names is ingested
    Given an upload item ingested by "some-slug"
    When its state is read
    Then it is "ingested"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_a_queue_view::the_headline_is_what_is_WAITING,_not_a_total
  Scenario: The headline is what is waiting, ahead of the total
    Given the viewer rendered for a projection href
    Then it contains "waiting to be ingested" and "queued units"
    And "waiting to be ingested" comes first

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_a_queue_view::it_says_why_the_queue_matters,_in_the_page_rather_than_in_a_comment
  Scenario: The page says why the queue matters
    Given the rendered viewer
    Then it mentions "library/"
    And it says queued files are not reachable by the corpus checklist

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_a_queue_view::an_empty_queue_and_an_unreadable_projection_are_DIFFERENT
  Scenario: An empty queue and an unreadable projection are worded differently
    Given the rendered viewer
    Then it contains "Nothing in the queue"
    And it contains "This is not the same as an empty queue"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_a_queue_view::the_projection_is_fetched_by_the_RELATIVE_href_it_was_given
  Scenario: The projection is fetched by the relative href it was given
    Given the viewer rendered for "../../assets/uploads/index.json"
    Then it contains that href as a JSON string
    And it has no fetch of a site-root absolute path

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_a_queue_view::a_subject_scope_narrows_the_view_without_a_second_page_template
  Scenario: A subject scope narrows the view without a second page template
    # Gap: that the scope narrows the rows shown is not checked; only that the scope string is embedded
    Given the viewer rendered with scope "folio-assistant"
    Then it contains "folio-assistant" as a JSON string
    And the page is not only that scope's name

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::it_is_on_the_default_layout,_not_a_standalone_document
  Scenario: The themed viewer is on the default layout, not a standalone document
    Given the viewer rendered for scope who-iris among cat-harness and who-iris
    Then it starts with front matter naming "layout: default"
    And it has no doctype, html, head or body element
    And it contains the heading with id "up-title"
    And it has the line declaring SCOPE as "who-iris"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::it_styles_nothing_outside_its_own_wrapper
  Scenario: The themed viewer styles nothing outside its own wrapper
    Given the themed viewer for who-iris
    Then it has no CSS selector outside ".up-page"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_viewer_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::the_subject_pages_are_listed_in_the_page,_relative_to_it
  Scenario: The subject pages are listed in the page relative to it
    Given the themed viewer for who-iris among cat-harness and who-iris
    Then it links "All instances" to "../"
    And it links "cat-harness" to "../cat-harness/"
    And who-iris is marked as the current page

  @test:scripts/tests/gen-uploads-viz.test.ts::a_sidecar_is_not_a_queued_document::the_corpus_is_readable,_so_the_assertions_below_are_not_vacuous
  Scenario: The real upload corpus is readable
    Given the library graph read from the checkout
    Then it is not null
    And it has at least one upload

  @test:scripts/tests/gen-uploads-viz.test.ts::a_sidecar_is_not_a_queued_document::no_extraction_sidecar_whose_SOURCE_is_queued_is_itself_a_unit
  Scenario: No extraction sidecar whose source is queued is itself a unit
    Given the uploads of the real library graph
    Then no upload ending ".extraction.json" has its source file also in the queue

  @test:scripts/tests/gen-uploads-viz.test.ts::a_sidecar_is_not_a_queued_document::an_ORPHAN_sidecar_would_still_be_a_unit_—_the_rule_is_keyed_on_the_source
  Scenario: An orphan sidecar would still be a unit
    # Gap: no orphan sidecar is run through the rule; only the source text is checked
    Given the source text of scripts/library-graph.ts
    Then it contains the check "!present.has(source)"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_upload_affordance_—_`v1hw`::it_says_the_mechanism,_in_the_owner's_terms
  Scenario: The upload affordance says the mechanism in the owner's terms
    Given the source text of scripts/gen-uploads-viz.ts
    Then it contains "committing them from a checkout"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_upload_affordance_—_`v1hw`::the_command_is_built_PER_QUEUE,_from_the_queue's_own_dir
  Scenario: The upload command is built per queue from the queue's own dir
    # Gap: no command is rendered; only the source text is checked
    Given the source text of scripts/gen-uploads-viz.ts
    Then it maps over the queues and uses each queue's dir
    And it has no hardcoded copy into "uploads/"

  @test:scripts/tests/gen-uploads-viz.test.ts::the_upload_affordance_—_`v1hw`::NO_`--library`_value_is_printed_—_a_queue_does_not_determine_one
  Scenario: No --library value is printed
    # Gap: no command is rendered; only the source text is checked
    Given the source text of scripts/gen-uploads-viz.ts
    Then it contains "chosen, never derived" and the placeholder "--library &lt;destination&gt;"
    And it names no concrete library directory after --library

  @test:scripts/tests/gen-uploads-viz.test.ts::the_upload_affordance_—_`v1hw`::no_BACKTICK_in_the_injected_client_comment_—_it_lives_in_a_template_literal
  Scenario: The injected client comment has no backtick
    Given the source text of scripts/gen-uploads-viz.ts
    When the client text from "ADDING TO THE QUEUE" up to the add panel's innerHTML is taken
    Then it contains no backtick

  @test:scripts/tests/gen-uploads-viz.test.ts::the_emitted_command_uses_an_ESCAPE_for_the_newline,_not_a_real_one
  Scenario: The emitted command uses an escape for the newline
    # Gap: the inline script is not parsed; only the source text is checked
    Given the source text of the add panel in scripts/gen-uploads-viz.ts
    Then it contains an escaped newline
    And no single-quoted string spans a real newline before a concatenation
