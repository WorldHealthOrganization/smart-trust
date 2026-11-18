# Specifies declaredVisualisers and viewersOf (scripts/viewer-declarations.ts)
# and visualisationResolves over every instance's declared directories: a
# directory's viewer is read from the harness's visualisers, not declared by
# the directory.
Feature: Viewers are read from the harness declarations and resolve to their declared routes

  @test:test/coordinator/viewer-declarations-checkout.test.ts::the_corpus:_viewers_are_read_from_the_harness_declarations_(owner,_2026-10-09)::the_corpus_is_non-empty,_so_the_assertions_below_are_not_vacuous
  Scenario: There are directories and declared visualisers
    Given every directory every instance in the checkout declares
    When they and the declared visualisers are counted
    Then there is at least one of each

  @test:test/coordinator/viewer-declarations-checkout.test.ts::the_corpus:_viewers_are_read_from_the_harness_declarations_(owner,_2026-10-09)::no_directory_declares_its_own_viewer_—_the_harness_does
  Scenario: No directory declares its own viewer
    Given every declared directory
    When those with a coverage.visualiser are collected
    Then there are none

  @test:test/coordinator/viewer-declarations-checkout.test.ts::the_corpus:_viewers_are_read_from_the_harness_declarations_(owner,_2026-10-09)::beans_and_folio:_one_page_per_instance,_the_declarer's_by-id_directory_keeps_its_full_view_(bean_1nu0)
  Scenario: Beans and folio open one page per instance, and cat-harness's open the full views
    Given every declared directory
    When the viewer of each beans and folio directory is resolved
    Then cat-harness-tools's beans, where declared, opens "cat-harness/beans/cat-harness-tools/index.html"
    And who-iris's folio, where declared, opens "cat-harness/folio/who-iris/index.html"
    And cat-harness's beans and folio open "cat-harness/beans/index.html" and "cat-harness/folio/index.html"
    And each is under cat-harness/docs, with or without the page locale

  @test:test/coordinator/viewer-declarations-checkout.test.ts::the_corpus:_viewers_are_read_from_the_harness_declarations_(owner,_2026-10-09)::known_directories_resolve_to_their_declared_route
  Scenario: Known directories resolve to their declared routes
    Given every declared directory
    When the viewers of known directories are resolved
    Then cat-harness's and smart-base's tools open their own instance's tools page
    And cat-harness's processes opens "cat-harness/processes/cat-harness/index.md"
    And who-iris's library opens "cat-harness/library/who-iris/index.html"
    And cat-harness's skills opens "cat-harness/docs/cat-harness/auto-docs/index/skills/skills/index.html"
    And where the glossary visualiser nests by instance, who-iris's and cat-harness's glossary open their own glossary/instance page
    And cat-harness's beans opens "cat-harness/beans/index.html"
    And cat-harness's fsh-guts opens its page under the page locale

  @test:test/coordinator/viewer-declarations-checkout.test.ts::the_corpus:_viewers_are_read_from_the_harness_declarations_(owner,_2026-10-09)::every_resolved_page_exists,_or_is_built_at_publish_by_a_writer_that_exists
  Scenario: Every resolved viewer exists or is built at publish
    Given every declared directory
    When each of its viewers is checked
    Then each resolves, on disk or through a writer that exists
