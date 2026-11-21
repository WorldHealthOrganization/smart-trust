# scripts/viewer-declarations.ts reads which visualiser renders a directory from the harness
# declarations, and scripts/check-visualiser-routes.ts places pages under their localised routes.
# Each Scenario names the test that executes it.
Feature: Visualiser declarations, routes and provenance

  @test:scripts/tests/ui/viewer-declarations.test.ts::provenance:_a_page_names_the_Tool_that_drew_it,_and_nothing_else::HTML:_inserted_after_<head>,_replaced_not_duplicated,_and_any_`renders`_meta_removed
  Scenario: An HTML page carries one rendered-by meta and no renders meta
    # Gap: that the meta is inserted right after <head> is not checked
    Given an HTML page with a "renders" meta and an old "rendered-by" meta
    When rendered-by "t" is written into it
    Then its rendered-by reads "t"
    And it no longer carries a renders meta
    And writing rendered-by "u" over it leaves exactly one rendered-by meta

  @test:scripts/tests/ui/viewer-declarations.test.ts::provenance:_a_page_names_the_Tool_that_drew_it,_and_nothing_else::markdown:_into_the_front_matter,_`renders:`_list_removed
  Scenario: A markdown page carries rendered-by in its front matter and no renders list
    Given a markdown page whose front matter has a "renders:" list and "rendered-by: x"
    When rendered-by "t" is written into its front matter
    Then the front matter is exactly "title: T" and "rendered-by: t"
    And its rendered-by reads "t" and it carries no renders
    And a text with no front matter is returned unchanged

  @test:scripts/tests/ui/viewer-declarations.test.ts::provenance:_a_page_names_the_Tool_that_drew_it,_and_nothing_else::a_directory_is_named_repository-relative,_with_no_trailing_slash
  Scenario: A rendered directory is named repository-relative with no trailing slash
    Given the repository "/r" and the directory "/r/who-iris/library/"
    When its rendered path is taken
    Then it is "who-iris/library"

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_declaration_is_the_only_source_of_a_visualiser_and_its_route::every_instance's_`visualisers`,_with_the_harness_that_declares_them
  Scenario: Every instance's visualisers are read with the harness that declares them
    Given a checkout where cat-harness declares the "library" and "todos" visualisers
    When the declared visualisers are read
    Then they are "cat-harness/library:library-viewer" and "cat-harness/todos:state-viewer"
    And the declared route of "library-viewer" is "cat-harness/library"
    And an undeclared Tool has no route

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_declaration_is_the_only_source_of_a_visualiser_and_its_route::`covers`:_the_harness's_own_directory,_at_the_full_view
  Scenario: A covered directory of the harness opens its full view
    Given cat-harness's "todos" directory, covered by the "todos" visualiser
    When its viewers are read
    Then the one viewer is "base/docs/cat-harness/todos/index.html"
    And its title is "Todos" and its icon is "todo"

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_declaration_is_the_only_source_of_a_visualiser_and_its_route::`coversKinds`_+_`subgraphs:_instance`:_another_instance's_directory_opens_its_sub-graph_view
  Scenario: Another instance's directory of a covered kind opens its sub-graph view
    Given top's "top-library" directory of kind "library", covered by kind with subgraphs per instance
    When its viewers are read
    Then the one viewer is "base/docs/cat-harness/library/top/index.html"

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_declaration_is_the_only_source_of_a_visualiser_and_its_route::`coversKinds`_+_`subgraphs:_instance`_+_`writer`:_a_publish-time_sub-graph_view_resolves_before_its_writer_runs_(bean_8jur)
  Scenario: A publish-time sub-graph view resolves before its writer runs
    Given cat-harness declares an "ig-ast" visualiser by kind, per instance, with writer "scripts/gen-ig-ast-pages.ts"
    And no page for it has been written
    When the viewers of top's "top-ast" directory are read
    Then the one viewer is the localised "cat-harness/ig-ast/top/index.html" under base/docs
    And its writer is "base/scripts/gen-ig-ast-pages.ts"

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_declaration_is_the_only_source_of_a_visualiser_and_its_route::a_directory_nothing_covers_has_no_viewer_—_no_page_can_claim_one
  Scenario: A directory nothing covers has no viewer
    Given a directory of kind "voices" that no visualiser covers
    When its viewers are read
    Then there are none

  @test:scripts/tests/ui/viewer-declarations.test.ts::collisions_are_declaration_errors::two_declarations_of_one_route_—_the_LOCALISED_route_(folio-assistant#2527)
  Scenario: Two declarations of one localised route collide
    Given two visualiser declarations of "a/x"
    When the declarations are checked
    Then the only finding is a "route-collision"
    And its subject is the localised route "<locale>/a/x/"

  @test:scripts/tests/ui/viewer-declarations.test.ts::collisions_are_declaration_errors::an_alias_may_not_take_a_published_locale's_top-level_segment
  Scenario: An alias may not take a published locale's top-level segment
    Given a visualiser whose alias is the page locale
    When the declarations are checked
    Then the only finding is an "alias-collision" on "<locale>/"
    And its detail names that locale

  @test:scripts/tests/ui/viewer-declarations.test.ts::collisions_are_declaration_errors::an_alias_naming_another_alias,_a_harness,_or_something_the_site_already_carries
  Scenario: An alias may not name another alias, a harness, or a carried top-level path
    Given aliases "x" twice, "b" which is a harness, and "guides" which the site already carries
    When the declarations are checked
    Then the findings are alias collisions on "b/", "guides/" and "x/"

  @test:scripts/tests/ui/viewer-declarations.test.ts::collisions_are_declaration_errors::distinct_routes_and_free_aliases_are_clean
  Scenario: Distinct routes and free aliases are clean
    Given visualisers "a/x" with alias "x" and "b/x" with none
    When the declarations are checked
    Then there are no findings

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_locale_goes_in_front_of_every_visualiser_page_(folio-assistant#2527)::the_page_locale_is_cat-harness's_default,_supplied_in_ONE_place
  Scenario: The page locale is cat-harness's default, supplied in one place
    Given the page locale
    Then it is the default locale and one of the published locales
    And page parts with no locale get the page locale
    And a locale the caller names is kept
    And the forwarding parts of a page are its parts without the locale

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_locale_goes_in_front_of_every_visualiser_page_(folio-assistant#2527)::a_generator_writes_under_the_locale;_the_unlocalised_route_is_the_forwarding_address
  Scenario: A generator writes under the locale and the unlocalised route forwards
    Given the fixture checkout
    When the declared routes of "library-viewer" are read
    Then its page route is "<locale>/cat-harness/library"
    And its forwarding route is "cat-harness/library"
    And an undeclared Tool has no page route
    And the site path of "state-viewer" is "<locale>/cat-harness/todos/index.md", three steps "../../../" from the site root

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_locale_goes_in_front_of_every_visualiser_page_(folio-assistant#2527)::the_localised_page_dir_is_under_`<site>/<locale>/<harness>/<visualiser>/`
  Scenario: The localised page dir is under site, locale, harness and visualiser
    Given the site "/s" and the "library" visualiser of cat-harness with sub-graph "who-iris"
    When its page dir is taken
    Then it is "/s/<locale>/cat-harness/library/who-iris"

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_locale_goes_in_front_of_every_visualiser_page_(folio-assistant#2527)::a_page_is_read_where_it_IS:_under_the_locale_once_drawn_there,_else_at_the_old_address
  Scenario: A page is read under the locale once drawn there, else at the old address
    Given only the old "cat-harness/todos" copy of the page exists
    Then the existing page dir is the old address
    And once a page is drawn under the locale, the localised dir wins
    And a visualiser with no page anywhere has no existing page dir
    And the "todos" tile opens the localised page

  @test:scripts/tests/ui/viewer-declarations.test.ts::the_locale_goes_in_front_of_every_visualiser_page_(folio-assistant#2527)::with_no_page_anywhere,_a_tile_names_the_localised_address,_not_the_forwarding_one
  Scenario: With no page anywhere a tile names the localised address
    Given the old "cat-harness/todos" page is removed
    When the viewers of the "todos" directory are read
    Then the one viewer is the localised "cat-harness/todos/index.html" under base/docs

  @test:scripts/tests/ui/viewer-declarations.test.ts::check:visualiser-routes_places_pages_under_the_localised_routes_(folio-assistant#2527)::a_page_under_`<locale>/<harness>/<visualiser>/`,_by_its_own_Tool,_is_placed
  Scenario: A page under its localised route by its own Tool is placed
    Given the "library" and "todos" visualisers of cat-harness
    When a "library-viewer" page under "<locale>/cat-harness/library/" or its "who-iris" sub-graph is placed
    Then both are placed "ok"

  @test:scripts/tests/ui/viewer-declarations.test.ts::check:visualiser-routes_places_pages_under_the_localised_routes_(folio-assistant#2527)::the_same_page_at_the_OLD_address_is_counted_as_legacy,_not_failed
  Scenario: The same page at the old address is legacy, not failed
    When a "library-viewer" page at "cat-harness/library/who-iris/index.html" is placed
    Then it is "legacy" with route "cat-harness/library/"

  @test:scripts/tests/ui/viewer-declarations.test.ts::check:visualiser-routes_places_pages_under_the_localised_routes_(folio-assistant#2527)::a_page_by_another_Tool_under_the_localised_route_is_foreign;_one_under_no_route_is_outside
  Scenario: A page by another Tool is foreign and a page under no route is outside
    When a "library-viewer" page under the localised todos route is placed
    Then it is a "foreign-page"
    And a "library-viewer" page at "elsewhere/index.html" is "outside-route"
    And its detail names "<locale>/cat-harness/library/"

  @test:scripts/tests/ui/viewer-declarations.test.ts::check:visualiser-routes_places_pages_under_the_localised_routes_(folio-assistant#2527)::a_page_naming_no_discovered_Tool_is_not_this_gate's_to_place
  Scenario: A page naming no discovered Tool is not placed by this gate
    When a page with no rendered-by, or one naming an unknown Tool, is placed
    Then both are "ok"

  @test:scripts/tests/ui/viewer-declarations.test.ts::a_viewer_page_built_at_publish_counts_as_present_(owner,_2026-10-15)::a_page_under_the_harness's_builtAtPublish_gets_that_entry's_writer_files
  Scenario: A page under the harness's builtAtPublish gets that entry's writer files
    Given harness "h" builds "docs/en/h/procs/" at publish with writer script "procs:viz"
    And "procs:viz" runs "tools/gen-procs.ts"
    When the writer of "h/docs/en/h/procs/index.html" is read
    Then it is "tools/gen-procs.ts"

  @test:scripts/tests/ui/viewer-declarations.test.ts::a_viewer_page_built_at_publish_counts_as_present_(owner,_2026-10-15)::a_page_the_harness_does_not_build_at_publish_gets_none
  Scenario: A page the harness does not build at publish has no publish writer
    When the writer of "h/docs/en/h/other/index.html" is read
    Then there is none

  @test:scripts/tests/ui/viewer-declarations.test.ts::a_viewer_page_built_at_publish_counts_as_present_(owner,_2026-10-15)::a_writer_name_that_resolves_to_no_file_is_not_a_writer
  Scenario: A writer name that resolves to no file is not a writer
    Given harness "h2" builds "docs/x/" at publish with writer "missing:script", which names no script
    When the writer of "h2/docs/x/index.html" is read
    Then there is none
