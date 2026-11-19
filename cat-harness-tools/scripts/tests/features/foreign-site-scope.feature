# scripts/lib/foreign-site-scope.ts scopes the platform's chrome (tiles, icon row, harness data, footer, stickies) to a folio's
# own site, used by the IG shell (compose-docs --shell) and the injected rail (rail-standalone-pages --foreign-site).
# Each Scenario names the test that executes it.
Feature: A folio's site describes the folio, not the platform

  @test:scripts/tests/foreign-site-scope.test.ts::a_folio_that_is_the_ROOT_of_its_own_site_keeps_the_pages_it_declares_(issue_#46,_gap_1)::a_declared_own_page_is_the_folio's:_kept_root-relative,_with_its_link_and_count
  Scenario: A page the root folio declares as its own stays root-relative with its link and count
    Given a scope for folio "folio" whose own pages are "/beans/" and "/schemas/"
    When "/beans/" is resolved with siteHref
    Then it stays "/beans/"
    And a beans tile at "/beans/" with count 15 keeps href "/beans/" and count 15
    And a navbar row keeps the beans href "/beans/" and the schemas folder path "/schemas/"

  @test:scripts/tests/foreign-site-scope.test.ts::a_folio_that_is_the_ROOT_of_its_own_site_keeps_the_pages_it_declares_(issue_#46,_gap_1)::a_root-relative_path_it_does_NOT_declare_is_still_not_its_own
  Scenario: A root-relative path the root folio does not declare is not its own
    Given a scope for folio "folio" whose own pages are "/beans/" and "/schemas/"
    When "/todos/" is resolved with siteHref
    Then it is re-based onto the platform as "<platform base>/todos/"
    And a todos tile at "/todos/" with count 3 has no href

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::another_instance's_STATE_graph_is_not_borrowed:_no_link,_no_count
  Scenario: Another instance's state graph tiles get no link and no count
    Given tiles scoped for folio "folio", whose own kinds are "docs" and "qa"
    When the platform's "beans" and "todos" tiles (state graphs) are scoped
    Then each has no href
    And each has no count

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::declaring_a_kind_of_the_same_NAME_does_not_make_the_platform's_graph_the_folio's_(smart-trust_declares_`qa`)
  Scenario: A platform graph of a kind the folio also declares is not the folio's
    Given tiles scoped for folio "folio", which declares the "qa" kind
    When the platform's "qa" tile at "/lsi/" with count 1002 is scoped
    Then it has no href
    And it has no count

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::a_kind_that_cannot_be_classified_is_treated_as_state_—_the_conservative_direction
  Scenario: A tile whose kind cannot be classified is treated as state
    Given a "mystery" tile whose kind "no-such-kind" has no known holds
    When it is scoped for folio "folio"
    Then it has no href

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::a_platform_CONTENT_graph_is_re-based_onto_the_platform,_labelled,_and_carries_no_count
  Scenario: A platform content graph is re-based onto the platform, labelled, with no count
    Given the platform's "skills" tile (a content graph) at "/skills/" with count 40
    When it is scoped for folio "folio"
    Then its href is "<platform base>/skills/"
    And it has no count
    And it shows its qualifier

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::the_folio's_OWN_graph_resolves_inside_its_own_root_and_keeps_its_count
  Scenario: The folio's own graph resolves inside its own root and keeps its count
    Given a "folio-docs" tile at "/folio/docs/" with count 12
    When it is scoped for folio "folio"
    Then its href is "/docs/"
    And its count is 12

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::an_inert_icon_SAYS_why,_and_the_words_tell_'declares_none'_from_'not_published_here'
  Scenario: An inert icon carries a note telling "declares none" from "not published here"
    Given a navbar row with icons "todos", "qa" and "skills" each with a root-relative href
    When the row is scoped for folio "folio"
    Then only "skills" keeps an href, re-based to "<platform base>/skills/"
    And the todos note is "folio declares no todos graph"
    And the qa note is "folio's qa graph is not published on this site"

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::siteHref:_own_root,_platform,_and_what_it_leaves_alone
  Scenario: siteHref maps the folio's root, re-bases the platform, and leaves other links alone
    Given a scope for folio "folio"
    Then "/folio/" resolves to "/"
    And "/folio/a.html" resolves to "/a.html"
    And "/folios/a.html" resolves to "<platform base>/folios/a.html"
    And "https://x.org/a" and "#top" are returned unchanged

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::a_count_projection_is_told_apart_from_chrome
  Scenario: A count projection is told apart from chrome
    When isHostProjection is asked about "assets/beans/count.json" holding a beans tile count
    Then it is a host projection
    And "assets/harness/tiles.json" holding a Liquid jsonify template is not
    And "assets/img/x.json" holding plain JSON is not

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::(c)_the_host's_translation_sweep_and_index_are_projections,_by_name,_on_either_separator
  Scenario: The host's translation sweep and index are projections by file name on either path separator
    Then isHostProjection is true for "_data/translation-qa.json" and "_data/translations.json"
    And it is true for "_data\translations.json" with a backslash separator
    And it is false for "_data/instance-themes.json"

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::(d)_a_borrowed_icon_says_WHOSE_it_is;_an_own_one_does_not
  Scenario: A borrowed icon says whose it is and an own one does not
    Given a navbar row with "fsh-guts" at "/fsh-guts/" and "skills" at "/folio/skills/"
    When the row is scoped for folio "folio" with both kinds held as context
    Then the fsh-guts href is "<platform base>/fsh-guts/"
    And its whose label is "the platform's: folio declares no fsh-guts graph"
    And the skills href is "/skills/" with no whose label

  @test:scripts/tests/foreign-site-scope.test.ts::the_rule,_one_row_per_case::(c,_d)_foreignSite.absent_says_what_the_chrome_shows_instead_of_a_number
  Scenario: foreignSite.absent says what the chrome shows instead of a number
    Given harness data whose navbar has the "fsh-guts" icon
    When it is scoped for folio "folio" with the platform's "/fsh-guts/" href
    Then foreignSite.absent says "folio publishes no translation QA sweep on this site" and "folio declares no fsh-guts graph"
    And with the folio's own "/folio/fsh-guts/" href there is no fshGuts entry

  @test:scripts/tests/foreign-site-scope.test.ts::smart-trust,_against_the_platform's_real_harness_data::(a)_no_tile_carries_the_platform's_count,_and_its_beans_and_todos_are_not_linked
  Scenario: No tile in smart-trust's scoped data carries the platform's count, and beans and todos are unlinked
    # Skipped: when smart-trust's checkout or the platform's built harness data is absent
    Given the platform's real harness data scoped for "smart-trust"
    Then no tile has a count
    And the beans and todos tiles have no href
    And the navbar has no beans or todos href
    And the navbar beans note is "smart-trust declares no beans graph"

  @test:scripts/tests/foreign-site-scope.test.ts::smart-trust,_against_the_platform's_real_harness_data::(d)_the_platform's_fsh-guts_is_a_labelled_link,_and_the_chrome_is_told_it_is_not_this_site's
  Scenario: The platform's fsh-guts is a labelled link and the chrome is told it is not smart-trust's
    # Skipped: when smart-trust's checkout or the platform's built harness data is absent
    Given the platform's real harness data scoped for "smart-trust"
    Then the platform's own fsh-guts href is root-relative
    And the scoped fsh-guts href is that path under the platform base
    And its whose label is "the platform's: smart-trust declares no fsh-guts graph"
    And foreignSite.absent says "smart-trust declares no fsh-guts graph" and "smart-trust publishes no translation QA sweep on this site"

  @test:scripts/tests/foreign-site-scope.test.ts::smart-trust,_against_the_platform's_real_harness_data::(a)_the_header_and_the_rail_scope_are_smart-trust's
  Scenario: The header and rail scope of smart-trust's scoped data are smart-trust's
    # Skipped: when smart-trust's checkout or the platform's built harness data is absent
    Given the platform's real harness data scoped for "smart-trust" with title "WHO SMART Trust"
    Then the title is "WHO SMART Trust"
    And the only rail scope is "smart-trust" at "/"

  @test:scripts/tests/foreign-site-scope.test.ts::smart-trust,_against_the_platform's_real_harness_data::(b)_every_root-relative_path_left_is_one_of_smart-trust's_own,_from_under_/smart-trust/
  Scenario: Every root-relative path left in smart-trust's scoped data is one of its own
    # Skipped: when smart-trust's checkout or the platform's built harness data is absent
    Given the platform's real harness data scoped for "smart-trust"
    When the root-relative paths left in the scoped data are listed
    Then each is a path the platform's data held under "/smart-trust/", with that prefix removed

  @test:scripts/tests/foreign-site-scope.test.ts::the_IG_site's_shell_(compose-docs_--shell),_end_to_end::the_platform's_count_projections_are_not_shipped_as_the_folio's
  Scenario: The IG shell does not ship the platform's count projections as the folio's
    # Skipped: when smart-trust's checkout or the platform's built beans count projection is absent
    Given the shell composed for "smart-trust" with compose-docs --shell
    Then it holds no "assets/beans/count.json" and no "assets/todos/count.json"
    And the composition reports "assets/beans/count.json" as a host projection it left out
    And it still holds the chrome script "assets/todos/todo-page.js"

  @test:scripts/tests/foreign-site-scope.test.ts::the_IG_site's_shell_(compose-docs_--shell),_end_to_end::(c)_the_platform's_translation_sweep_and_index_are_not_shipped_as_the_folio's
  Scenario: The IG shell does not ship the platform's translation sweep and index as the folio's
    # Skipped: when smart-trust's checkout is absent
    Given the shell composed for "smart-trust" with compose-docs --shell
    Then no file named in HOST_DATA_PROJECTIONS exists in the shell
    And each is reported as a host projection it left out

  @test:scripts/tests/foreign-site-scope.test.ts::the_IG_site's_shell_(compose-docs_--shell),_end_to_end::(c)_every_data_file_the_shell_still_carries_is_chrome_—_a_new_projection_must_be_named
  Scenario: Every _data file the IG shell still carries is named chrome
    Given the shell composed for "smart-trust" with compose-docs --shell
    When the JSON files left in its "_data" directory are listed
    Then each is one of "harness.json", "instance-themes.json", "node-kinds.json", "stickies.json" and "todo_listing.json"

  @test:scripts/tests/foreign-site-scope.test.ts::the_IG_site's_shell_(compose-docs_--shell),_end_to_end::the_platform's_per-page_todo_listing_is_written_EMPTY,_never_left_out
  Scenario: The IG shell writes the platform's per-page todo listing empty
    # Gap: when the platform's listing is not built the test returns without asserting
    Given the shell composed for "smart-trust" with compose-docs --shell
    And the platform has a built "_data/todo_listing.json"
    Then the shell's "_data/todo_listing.json" equals the empty todo listing

  @test:scripts/tests/foreign-site-scope.test.ts::the_IG_site's_shell_(compose-docs_--shell),_end_to_end::its_harness_data_is_scoped:_no_count,_no_unresolved_root-relative_href
  Scenario: The IG shell's harness data has no count and no unresolved root-relative href
    # Skipped: when smart-trust's checkout or the platform's built harness data is absent
    Given the shell composed for "smart-trust" with compose-docs --shell
    When its "_data/harness.json" is read
    Then no tile has a count
    And the only root-relative path left is smart-trust's own "/artifacts.html"

  @test:scripts/tests/foreign-site-scope.test.ts::the_footer_line:_a_folio's_site_does_not_print_the_platform's_(#1901_follow-up)::scopeSiteConfig_names_the_folio,_links_the_platform_absolutely,_and_states_no_licence
  Scenario: scopeSiteConfig names the folio, links the platform absolutely and states no licence
    Given a site config titled "Platform" whose footer mentions a licence
    When it is scoped for "scratch-folio" titled "Scratch <Folio>"
    Then the footer is "Scratch &lt;Folio&gt; — built with" a link to "<platform base>/" labelled "Platform"
    And the footer does not mention a licence
    And with no title the footer starts with the layer name "scratch-folio — built with"
    And with no layer either it reads "This site is built with" the platform link
    And a config with no footer to replace is returned as the same object

  @test:scripts/tests/foreign-site-scope.test.ts::the_footer_line:_a_folio's_site_does_not_print_the_platform's_(#1901_follow-up)::the_shell_for_a_scratch_folio_carries_the_neutral_line,_not_the_platform's_footer_text
  Scenario: The shell for a scratch folio carries the neutral footer, not the platform's
    Given the platform's own config has a footer
    When the shell is composed for "scratch-folio" titled "Scratch Folio"
    Then the shell config's footer differs from the platform's
    And it equals foreignFooterContent for that folio and the platform's title
    And it does not mention a licence

  @test:scripts/tests/foreign-site-scope.test.ts::the_footer_line:_a_folio's_site_does_not_print_the_platform's_(#1901_follow-up)::the_platform's_own_build_keeps_its_footer_text,_byte_for_byte
  Scenario: The platform's own build keeps its config footer unchanged
    When the platform's site is composed with no foreign scope
    Then the composed config's footer equals the platform's own config footer
    And every key of the platform's own config parses equal in the composed config

  @test:scripts/tests/foreign-site-scope.test.ts::the_injected_rail_(rail-standalone-pages_--foreign-site)_over_a_fixture_folio_page::its_icon_row_names_no_platform_work_plan_and_no_root-relative_destination
  Scenario: The injected rail's icon row names no platform work plan and no root-relative destination
    # Skipped: when the harness data docs:harness writes at publish is not built
    Given a fixture folio page "doc/index.html"
    When the rail is injected with the foreign site "smart-trust"
    Then one page is injected
    And the navbar row read from the page has no beans or todos href
    And the todos note is "smart-trust declares no todos graph"
    And the row leaves no root-relative path

  @test:scripts/tests/foreign-site-scope.test.ts::the_chrome_reads_foreignSite.absent_(head_custom.html,_rendered)::(c,_d)_on_a_folio's_site_with_no_sweep_of_its_own:_the_words,_and_no_fsh-guts_fetch
  Scenario: On a folio's site with no sweep of its own the chrome shows the words and fetches no fsh-guts
    Given head_custom.html rendered with harness foreignSite absent notes for "ig-folio" and no translation-qa data
    Then the sweep's absent text is "ig-folio publishes no translation QA sweep on this site"
    And the sweep's run flag is false
    And there is no "fa-fsh-guts-src" meta tag

  @test:scripts/tests/foreign-site-scope.test.ts::the_chrome_reads_foreignSite.absent_(head_custom.html,_rendered)::(c)_a_folio_that_publishes_its_OWN_sweep_shows_its_own_figure,_not_the_note
  Scenario: A folio that publishes its own sweep shows its own figure, not the note
    Given head_custom.html rendered with foreignSite absent notes for "ig-folio" and translation-qa data of 12 pages
    Then the sweep's absent text is null
    And its totalPages is 12

  @test:scripts/tests/foreign-site-scope.test.ts::the_chrome_reads_foreignSite.absent_(head_custom.html,_rendered)::on_the_platform's_own_site_nothing_changes:_no_note,_and_the_fsh-guts_document_is_fetched
  Scenario: On the platform's own site the chrome shows the sweep and fetches fsh-guts
    Given head_custom.html rendered with no foreignSite and translation-qa data of 49 of 689 pages
    Then the sweep's absent text is null
    And its pagesWithTranslations is 49
    And there is a "fa-fsh-guts-src" meta tag

  @test:scripts/tests/foreign-site-scope.test.ts::the_landing_stickies_on_a_folio's_site_(who-iris,_2026-10-09)::a_platform_page_is_re-based_onto_the_platform's_site,_and_marked_external_so_relative_url_leaves_it_alone
  Scenario: A platform sticky link is re-based onto the platform's site and marked external
    Given a landing sticky for "who-iris" with a link "docs" to "/docs/cat-harness/concepts/agentic-harness.html"
    When the stickies are scoped
    Then that link's href is the platform base followed by that path
    And it is marked external

  @test:scripts/tests/foreign-site-scope.test.ts::the_landing_stickies_on_a_folio's_site_(who-iris,_2026-10-09)::an_external_link,_a_path_in_the_folio's_own_root,_and_a_relative_link_are_the_folio's
  Scenario: External, own-root and relative sticky links stay the folio's
    Given a landing sticky for "who-iris" with an external, an own-root and a relative link
    When the stickies are scoped
    Then the external link "https://github.com/litlfred/cat-harness" is unchanged
    And "/who-iris/community-list.html" becomes "/community-list.html", not external
    And the relative "community-list.html" is unchanged

  @test:scripts/tests/foreign-site-scope.test.ts::the_landing_stickies_on_a_folio's_site_(who-iris,_2026-10-09)::a_file_with_no_stickies_passes_through
  Scenario: A file with no stickies passes through scopeStickies unchanged
    When scopeStickies is given an object with no stickies
    Then the same content comes back

  @test:scripts/tests/foreign-site-scope.test.ts::rootOwnPages_on_a_GENERATED_folio_site_(smart-ra,_2026-10-14)::a_writer-built_viewer_is_the_folio's_own_page_at_its_ref;_with_a_site_directory_on_disk_it_is_not
  Scenario: A writer-built viewer is the generated folio's own page until a site directory is built
    Given a folio repo declaring a visualiser at "en/folio/models/index.html" written by "tools/gen.ts"
    Then rootOwnPages for "folio" is "/en/folio/models/"
    And it is still that with only the site's "_data" directory present
    And once the site directory has a "_config.yml" rootOwnPages is undefined
