# Which pages of cat-harness's docs site publish under the docs route (scripts/docs-route.ts), and that the
# permalink rules of scripts/lib/jekyll-permalink.ts agree with Jekyll, read off the real site tree (owner, issue #2188).
# Each Scenario names the test that executes it.
Feature: The docs route and its permalink rules

  @test:scripts/tests/docs-route.test.ts::the_route::is_the_docs_kind_and_the_built_instance's_declared_name
  Scenario: The docs route is the docs kind and the instance's declared name
    Then the built route for cat-harness is "docs/cat-harness"
    And the route for "who-iris" is "docs/who-iris"

  @test:scripts/tests/docs-route.test.ts::the_route::baseurl_is_the_SITE's_—_the_move_is_per_page,_not_per_tree
  Scenario: The site's baseurl is unchanged by the move
    Given the site's _config.yml
    Then its baseurl is "/folio-assistant"

  @test:scripts/tests/docs-route.test.ts::the_route::every_permalink_default_publishes_under_the_route
  Scenario: Every permalink default publishes under the route
    Given the permalink defaults of the site's _config.yml
    Then there is at least one
    And each permalink starts with "/docs/cat-harness/"

  @test:scripts/tests/docs-route.test.ts::the_scopes_mean_the_same_thing_to_Jekyll_3_and_4::no_permalink_scope_is_a_bare_string_prefix_of_a_different_top-level_entry
  Scenario: No permalink scope is a bare string prefix of another top-level entry
    Given the site's top-level entries and its non-glob permalink scopes
    Then no scope path is a string prefix of a different top-level entry

  @test:scripts/tests/docs-route.test.ts::what_moves_and_what_stays_—_read_off_the_real_tree::every_authored_chapter's_pages_move,_locale_copies_with_them
  Scenario: Every authored chapter's pages move under the route, locale copies with them
    Given the chapters start, concepts, guides, process, research-and-analysis and quality
    Then each of their markdown pages but the README publishes under the route at the same path as .html
    And "concepts/architecture.md", "concepts/fr/architecture.md" and "concepts/architecture/theming.md" publish under the route
    And "platform.md" publishes at "/docs/cat-harness/platform.html"

  @test:scripts/tests/docs-route.test.ts::what_moves_and_what_stays_—_read_off_the_real_tree::no_top-level_page_is_left_behind_but_the_landing_page
  Scenario: No top-level page is left behind but the landing page
    Given the site's top-level markdown pages with front matter, other than its README
    Then "index.md" publishes at "/"
    And every other one publishes under the route

  @test:scripts/tests/docs-route.test.ts::what_moves_and_what_stays_—_read_off_the_real_tree::the_landing_pages_stay_—_the_site's_and_each_locale's
  Scenario: The landing pages stay where they are
    Then "index.md" publishes at "/"
    And each locale's index page, for ar, es, fr, ru and zh, publishes at "/<locale>/index.html"

  @test:scripts/tests/docs-route.test.ts::what_moves_and_what_stays_—_read_off_the_real_tree::kind_directories_and_viewers_stay_where_they_are
  Scenario: Kind directories and viewers stay where they are
    # Skipped: when the site's built visualiser pages (processes, glossary, methodologies) are not present
    Given the built visualiser pages and the authored pages "proposals/index.md", "requirements/index.md" and "bootstrap/initialization.md"
    Then none of them publishes under the route

  @test:scripts/tests/docs-route.test.ts::the_permalink_rule::a_scope_with_no_permalink_is_not_a_permalink_rule
  Scenario: A default scope with no permalink is not a permalink rule
    Given five defaults, one of which sets only a layout
    When they are read as permalink defaults
    Then there are 4

  @test:scripts/tests/docs-route.test.ts::the_permalink_rule::the_page's_own_permalink_wins_over_every_default
  Scenario: A page's own permalink wins over every default
    Given "index.md" with its own permalink "/"
    Then its permalink is "/"

  @test:scripts/tests/docs-route.test.ts::the_permalink_rule::the_LONGER_scope_path_wins,_as_Jekyll's_has_precedence?_decides
  Scenario: The longer scope path wins
    Then "fr/index.md" takes the permalink "/fr/" of its exact scope
    And "fr/a.md" takes "/d/fr/a.html" from the "fr/*.md" scope

  @test:scripts/tests/docs-route.test.ts::the_permalink_rule::a_glob_covers_files_at_its_own_depth_only;_a_prefix_covers_the_subtree
  Scenario: A glob covers files at its own depth only and a prefix covers the subtree
    Then the scope "*.md" covers "a.md" and not "x/a.md"
    And the scope "g" covers "g/h/a.md" and not "gg/a.md"
    And "x/a.md", covered by no default, publishes at "/x/a.html"

  @test:scripts/tests/docs-route.test.ts::the_permalink_rule::a_scope_by_another_type,_and_an_unknown_placeholder,_are_refused_rather_than_mismodelled
  Scenario: A scope by another type and an unknown placeholder are refused
    Then a default scoped to type "posts" throws
    And a permalink with the placeholder ":year" throws

  @test:scripts/tests/docs-route.test.ts::the_helpers_generators_use::publishedPagePath_reads_the_site's_own_config_and_front_matter
  Scenario: publishedPagePath reads the site's own config and front matter
    Then "concepts/content-types" publishes at "docs/cat-harness/concepts/content-types.html"
    And "index" publishes at the site root
    And "processes/index" publishes at "processes/index.html"

  @test:scripts/tests/docs-route.test.ts::the_helpers_generators_use::publishedHref_rewrites_a_page_authored_at_its_source_location,_and_nothing_else
  Scenario: publishedHref rewrites a link to a moved page, and nothing else
    Then "/concepts/content-types.html#x" becomes "/docs/cat-harness/concepts/content-types.html#x"
    And "/guides/index.html" and "/guides/" become "/docs/cat-harness/guides/index.html"
    And "/processes/", "/cat-harness/catalogue/" and "https://example.org/a.html" are unchanged
