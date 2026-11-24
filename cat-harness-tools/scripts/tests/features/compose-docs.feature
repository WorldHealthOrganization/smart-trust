# scripts/compose-docs.ts composes the declared docs layers into one site tree: overlays win and are
# reported, Jekyll configs merge, previews carry only touched instances, and old addresses forward.
# Each Scenario names the test that executes it.
Feature: Composing the docs layers into one site

  @test:scripts/tests/compose-docs.test.ts::compose-docs_reads_its_layers_from_the_declaration::base_first,_overlay_last_—_and_the_non-docs_entry_is_not_a_layer
  Scenario: The docs layers are the docs entries in order, base before overlay
    Given a fixture declaring "docs", a repository-scoped "root-docs" and a non-docs "schemas" entry
    When its docs layers are read
    Then the layers are "docs" then "root-docs"
    And only "root-docs" is repository-scoped
    And no layer is missing

  @test:scripts/tests/compose-docs.test.ts::compose-docs_reads_its_layers_from_the_declaration::a_declared_layer_with_NO_directory_is_reported,_never_silently_empty
  Scenario: A declared docs layer with no directory is reported missing
    Given a fixture whose "root-docs" directory has been removed
    When its docs layers are read
    Then the layers are "docs" alone
    And the missing layers are "root-docs"

  @test:scripts/tests/compose-docs.test.ts::compose-docs_reads_its_layers_from_the_declaration::a_declared_layer_absent_because_it_is_BUILT_AT_PUBLISH_is_pending,_not_missing
  Scenario: A layer declared built at publish and not yet built is pending
    Given a fixture whose root declares "built/" as a docs layer built at publish, with no such directory
    When its docs layers are read
    Then "built-docs" is pending, nothing is missing, and it is not among the layers
    And once "built/" exists it is among the layers

  @test:scripts/tests/compose-docs.test.ts::an_EMPTY_overlay_composes_byte-identically_—_the_safety_property::on_the_real_tree,_every_file_and_every_byte_matches_the_base
  Scenario: Composing the real tree keeps every non-withheld base file byte-identical
    Given the real repository, whose instance layers are "site-chrome" then "docs"
    When it is composed
    Then more than 100 files are supplied
    And every override is a site-chrome file under "_includes/generated/"
    And the composed "_config.yml" parses to the merge of the two layers' configs
    And every other base file that is not withheld has the same digest
    And the only base files missing from the output are the withheld ones
    And every added file sits under a composed layer's prefix or is a reported alias, forward or held page
    And there are no alias collisions, and no forwarding page replaces a layer's file
    And files are added exactly when some layer composed

  @test:scripts/tests/compose-docs.test.ts::an_EMPTY_overlay_composes_byte-identically_—_the_safety_property::the_overlay's_own_dotfile_does_NOT_become_a_published_page
  Scenario: The overlay's dotfiles are not composed
    Given a base with "a.md" and an overlay with ".gitkeep" and ".hidden/x.md"
    When it is composed
    Then only "a.md" is supplied
    And no ".gitkeep" is written

  @test:scripts/tests/compose-docs.test.ts::an_override_is_applied_AND_reported::the_overlay's_bytes_win
  Scenario: An overlay file replaces the base file's bytes
    Given a base with "p.md" as "BASE" and "keep.md" as "untouched"
    And an overlay with "p.md" as "OVERLAY"
    When it is composed
    Then "p.md" reads "OVERLAY"
    And "keep.md" reads "untouched"

  @test:scripts/tests/compose-docs.test.ts::an_override_is_applied_AND_reported::...and_BOTH_layers_are_named,_which_is_the_ruling's_actual_requirement
  Scenario: An override names the path, the base layer and the overriding layer
    Given a base and an overlay that both hold "p.md"
    When it is composed
    Then the overrides are exactly "p.md" from base layer "docs" by "root-docs"

  @test:scripts/tests/compose-docs.test.ts::an_override_is_applied_AND_reported::a_path_only_the_overlay_has_is_ADDED,_not_an_override
  Scenario: A file only the overlay has is reported as added, not as an override
    Given a base with "p.md" and an overlay with "new.md"
    When it is composed
    Then there are no overrides
    And the added files are "new.md"
    And "new.md" is supplied by "root-docs" and "p.md" by "docs"

  @test:scripts/tests/compose-docs.test.ts::an_override_is_applied_AND_reported::nested_paths_override_at_the_right_path,_not_by_basename
  Scenario: A nested overlay file overrides only the same nested path
    Given a base with "guides/a.md" and "b.md"
    And an overlay with "guides/a.md"
    When it is composed
    Then the only override is "guides/a.md"
    And "b.md" reads "BASE B"

  @test:scripts/tests/compose-docs.test.ts::a_Jekyll_config_is_MERGED,_overlay_keys_winning::the_overlay's_keys_win_and_the_base's_survive
  Scenario: A Jekyll config is merged with the overlay's keys winning
    Given a base config with title "BASE" and plugins "jekyll-feed"
    And an overlay config with title "OVERLAY"
    When it is composed
    Then the composed config's title is "OVERLAY" and its plugins are "jekyll-feed"
    And the config is reported neither as an override nor as added

  @test:scripts/tests/compose-docs.test.ts::a_Jekyll_config_is_MERGED,_overlay_keys_winning::...and_the_CHANGED_KEYS_are_named,_not_counted
  Scenario: A merged config reports the keys the overlay changed
    Given a base config with title and color
    And an overlay config with only title
    When it is composed
    Then the merged report is "_config.yml" from "docs" by "root-docs" with keys "title"

  @test:scripts/tests/compose-docs.test.ts::a_Jekyll_config_is_MERGED,_overlay_keys_winning::a_config_only_the_BASE_has_passes_through_with_its_BYTES_untouched
  Scenario: A config only the base holds is copied byte for byte
    Given a base config with a comment, a title and plugins, and no overlay config
    When it is composed
    Then the composed config has exactly the base's bytes
    And nothing is reported as merged

  @test:scripts/tests/compose-docs.test.ts::the_merge_rule_itself::objects_merge_RECURSIVELY_—_one_token_does_not_drop_the_theme
  Scenario: Nested objects merge recursively
    Given a base theme with color "red" and font "serif"
    When an overlay theme with color "blue" is merged over it
    Then the theme is color "blue" and font "serif"

  @test:scripts/tests/compose-docs.test.ts::the_merge_rule_itself::lists_REPLACE_rather_than_concatenate
  Scenario: An overlay list replaces the base list
    Given a base nav of "a", "b" and "c"
    When an overlay nav of "a" is merged over it
    Then the nav is "a" alone

  @test:scripts/tests/compose-docs.test.ts::the_merge_rule_itself::a_nested_change_is_reported_by_its_DOTTED_path
  Scenario: A nested change is reported by its dotted path
    Given a base with a theme color and font and a title
    When an overlay changing only the theme color is merged over it
    Then the changed keys are "theme.color"

  @test:scripts/tests/compose-docs.test.ts::the_merge_rule_itself::an_overlay_may_deliberately_null_a_key_out
  Scenario: An overlay null clears a key
    Given a base with analytics "UA-1"
    When an overlay setting analytics to null is merged over it
    Then analytics is null in the result
    And "analytics" is reported as changed

  @test:scripts/tests/compose-docs.test.ts::the_merge_rule_itself::a_key_only_the_base_has_is_untouched
  Scenario: A key only the base has is kept unchanged
    Given a base with a 1 and b 2
    When an overlay with a 9 is merged over it
    Then the result is a 9 and b 2
    And only "a" is reported as changed

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::NO_list_carries_everything_—_any_doubt_keeps_the_pages_under_review
  Scenario: With no file list every instance is carried
    Given the instances "smart-trust" and "who-iris"
    When the carried instances are decided with no file list
    Then both are carried
    And each reason says "no readable file list"

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::an_EMPTY_list_is_a_determined_zero,_and_it_stubs
  Scenario: An empty file list carries nothing
    Given the instance "smart-trust"
    When the carried instances are decided with an empty file list
    Then it is not carried

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::a_file_under_the_instance_carries_it,_and_the_reason_NAMES_that_file
  Scenario: A changed file under the instance carries it and is named in the reason
    Given the instance "smart-trust"
    And changed files "cat-harness/docs/index.md" and "smart-trust/fhir-artifact-index/dak/x.json"
    When the carried instances are decided
    Then it is carried
    And the reason names "smart-trust/fhir-artifact-index/dak/x.json"

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::the_predicate_is_the_INSTANCE,_not_its_composed_directory
  Scenario: A change anywhere in the instance carries it, not only under its docs
    Given the instance "smart-trust"
    When the changed files are "smart-trust/scripts/gen.ts"
    Then it is carried

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::a_branch_touching_nothing_of_the_instance's_stubs_it
  Scenario: A branch touching nothing of the instance leaves it stubbed
    Given the instance "smart-trust"
    When the changed files are "cat-harness/schemas/types.ts"
    Then it is not carried
    And the reason mentions "smart-trust/"

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::a_SIBLING_sharing_the_name's_prefix_does_not_count_as_a_touch
  Scenario: A sibling directory sharing the name's prefix does not carry the instance
    Given the instance "smart-trust"
    When the changed files are "smart-trust-notes/readme.md"
    Then it is not carried

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::a_`./`-prefixed_path_still_matches
  Scenario: A changed path written with a leading "./" still matches
    Given the instance "smart-trust"
    When the changed files are "./smart-trust/docs/x.md"
    Then it is carried

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::the_match_is_on_the_DIRECTORY,_not_the_declaration's_name
  Scenario: The match is on the instance's directory, not its composed name
    Given an instance in directory "smart-trust" composed under "WHO SMART Trust"
    When the changed files are "smart-trust/docs/x.md"
    Then it is carried
    And a change to "WHO SMART Trust/x.md" does not carry it

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_—_what_a_preview_must_carry_(bean_`ga8a`)::the_stub_says_where_the_full_copy_is_—_`pb04`
  Scenario: The instance stub points at the full published copy
    Given the instance "smart-trust"
    When its stub page is built
    Then it contains "https://litlfred.github.io/folio-assistant/smart-trust/"
    And it contains "smart-trust/"
    And it starts with front matter "---"

  @test:scripts/tests/compose-docs.test.ts::the_cut,_on_the_REAL_tree::every_composed_instance_gets_exactly_one_decision
  Scenario: Each composed instance on the real tree has a carry decision
    Given the real tree composed for a branch changing only "cat-harness/docs/index.md"
    Then the instances with decisions are exactly the composed instances

  @test:scripts/tests/compose-docs.test.ts::the_cut,_on_the_REAL_tree::a_branch_touching_no_instance_composes_MATERIALLY_fewer_files
  Scenario: A branch touching no instance composes no more files than the cut allows
    # Gap: on a real tree where no layer composes, only checks that both trees have the same file count
    Given the real tree composed in full and composed for a branch changing only "cat-harness/docs/index.md"
    When no layer composes
    Then both trees supply the same number of files
    When layers compose
    Then some instance is not carried
    And the cut tree loses each stubbed layer's own files, gaining at most one stub each
    And each stubbed layer without its own IG site has an index.md saying "not built into this preview"

  @test:scripts/tests/compose-docs.test.ts::the_cut,_on_the_REAL_tree::with_no_list,_the_real_tree_carries_every_instance_in_full
  Scenario: With no file list the real tree carries every instance
    Given the real tree composed with no file list
    Then every carry decision carries

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_with_the_staging_cone_(bean_4j86)::the_cone_carries_what_the_prefix_match_drops:_a_generator_change
  Scenario: The staging cone carries an instance a generator change reaches
    Given the instance "smart-trust" and a staging cone that carries its docs
    When the changed files are "fhir-harness/scripts/gen-ig-pages.ts"
    Then it is carried
    And the reason mentions "staging cone"

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_with_the_staging_cone_(bean_4j86)::a_cone_that_does_not_reach_it_leaves_the_stub
  Scenario: A staging cone that does not reach the instance leaves it stubbed
    Given the instance "smart-trust" and a staging cone that does not carry its docs
    When the changed files are "cat-harness/skills/x.md"
    Then it is not carried

  @test:scripts/tests/compose-docs.test.ts::carriedInstances_with_the_staging_cone_(bean_4j86)::the_prefix_match_stays_a_floor:_the_cone_can_only_add
  Scenario: The staging cone never removes what the prefix match carries
    Given the instance "smart-trust" and a staging cone that does not carry its docs
    When the changed files are "smart-trust/scripts/gen.ts"
    Then it is carried

  @test:scripts/tests/compose-docs.test.ts::--shell_--platform-only:_the_platform's_chrome,_not_the_checkout's_own::a_repository-scoped_layer's_assets_are_left_out,_and_said_to_be
  Scenario: A platform-only shell leaves out the repository-scoped layer and reports it
    Given a base with a config, "assets/base.css" and "index.md"
    And a repository-scoped overlay with "assets/ig-pages.css" and "artifact/X.html"
    When it is composed as a shell
    Then "assets/ig-pages.css" is supplied and nothing is left out
    When it is composed as a platform-only shell
    Then the layers are "docs" alone and "root-docs" is left out
    And only "_config.yml" and "assets/base.css" are supplied
    And "assets/ig-pages.css" is not written and nothing is added

  @test:scripts/tests/compose-docs.test.ts::--shell_--platform-only:_the_platform's_chrome,_not_the_checkout's_own::it_is_a_shell's_option:_asked_of_a_whole-site_compose,_it_is_refused
  Scenario: Platform-only without shell is refused
    Given a fixture with a base "index.md"
    When it is composed platform-only without the shell option
    Then it throws an error matching "needs --shell"

  @test:scripts/tests/compose-docs.test.ts::--shell:_the_chrome_only::isChrome_is_the_Jekyll_machinery_and_assets,_nothing_else
  Scenario: Chrome is the Jekyll machinery and assets only
    Given "_config.yml", "_includes/head_custom.html", "_data/harness.json" and "assets/js/docs-ui.js"
    Then each is chrome
    And "index.md", "glossary/index.md" and "smart-trust/index.md" are not chrome

  @test:scripts/tests/compose-docs.test.ts::--shell:_the_chrome_only::the_real_tree_composes_no_page,_no_instance,_and_EMPTY_generated_includes
  Scenario: A shell compose of the real tree holds only chrome, with empty generated includes
    Given the real repository
    When it is composed as a shell
    Then some files are supplied and every one is chrome
    And no instance has a carry decision
    And "_config.yml" is written
    And there are generated includes under "_includes/generated/", each empty

  @test:scripts/tests/compose-docs.test.ts::forwarding_pages_at_the_old_visualiser_addresses_(folio-assistant#2527)::a_page_under_the_locale_gets_a_forwarding_page_at_its_old_address;_a_data_file_gets_none
  Scenario: A moved page gets a forwarding page at its old address but a data file does not
    Given a layer declaring a "todos" visualiser with pages under the locale and a "data.json"
    When it is composed
    Then forwarding pages are written at "cat-harness/todos/index.html" and "cat-harness/todos/item/index.html"
    And nothing is superseded
    And each forwarding page redirects to the matching address under the locale
    And no "data.json" is written at the old address
    And the page under the locale is unchanged

  @test:scripts/tests/compose-docs.test.ts::forwarding_pages_at_the_old_visualiser_addresses_(folio-assistant#2527)::a_page_still_at_the_old_address_stands,_and_its_forwarding_page_is_reported_as_not_written
  Scenario: A page still at its old address stands and its forwarding page is reported superseded
    Given a "todos" page under the locale and an older page at "cat-harness/todos/index.md"
    When it is composed
    Then no forwarding page is written
    And "cat-harness/todos/index.html" is reported superseded
    And the old page keeps its content and no index.html is written beside it

  @test:scripts/tests/compose-docs.test.ts::forwarding_pages_at_the_old_visualiser_addresses_(folio-assistant#2527)::an_alias_redirects_to_the_page_under_the_locale,_never_to_the_forwarding_page
  Scenario: An alias redirects to the page under the locale
    Given a "todos" visualiser with alias "todos" and its page under the locale
    When it is composed
    Then the alias "todos/index.html" is written
    And it redirects to the page under the locale

  @test:scripts/tests/compose-docs.test.ts::forwarding_pages_at_the_old_visualiser_addresses_(folio-assistant#2527)::an_alias_of_a_page_not_yet_moved_still_redirects_to_where_the_page_is
  Scenario: An alias of a page not yet moved redirects to its current address
    Given a "todos" page only at "cat-harness/todos/index.md"
    When it is composed
    Then no forwarding page is written
    And the alias "todos/index.html" redirects to "../cat-harness/todos/"

  @test:scripts/tests/compose-docs.test.ts::forwarding_pages_at_the_old_visualiser_addresses_(folio-assistant#2527)::a_staging-only_visualiser_is_withheld_at_BOTH_addresses,_and_nothing_forwards_to_it
  Scenario: A staging-only visualiser is withheld at both addresses
    Given a staging-only "fsh" visualiser with a page under the locale
    Then the paths withheld from the canonical site are "cat-harness/fsh/" and its locale address
    When it is composed
    Then neither address exists in the output
    And no forwarding page is written

  @test:scripts/tests/compose-docs.test.ts::a_redirect_page_carries_the_?query_and_the_#fragment_(folio-assistant#2527)::the_script_appends_location.search_and_location.hash;_the_meta_refresh_is_the_fallback
  Scenario: A redirect page keeps the query and fragment, with meta refresh as fallback
    When a redirect stub to "../../en/cat-harness/library/" is built
    Then its script replaces the location with the target plus location.search and location.hash
    And the script comes before the meta refresh
    And it carries a canonical link to the target

  @test:scripts/tests/compose-docs.test.ts::a_redirect_page_carries_the_?query_and_the_#fragment_(folio-assistant#2527)::a_target_cannot_close_the_script_element_it_sits_in
  Scenario: A redirect target cannot close its script element
    When a redirect stub to "x</script><b>" is built
    Then it does not contain "x</script>"
    And it contains the escaped "</script>"

  @test:scripts/tests/compose-docs.test.ts::a_composed_instance's_docs_SOURCE_is_never_composed_(owner,_2026-10-23,_A1)::its_rendered_pages_are_composed_under_its_name;_the_blocks_they_were_rendered_from_are_not
  Scenario: A composed instance's rendered pages are composed but its docs source is not
    Given an instance "upper" whose composed docs hold "guides/x.md" and a declared "source" directory with a block
    When it is composed
    Then "upper/guides/x.md" is written
    And no "upper/source" is written or supplied

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::the_twin_is_laid_directly_over_its_base,_before_the_repository_overlay
  Scenario: The mounted base layer's output-root twin is laid directly over its base before the repository overlay
    Given a mounted cat-harness layer with a base page and a computed page at its output-root twin
    When docsLayers resolves the layers
    Then the order is "docs", "docs@output", "root-docs"

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::no_twin_layer_while_nothing_was_written_there:_the_composed_tree_is_unchanged
  Scenario: No twin layer is added while nothing was written at the output root
    Given a mounted cat-harness layer with no computed files at its output-root twin
    When docsLayers resolves the layers
    Then the layers are "docs" and "root-docs"

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::a_computed_page_shadows_the_pinned_copy_and_says_so;_the_overlay_still_wins_over_both
  Scenario: A computed page shadows the pinned copy and is reported while the repository overlay still wins over both
    Given a mounted base layer with pinned pages, computed pages at its output-root twin, and a repository overlay page
    When the docs tree is composed
    Then the computed page shadows the pinned copy and is recorded in overrides as overridden by "docs@output"
    And the repository overlay still wins over both the pinned copy and the computed twin

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::a_base_layer_absent_from_the_mount_but_present_at_the_output_root_is_carried,_not_missing
  Scenario: A base layer absent from the mount but present at the output root is carried and not missing
    Given a mounted layer whose base directory is absent from the mount but present at the output-root twin
    When docsLayers resolves the layers
    Then "docs@output" and "root-docs" are returned and missing is empty

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::a_chrome_layer's_output-root_twin_is_that_layer,_not_a_second_chrome_layer
  Scenario: A chrome layer's output-root twin is that layer, not a second chrome layer
    Given a checkout whose lock mounts cat-harness with a site-chrome layer and its output-root twin
    When chromeLayers lists the harness's chrome layers
    Then only "site-chrome" is listed, and "site-chrome@output" only once its base is absent

  @test:scripts/tests/compose-docs.test.ts::a_MOUNTED_base_layer's_computed_pages_at_the_output_root_(bean_cat-tools-sm8r,_item_4,_step_4)::a_checkout_that_does_not_mount_the_layer_has_no_twin,_even_with_files_at_that_path
  Scenario: A checkout that does not mount the layer has no output-root twin even with files at that path
    Given a checkout whose lock does not mount cat-harness even though files exist under build/layers/cat-harness/docs
    When docsLayers resolves the layers
    Then the layers are "docs" and "root-docs" without "docs@output"

