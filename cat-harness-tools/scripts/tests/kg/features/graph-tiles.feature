# scripts/graph-tiles.ts derives one tile per declared visualisation of a graph directory, with its
# surfaces, href, count, icon, title and glass-strip pins, and reports live projections with no
# declaration. Each Scenario names the test that executes it.
Feature: Graph tiles derived from declared visualisations

  @test:scripts/tests/kg/graph-tiles.test.ts::a_bare_string_still_parses_—_the_widening_is_additive::27_declared_paths_in_this_repository_must_not_need_an_edit
  Scenario: A bare visualiser string still parses
    # Gap: the repository's declared paths are not read; one sample bare string is parsed
    Given a coverage declaring the visualiser "docs/x/index.html" as a bare string
    When the visualisations of directory "x" are read
    Then there is one, with ref "docs/x/index.html" and title "x"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_bare_string_still_parses_—_the_widening_is_additive::a_list_of_visualisations_parses_too
  Scenario: A list of visualisations parses too
    Given a coverage declaring visualisations "Shelf" and "Map"
    When the visualisations of directory "library" are read
    Then their titles are "Shelf" then "Map"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_bare_string_still_parses_—_the_widening_is_additive::a_title_falls_back_to_the_directory's_id_—_a_tile_is_never_blank
  Scenario: A visualisation's title falls back to the directory's id
    Given a coverage declaring one visualisation with no title
    When the visualisations of directory "library" are read
    Then its title is "library"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_bare_string_still_parses_—_the_widening_is_additive::no_visualiser_is_an_empty_list,_which_is_a_real_answer
  Scenario: No visualiser yields an empty list
    Given no coverage, and a coverage with docs but no visualiser
    When the visualisations of each are read
    Then both are empty lists

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_is_derived_from_the_DECLARATION::one_per_declared_visualisation,_and_a_directory_with_several_gets_several
  Scenario: One tile per declared visualisation, several for a directory with several
    Given "library" declaring "Shelf" and "Map", "beans" declaring one visualiser, and "nothing" declaring none
    When the tiles are derived
    Then the tile ids are "beans", "library/1" and "library/2"
    And their titles are "beans", "Shelf" and "Map"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_is_derived_from_the_DECLARATION::a_directory_with_ONE_visualisation_gets_its_own_name_as_the_id
  Scenario: A directory with one visualisation gets its own name as the tile id
    Given "beans" declaring a single visualiser
    When the tiles are derived
    Then the tile id is "beans"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_is_derived_from_the_DECLARATION::a_directory_declaring_none_gets_no_tile_—_silence_is_not_a_tile
  Scenario: A directory declaring no visualiser gets no tile
    Given "qa" with no coverage and "health" with docs only
    When the tiles are derived
    Then there are no tiles

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_is_derived_from_the_DECLARATION::the_order_is_the_declaration's,_so_the_artefact_is_generated_and_not_a_snapshot
  Scenario: Tiles come out in a stable derived order
    # Gap: the directories are given as "zed" then "alpha" and come out sorted, so declaration order itself is not what is checked
    Given "zed" and then "alpha", each declaring a visualiser
    When the tiles are derived
    Then the tile directories are "alpha" then "zed"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_is_derived_from_the_DECLARATION::the_tile_carries_the_ref_EXACTLY_as_declared_—_it_opens_the_existing_viewer
  Scenario: The tile carries the ref exactly as declared
    Given "beans" declaring the visualiser "cat-harness/docs/cat-harness/beans/index.html"
    When the tiles are derived
    Then the tile's ref is that path unchanged

  @test:scripts/tests/kg/graph-tiles.test.ts::surfaces:_one_declaration,_per-surface_visibility::absent_means_EVERY_surface_—_a_tile_that_states_nothing_is_complete
  Scenario: A tile declaring no surfaces appears on every surface
    Given a directory declaring a visualiser with no surfaces
    When the tiles are derived
    Then the tile's surfaces are "navbar", "board" and "glass"

  @test:scripts/tests/kg/graph-tiles.test.ts::surfaces:_one_declaration,_per-surface_visibility::a_declared_surface_is_the_only_one_it_appears_on
  Scenario: A declared surface is the only one a tile appears on
    Given a navbar-only tile, a board-only tile and a tile declaring no surfaces
    When the tiles on each surface are listed
    Then the navbar holds "both" and "navbar-only"
    And the board holds "board-only" and "both"

  @test:scripts/tests/kg/graph-tiles.test.ts::surfaces:_one_declaration,_per-surface_visibility::ONE_declaration_drives_every_surface_—_never_two_lists_to_disagree
  Scenario: One declaration drives every surface
    Given one directory declaring a visualisation "a.html" titled "T"
    When the tiles on the navbar, board and glass are listed
    Then on each surface the tile has title "T" and ref "a.html"

  @test:scripts/tests/kg/graph-tiles.test.ts::visibility_and_theme_default,_and_may_be_overridden::hidden_defaults_to_false_and_is_declarable
  Scenario: Hidden defaults to false and is declarable
    Given a visualisation with no hidden flag and one declaring hidden true
    When the tiles are derived
    Then the first tile is not hidden
    And the second tile is hidden

  @test:scripts/tests/kg/graph-tiles.test.ts::visibility_and_theme_default,_and_may_be_overridden::a_tile's_theme_falls_back_to_the_directory's,_then_to_nothing
  Scenario: A tile's theme falls back to the directory's, then to nothing
    Given a directory themed "library"
    When a tile declaring no theme is derived
    Then its theme is "library"
    And a tile declaring the theme "own" has theme "own"
    And a tile in an unthemed directory has no theme

  @test:scripts/tests/kg/graph-tiles.test.ts::a_live_projection_with_no_declaration_is_a_FINDING_—_`flh4`'s_third_state::it_is_reported,_not_silently_given_a_tile
  Scenario: A published projection with no declared visualiser is reported, not given a tile
    Given "uploads" declaring a visualiser, and "beans" and "qa" declaring none
    And "uploads" and "beans" have published projections
    When the undeclared projections are listed
    Then they are exactly "beans"
    And the tiles derived are only for "uploads"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_live_projection_with_no_declaration_is_a_FINDING_—_`flh4`'s_third_state::a_directory_with_neither_is_NOT_a_finding_—_nothing_is_missing_there
  Scenario: A directory with neither a projection nor a declaration is not a finding
    Given "qa" has no published projection and declares no visualiser
    When the undeclared projections are listed
    Then they do not include "qa"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_live_projection_with_no_declaration_is_a_FINDING_—_`flh4`'s_third_state::a_directory_with_both_is_not_a_finding_either
  Scenario: A directory with both a projection and a declaration is not a finding
    Given "uploads" has a published projection and declares a visualiser
    When the undeclared projections are listed
    Then they do not include "uploads"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_live_projection_with_no_declaration_is_a_FINDING_—_`flh4`'s_third_state::the_finding_names_the_repair,_not_the_symptom
  Scenario: The finding names the repair
    Given "beans" has a published projection and no declared visualiser
    When the tile findings for "cat-harness" are built
    Then the first finding names "beans"
    And it mentions "withRenders"
    And it says to "name the directory in the page"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::the_site_directory's_prefix_is_stripped_and_`index.html`_becomes_the_route
  Scenario: The site directory's prefix is stripped and index.html becomes the route
    Given the site directory "cat-harness/docs"
    When the href of "cat-harness/docs/cat-harness/beans/index.html" is computed
    Then it is "/cat-harness/beans/"
    And "cat-harness/docs/cat-harness/schemas/x/index.html" gives "/cat-harness/schemas/x/"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::a_page_that_is_not_`index.html`_keeps_its_filename
  Scenario: A page that is not index.html keeps its filename
    Given the site directory "cat-harness/docs"
    When the href of "cat-harness/docs/guides/x.html" is computed
    Then it is "/guides/x.html"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::A_NAMED_MARKDOWN_PAGE_BECOMES_`.html`,_because_Jekyll_serves_no_`.md`
  Scenario: A named Markdown page becomes .html
    Given the site directory "cat-harness/docs"
    When the href of "cat-harness/docs/processes-index.md" is computed
    Then it is "/processes-index.html"
    And "cat-harness/docs/guides/x.md" gives "/guides/x.html"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::...and_the_directory_form_still_wins_where_both_would_apply
  Scenario: An index.md still becomes the directory route
    Given the site directory "cat-harness/docs"
    When the href of "cat-harness/docs/cat-harness/processes/index.md" is computed
    Then it is "/cat-harness/processes/"
    And "cat-harness/docs/cat-harness/tools/index.md" gives "/cat-harness/tools/"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::a_ref_OUTSIDE_the_site_gets_no_href_rather_than_a_guessed_one
  Scenario: A ref outside the site gets no href
    Given the site directory "cat-harness/docs"
    When the href of "elsewhere/viewer.html" is computed
    Then there is none
    And "cat-harness/docsomething/x.html", which only shares the prefix text, has none either

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::tiles_carry_the_href_only_when_a_site_directory_is_supplied
  Scenario: Tiles carry an href only when a site directory is supplied
    Given "beans" declaring "cat-harness/docs/cat-harness/beans/index.html"
    When the tiles are derived without a site directory
    Then the tile has no href
    And derived with the site directory "cat-harness/docs" its href is "/cat-harness/beans/"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_declared_path_is_NOT_a_published_URL_—_`prc5`_one_layer_down::an_unservable_ref_leaves_the_tile_unlinked_but_still_present
  Scenario: An unservable ref leaves the tile unlinked but present
    Given a directory declaring "elsewhere/v.html"
    When the tiles are derived with the site directory "cat-harness/docs"
    Then there is 1 tile
    And it has no href
    And its ref is "elsewhere/v.html"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::a_declared_count_reaches_the_tile_with_its_unit
  Scenario: A declared count reaches the tile with its unit
    Given tiles for "beans" and "fsh-guts"
    When the count 466 "beans" is attached for "beans"
    Then the beans tile's count is 466
    And its unit is "beans"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::a_directory_nobody_counted_has_NO_count_field_—_not_a_zero
  Scenario: A directory nobody counted has no count field
    Given tiles for "beans" and "fsh-guts"
    When a count is attached for "beans" only
    Then the fsh-guts tile has no count field
    And it has no unit field

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::ZERO_is_carried,_because_zero_is_the_answer_worth_showing
  Scenario: A zero count is carried
    Given tiles for "beans" and "fsh-guts"
    When the count 0 is attached for "beans"
    Then the beans tile's count is 0

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::an_empty_map_changes_nothing_at_all
  Scenario: An empty count map changes nothing
    Given tiles for "beans" and "fsh-guts"
    When an empty count map is attached
    Then the tiles equal the tiles given
    And no tile has a count field

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::a_count_for_a_directory_with_no_TILE_is_simply_not_a_tile
  Scenario: A count for a directory with no tile does not make one
    Given tiles for "beans" and "fsh-guts"
    When a count is attached for "voices"
    Then no tile is for "voices"
    And there are still 2 tiles

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::the_pass_does_not_MUTATE_the_tiles_it_was_given
  Scenario: Attaching counts does not mutate the tiles given
    Given tiles for "beans" and "fsh-guts"
    When the count 466 is attached for "beans"
    Then none of the original tiles has a count field

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile's_count_is_attached,_never_derived::keyed_by_DIRECTORY,_so_two_views_of_one_graph_share_its_number
  Scenario: Counts are keyed by directory, so every view of one graph shares its number
    Given "beans" declaring two visualisations, giving more than one tile
    When the count 466 is attached for "beans"
    Then every tile's count is 466

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::the_ref_resolves_to_its_directory_id
  Scenario: A declared ref resolves to its directory id
    Given "beans" and "todos" each declaring their own index.html
    When the directory-by-ref lookup is built
    Then "docs/cat-harness/beans/index.html" maps to "beans"
    And "docs/cat-harness/todos/index.html" maps to "todos"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::a_ref_nobody_declared_is_ABSENT,_not_a_guess
  Scenario: A ref nobody declared is absent from the lookup
    Given only "beans" declaring a visualiser
    When the directory-by-ref lookup is built
    Then "docs/nobody/index.html" maps to nothing

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::the_id_is_NOT_the_subject_name_with_a_suffix
  Scenario: The directory id is not composed from the subject name
    Given "folio-assist-core-schemas" declaring the schemas page of subject "folio-assistant-core"
    When the directory-by-ref lookup is built
    Then that page maps to "folio-assist-core-schemas"
    And "folio-assistant-core-schemas" is not that id

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::a_directory_declaring_SEVERAL_visualisations_claims_each_page
  Scenario: A directory declaring several visualisations claims each page
    Given "library" declaring "docs/library/a.html" and "docs/library/b.html"
    When the directory-by-ref lookup is built
    Then both pages map to "library"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::two_directories_over_ONE_page_keep_the_first,_rather_than_racing
  Scenario: Two directories over one page keep the first
    Given "agent-skills-library" and then "library" both declaring "docs/library/agent-skills/index.html"
    When the directory-by-ref lookup is built
    Then the page maps to "agent-skills-library"
    And the lookup holds 1 entry

  @test:scripts/tests/kg/graph-tiles.test.ts::a_page's_declared_ref_names_the_directory_that_declared_it::a_directory_declaring_nothing_contributes_nothing
  Scenario: A directory declaring nothing contributes nothing to the lookup
    Given "undeclared" with no coverage
    When the directory-by-ref lookup is built
    Then it is empty

  @test:scripts/tests/kg/graph-tiles.test.ts::one_tile_per_page_(#1168_B7a-2b)::a_page_shared_by_several_directories_gets_one_tile
  Scenario: A page shared by several directories gets one tile
    Given "smart-base-processes", "processes" and "core-processes" all declaring "docs/cat-harness/processes/index.md", and "tools" its own page
    When the tiles are derived
    Then one tile has the shared ref
    And there are 2 tiles in all

  @test:scripts/tests/kg/graph-tiles.test.ts::one_tile_per_page_(#1168_B7a-2b)::and_it_is_the_instance's_own_directory's_tile
  Scenario: The shared page's tile belongs to the instance's own directory
    Given the shared processes page declared by two repository-scoped directories and the unscoped "processes"
    When the tiles are derived
    Then the shared page's tile is for directory "processes"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_with_no_icon_of_its_own_takes_its_graph_TYPOLOGY's_(ob3m_finding_11)::an_undeclared_icon_falls_back_to_the_first_kind_that_has_one
  Scenario: An undeclared icon falls back to the first kind that has one
    Given "who-iris-library" of kind "library" declaring no icon
    When the tiles are derived
    Then its icon is "library"
    And the kind icon for kinds "cat-harness" and "schemas" is "schemas"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_with_no_icon_of_its_own_takes_its_graph_TYPOLOGY's_(ob3m_finding_11)::a_declared_icon_still_wins_over_the_kind
  Scenario: A declared icon wins over the kind's
    Given "skills" of kind "skills" declaring the icon "docs"
    When the tiles are derived
    Then its icon is "docs"

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_with_no_icon_of_its_own_takes_its_graph_TYPOLOGY's_(ob3m_finding_11)::a_kind_with_no_icon_leaves_the_tile_without_one,_rather_than_guessing
  Scenario: A kind with no icon leaves the tile without one
    Given "glossary" of kind "swimlane-glossary" declaring no icon
    When the tiles are derived
    Then the tile has no icon property
    And the kind icon for no kinds is undefined

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_says_the_destination's_ONE_name_(bean_`ob3m`_finding_6)::an_undeclared_title_is_the_kind's_display_name,_never_the_directory_id
  Scenario: An undeclared title is the kind's display name
    Given "root-docs" of kind "docs" declaring no title
    When the tiles are derived
    Then the titles are ["Docs"]

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_says_the_destination's_ONE_name_(bean_`ob3m`_finding_6)::the_harness_is_a_qualifier_beside_the_label,_never_folded_into_it
  Scenario: The harness is a qualifier beside the label, not folded into it
    Given "docs" titled "Docs — cat-harness" and a repository-scoped "root-docs", both of kind "docs"
    And a qualifier of "Folio Assistant" for repository scope and "C@T Harness" otherwise, with "cat-harness" as a harness name
    When the tiles are derived
    Then the title and qualifier pairs are "Docs" with "C@T Harness" and "Docs" with "Folio Assistant"
    And both tiles show their qualifier, since they share a name

  @test:scripts/tests/kg/graph-tiles.test.ts::a_tile_says_the_destination's_ONE_name_(bean_`ob3m`_finding_6)::a_tile_whose_name_is_unique_keeps_the_qualifier_out_of_sight
  Scenario: A tile whose name is unique keeps its qualifier out of sight
    Given a single "docs" tile qualified "C@T Harness"
    When the tiles are derived
    Then its qualifier is "C@T Harness"
    And showQualifier is not set

  @test:scripts/tests/kg/graph-tiles.test.ts::resolveGlassStrip_—_pinned_tiles_first,_plus_'+N_more'::chrome_pins_become_glass-<id>,_kinds_become_ONE_tile_each,_in_declared_order
  Scenario: Chrome pins become glass-<id> and kinds become one tile each, in declared order
    Given tiles including "library-who-iris" before "library", and "skills-other" of kind "skills"
    When the glass strip pins chrome "todos" and "settings" then kinds "library", "processes", "tools" and "skills"
    Then the pinned ids are "glass-todos", "glass-settings", "library", "processes", "tools" and "skills-other"
    And nothing is unmatched

  @test:scripts/tests/kg/graph-tiles.test.ts::resolveGlassStrip_—_pinned_tiles_first,_plus_'+N_more'::a_kind_no_usable_tile_holds_is_a_finding,_never_a_silent_skip
  Scenario: A kind no usable tile holds is reported as unmatched
    Given a staging-only "staged" tile of kind "fsh-guts" and a navbar-only "processes" tile
    When the glass strip pins kinds "fsh-guts" and "processes"
    Then nothing is pinned
    And "fsh-guts" and "processes" are unmatched

  @test:scripts/tests/kg/graph-tiles.test.ts::resolveGlassStrip_—_pinned_tiles_first,_plus_'+N_more'::a_hidden_tile_or_one_with_no_page_is_never_pinned
  Scenario: A hidden tile or one with no page is never pinned
    Given a hidden "library" tile and a "library-who-iris" tile with no href
    When the glass strip pins kind "library"
    Then "library" is unmatched

  @test:scripts/tests/kg/graph-tiles.test.ts::resolveGlassStrip_—_pinned_tiles_first,_plus_'+N_more'::the_schema_refuses_a_pin_listed_twice_and_a_chrome_id_nothing_draws
  Scenario: The glass strip schema refuses a duplicate pin and an unknown chrome id
    Given the glass strip schema
    Then kind "tools" listed twice does not parse
    And chrome "more" does not parse
    And chrome "todos" with kind "tools" parses

  @test:scripts/tests/kg/graph-tiles.test.ts::labelFor_—_an_undeclared_tile_is_named_as_its_page's_rows_name_it::the_row's_name_replaces_the_first-kind_fallback
  Scenario: The row's name replaces the first-kind fallback title
    Given "smart-base-schemas" of kinds "code" and "schemas" declaring no title
    And harness rows naming its page "/en/cat-harness/schemas/smart-base/" as "Schemas"
    When the tiles are derived without the rows
    Then the title is "Code"
    And derived with the rows the title is "Schemas"

  @test:scripts/tests/kg/graph-tiles.test.ts::labelFor_—_an_undeclared_tile_is_named_as_its_page's_rows_name_it::a_declared_title_still_wins_over_the_row's_name
  Scenario: A declared title wins over the row's name
    Given a directory declaring the title "Declared" for the smart-base schemas page
    And harness rows naming that page "Schemas"
    When the tiles are derived with the rows
    Then the title is "Declared"

  @test:scripts/tests/kg/graph-tiles.test.ts::labelFor_—_an_undeclared_tile_is_named_as_its_page's_rows_name_it::no_row_for_the_page_keeps_the_fallback
  Scenario: No row for the page keeps the fallback title
    Given "smart-base-schemas" of kinds "code" and "schemas" declaring no title
    And harness rows that name no page
    When the tiles are derived
    Then the title is "Code"
