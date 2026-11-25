# scripts/build-instance-site.ts builds an instance's site from its checkout: the preview path, the Jekyll config, link checking, the chrome's writers and the library gate.
# Each Scenario names the test that executes it.
Feature: Building an instance site

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::a_preview_lands_under_one_branches/_segment,_whatever_the_branch_is_called
  Scenario: A preview lands under a single branches/ segment, whatever the branch is called
    Given the branch "claude/exciting-hawking"
    When its staging directory is derived
    Then it is "branches/claude-exciting-hawking"
    And "fix/a b" becomes "branches/fix-a-b"
    And the branch names ".." and "///" are refused

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::the_base_path_is_read_from_the_remote,_https_or_ssh
  Scenario: The owner and repository are read from an https or ssh remote
    Given the remote "https://github.com/litlfred/who-iris"
    When its owner and repository are read
    Then they are "litlfred" and "who-iris"
    And the ssh remote "git@github.com:litlfred/smart-ra.git" gives "litlfred" and "smart-ra"
    And a local proxy remote gives nothing

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::the_build_config_drops_the_remote_theme_it_cannot_fetch,_and_nothing_else
  Scenario: The build config drops only the remote theme it cannot fetch
    Given a config with a title, a remote_theme and the plugins jekyll-remote-theme and jekyll-feed
    When the build config is made from it
    Then the remote_theme line is gone
    And jekyll-remote-theme is replaced by jekyll-seo-tag while jekyll-feed stays
    And a defaults block with the theme's default layout is appended

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::a_page_with_no_layout_gets_the_theme's_default,_as_GitHub_Pages_gives_it;_the_config's_own_defaults_stay
  Scenario: A page with no layout gets the theme's default, and the config's own defaults stay
    Given a config that already has a defaults entry for the path "start"
    When the build config is made from it
    Then the default layout entry is inserted at the head of the existing defaults
    And the config's own "start" entry follows unchanged
    And there is exactly one defaults key

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::the_override_says_what_the_declaration_and_the_remote_say,_first_description_line_only
  Scenario: The override carries the declaration's title and description and the remote's base path
    Given a title containing quotes, a two-line description, the base "/who-iris" and a url
    When the override config is written
    Then the title is quoted with its inner quotes escaped
    And the description is "Line one" only, without "line two"
    And the baseurl is "/who-iris"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::the_override_turns_off_Sass_source_maps,_so_no_.css.map_is_published
  Scenario: The override turns off Sass source maps
    # Gap: that no .css.map is published is not checked
    Given a title, a base path and a url
    When the override config is written and parsed as YAML
    Then its sass setting is sourcemap "never"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::a_link_resolves_relative_to_its_page,_a_base-rooted_one_against_the_base,_an_outside_one_is_a_miss
  Scenario: A link resolves relative to its page or against the base, and one outside the base is a miss
    Given the base "/r/"
    When link targets are resolved
    Then "../a/b.html#x" on "docs/p/index.html" resolves to "docs/a/b.html"
    And "/r/catalogue/" resolves to "catalogue/"
    And "/concepts/x.html" is "outside-base"
    And an https link, a mailto link, a fragment-only link and a protocol-relative link resolve to nothing

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::urls_are_read_by_an_HTML_parser:_a_quote-concatenated_string_in_a_script_is_not_a_link
  Scenario: Page urls are read by an HTML parser, so a string in a script is not a link
    Given a page with an anchor, an image, a form and a script that concatenates an anchor tag in a string
    When its urls are read
    Then they are "a.html", "i.png" and "f/" only

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::--pre,_--source-step_and_--site-step_take_package_script_names,_never_commands
  Scenario: A step option takes a package script name, never a command
    Given the script names "check:catalogue", "site:catalogue" and "iris.pages-check_2"
    Then each is accepted as a script name
    And "bun run x", "a;rm -rf /", "$(id)", "a && b", "-x" and the empty string are each refused

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_the_agent-run_site_recipe_(bean_n3h9)::the_declaration_is_read_for_name,_title_and_description_only,_whatever_kinds_it_names_(bean_qump)
  Scenario: The declaration is read for name, title and description only, whatever kinds it names
    Given a declaration with a name, title, description and a directory naming an unregistered typology
    When its site fields are read
    Then they are exactly the name "x", title "X" and description "d"
    And text that is not JSON is refused as not valid JSON
    And a declaration with no name is refused as declaring no name

  @test:scripts/tests/ui/build-instance-site.test.ts::keepPinned_—_a_build_leaves_a_mounted_layer_as_the_lock_pins_it_(litlfred/dth-hrh,_2026-10-14)::puts_a_mounted_file's_pinned_bytes_back_after_it_is_rewritten
  Scenario: A mounted file's pinned bytes are put back after it is rewritten
    Given a file "pinned" inside the mounted cat-harness layer
    And its pinned bytes are kept
    When the build rewrites it and the keep is restored
    Then the file reads "pinned" again

  @test:scripts/tests/ui/build-instance-site.test.ts::keepPinned_—_a_build_leaves_a_mounted_layer_as_the_lock_pins_it_(litlfred/dth-hrh,_2026-10-14)::removes_a_mounted_file_the_build_created
  Scenario: A mounted file the build created is removed
    Given an absent file inside the mounted cat-harness layer
    And its pinned state is kept
    When the build creates it and the keep is restored
    Then the file no longer exists

  @test:scripts/tests/ui/build-instance-site.test.ts::keepPinned_—_a_build_leaves_a_mounted_layer_as_the_lock_pins_it_(litlfred/dth-hrh,_2026-10-14)::leaves_a_file_outside_every_mount_alone_(cat-harness_building_its_own_site_commits_it)
  Scenario: A file outside every mount is left alone
    Given a file "old" under cat-harness while only smart-base is mounted
    And its state is kept
    When the build writes "new" and the keep is restored
    Then the file still reads "new"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::a_step_runs_from_the_checkout's_own_package.json,_or_through_run-script.ts_where_it_has_none
  Scenario: A step runs from the checkout's own package.json, or through run-script.ts where it has none
    Given a checkout with no package.json
    Then the step "ig-site:compose" runs through run-script.ts
    And once the package.json declares the script "build:site", that step runs as "bun run build:site"
    And with a package.json naming none of the site's steps, "ig-site:compose" still runs through run-script.ts
    And a step "x; rm -rf /" is refused

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::a_chrome_writer_runs_through_the_checkout's_`cat`_runner,_or_run-script.ts_where_it_has_none_(dth-hrh)
  Scenario: A chrome writer runs through the checkout's cat runner, or run-script.ts where it has none
    Given a checkout whose package.json has no cat script
    When the writer "avatars:css" is given its command
    Then it is bun run through run-script.ts with "avatars:css"
    And once the package.json declares a cat script, the command is "bun run cat avatars:css"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::the_pages_a_step_lists_as_the_content's_own:_one_per_line,_comments_and_blanks_ignored
  Scenario: The pages a step lists as the content's own are read one per line, ignoring comments and blanks
    Given no list file
    Then the listed pages are empty
    And a list file with a comment, "a.html", a blank line and "sub/b.html" gives "a.html" and "sub/b.html"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::a_required_root_file_a_step_did_not_write_is_named,_so_the_site_is_not_published
  Scenario: A required root file a step did not write is named
    # Gap: that the site is then not published is not checked
    Given a built site holding only index.html
    When the required files "folio-build.json" and "index.html" are checked
    Then "folio-build.json" is named as missing
    And once folio-build.json is written, nothing is missing

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::only_graph_data_refuses:_a_missing_.json_or_.jsonld_is_graph_data,_a_page_or_stylesheet_is_not
  Scenario: Only graph data refuses a publish
    Then "folio-build.json", "index.jsonld", "layer/layer.jsonld" and "INDEX.JSONLD" are graph data
    And "index.html", "assets/css/avatars.css", "assets/js/x.js", "a.jsonl" and "json/index.html" are not

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::what_the_build_published_with_is_written_beside_the_link_report,_for_the_QA_page
  Scenario: The findings a build published with are written for the QA page
    Given a built site
    When one coverage finding is written
    Then "assets/site-qa/build.json" holds a "site-build-qa/v1" listing that finding

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::a_dead_link_on_a_content_page_is_reported_apart;_one_on_any_other_page_still_refuses
  Scenario: A dead link on a content page is reported apart from one on any other page
    # Gap: that a miss refuses the build is not checked
    Given a site whose index.html links "sub/b.html" and the absent "gone.html"
    And "sub/b.html" is a content page linking an absent StructureDefinition page
    When its links are checked under the base "/repo/"
    Then the misses are "index.html: gone.html" only
    And the content-page misses are "sub/b.html: ../StructureDefinition-x.html"

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::an_absolute_link_to_the_site's_own_address_is_checked_too_(fhir-harness#380)
  Scenario: An absolute link to the site's own address is checked too
    Given a site holding artifact/ActorDefinition-A.html
    And its own address for "LitlFred" and "demo" is "https://litlfred.github.io/demo/"
    And an index.html linking the own address at a missing root page, an existing page, the home and another site
    When its links are checked with the own address
    Then the self-address misses are the missing root ActorDefinition-A.html link only
    And there are no ordinary misses
    And without the own address no self-address misses are reported
    And a self link is resolved case-insensitively, decoded and stripped of its query, the bare home resolves to the empty path, and a lookalike prefix resolves to nothing
    And the written link report lists the self-address miss with its page and href and no unresolved links

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_a_checkout_that_only_mounts_layers_(an_IG_repository)::links_inside_a_diagram_resolve_against_the_.svg_file_and_are_reported_apart
  Scenario: Links inside a diagram resolve against the .svg file and are reported apart
    Given a site with artifact/CodeSystem-T.html and a diagram img/flow.svg
    And the diagram links one existing page, one missing page by xlink:href and one missing own-address page
    When its links are checked with the own address
    Then one diagram is counted
    And the diagram misses are the xlink:href link and the own-address link
    And there are no ordinary misses
    And the written link report lists two misses in diagrams

  @test:scripts/tests/ui/build-instance-site.test.ts::build-instance-site_—_whose_chrome_the_shell_carries_(smart-trust,_2026-10-14)::an_IG_repository's_shell_is_the_platform's_chrome_only;_a_folio's_carries_its_own_as_well
  Scenario: An IG repository's shell is the platform's chrome only, a folio's carries its own as well
    When the shell flags are chosen for an "ig-repo-site"
    Then they are "--shell --platform-only"
    And for a "folio" or no kind they are "--shell"

  @test:scripts/tests/ui/build-instance-site.test.ts::pinGeneratedData_—_the_build's_data_never_stays_in_a_mount_(litlfred/smart-hiv,_2026-10-14)::the_landing's_stickies.json_in_a_smart-base_mount_is_put_back,_and_one_the_build_created_is_removed
  Scenario: Generated data in a mounted landing is put back, and data the build created is removed
    Given a smart-base mount with a declaration and a pinned stickies.json
    And a bootstrap mount with no declaration
    When the generated data is pinned, the build rewrites stickies.json and creates harness.json, and the pin is restored
    Then stickies.json reads "pinned" again
    And harness.json no longer exists

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::an_entry_inside_a_chrome_layer_is_the_chrome's;_one_in_the_site_directory_is_not
  Scenario: An artefact inside a chrome layer is the chrome's, one in the site directory is not
    Given a CSS artefact under cat-harness/site-chrome and a data artefact under cat-harness/docs
    When the chrome's artefacts are picked with site-chrome as the chrome layer
    Then only the CSS artefact is picked

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::a_writer_that_built_its_artefact_passes,_and_runs_once_however_many_artefacts_name_it
  Scenario: A writer that built its artefacts passes, and runs once however many artefacts name it
    Given two chrome artefacts both written by "avatars:css"
    When the chrome is built with a writer that writes both files
    Then the writer is called once, for "avatars:css"
    And the result reports "avatars:css" as ran

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::a_stylesheet_writer_that_fails_is_a_QA_finding,_and_the_build_goes_on
  Scenario: A stylesheet writer that fails is a QA finding, not a refusal
    Given a chrome artefact written by "avatars:css"
    When the chrome is built and the writer fails with exit 1
    Then the build goes on with one "chrome" finding naming "avatars:css failed (exit 1)"

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::a_script_writer_that_ran_and_built_nothing_is_a_QA_finding,_and_the_build_goes_on
  Scenario: A script writer that ran but built nothing is a QA finding, not a refusal
    Given a chrome artefact "assets/js/never.js" whose file does not exist
    When the chrome is built and the writer reports it ran
    Then the build goes on with one finding naming never.js missing or empty

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::graph_data_still_refuses:_a_JSON(-LD)_writer_that_fails,_or_a_JSON(-LD)_that_came_out_missing
  Scenario: Graph data still refuses the build
    Given a chrome artefact "assets/graph/index.jsonld" written by "graph:jsonld"
    When the chrome is built and the writer fails
    Then the build is refused naming "graph:jsonld failed" and graph data
    And when the writer reports it ran but the file does not exist the build is refused as graph data missing or empty

  @test:scripts/tests/ui/build-instance-site.test.ts::the_chrome's_publish-time_writers_run_before_the_chrome_is_composed_(smart-ra_avatars.css)::a_writer_that_does_not_apply_to_this_root_(exit_78)_is_reported,_and_its_artefacts_excused
  Scenario: A writer that does not apply to this root is reported, and its artefacts excused
    Given a chrome artefact "assets/js/na.js" whose file does not exist
    When the chrome is built and the writer reports skipped with "no frobnicator here"
    Then the result records "na:js" as skipped with that reason
    And the build is not refused

  @test:scripts/tests/ui/build-instance-site.test.ts::gateSteps_—_every_site_build_runs_the_library_gate_folio-assistant's_publish_runs_(owner,_2026-10-16)::the_library_gate_runs_first,_before_the_recipe's_own_pre_steps
  Scenario: The library gate runs first, before the recipe's own pre steps
    When the gate steps are made for the pre step "check:archimate"
    Then they are the library gate followed by "check:archimate"
    And for no pre steps they are "check:l1-complete" alone

  @test:scripts/tests/ui/build-instance-site.test.ts::gateSteps_—_every_site_build_runs_the_library_gate_folio-assistant's_publish_runs_(owner,_2026-10-16)::a_recipe_that_already_names_it_does_not_run_it_twice
  Scenario: A recipe that already names the library gate does not run it twice
    When the gate steps are made for "check:l1-complete" and "ig-site:ast"
    Then they are "check:l1-complete" and "ig-site:ast" unchanged

  @test:scripts/tests/ui/build-instance-site.test.ts::gateSteps_—_every_site_build_runs_the_library_gate_folio-assistant's_publish_runs_(owner,_2026-10-16)::it_is_a_script_name_a_step_may_carry
  Scenario: The library gate is a script name a step may carry
    Then the library gate's name is accepted as a script name

  @test:scripts/tests/ui/build-instance-site.test.ts::publishedRoot_—_shell-safe_quoting_of_git_archive_arguments_(bean_cat-tools-j4sh)::an_exclude_of_$(touch_...)_is_single-quoted_for_bash_and_does_not_execute
  Scenario: A git archive exclude holding command substitution is quoted and never executes
    Given a git repository on branch gh-pages holding a committed index.html
    When its published root is read with excludes "$(touch marker)" and a backtick touch of the marker
    Then the marker file is not created
    And a tree is returned whose index.html reads "<p>ok</p>"

  @test:scripts/tests/ui/build-instance-site.test.ts::every_site_build_writes_its_search_scopes_(who-iris_search,_owner_2026-11-13)::the_split_runs_on_the_built_site,_scoped_by_the_checkout_it_was_built_from
  Scenario: The search split runs on the built site, scoped by its checkout
    # Gap: source-text check only; the split is not run
    Given the source of buildInstanceSite
    Then it contains the call "splitSite(site, root)"

  @test:scripts/tests/ui/build-instance-site.test.ts::every_site_build_writes_its_search_scopes_(who-iris_search,_owner_2026-11-13)::after_the_last_step_that_writes_pages,_and_before_the_site_is_judged
  Scenario: The search split comes after the last page-writing step and before the site is judged
    # Gap: source-text order check only; nothing is run
    Given the source of buildInstanceSite
    Then "splitSite(site, root)" appears after the rail standalone pages, the final steps and the forwarding pages
    And it appears before the .nojekyll write, the coverage shortfall and the parity shortfall

  @test:scripts/tests/ui/build-instance-site.test.ts::every_site_writes_its_node-kind_pages_(who-iris_schemas_page,_owner_2026-11-13)::a_recipe_with_no_step_that_writes_them_gets_them_from_the_build
  Scenario: A recipe with no step that writes node-kind pages is not counted as writing them
    # Gap: only the predicate is checked; that the build then writes the pages is not run
    Given a folio whose only site step "site:catalogue" runs another script
    Then the recipe is not counted as writing node-kind pages
    And a folder with no package.json and no steps is not counted either

  @test:scripts/tests/ui/build-instance-site.test.ts::every_site_writes_its_node-kind_pages_(who-iris_schemas_page,_owner_2026-11-13)::a_recipe_whose_own_step_runs_the_writer_(a_folio's_site:node-kinds)_does_not_run_it_twice
  Scenario: A recipe whose own step runs the node-kind page writer is counted as writing them
    Given a folio whose "site:node-kinds" script runs the node-kind page writer
    Then a recipe naming "site:node-kinds" is counted as writing node-kind pages
    And the same folio with no steps is not

  @test:scripts/tests/ui/build-instance-site.test.ts::every_site_writes_its_node-kind_pages_(who-iris_schemas_page,_owner_2026-11-13)::it_runs_on_the_built_site_after_the_site_steps,_as_a_folio,_and_before_the_rail_and_the_link_check
  Scenario: The node-kind step comes after the site steps and before the rail and the link check
    # Gap: a source-text order check of buildInstanceSite; no site is built
    Given the source of buildInstanceSite in scripts/build-instance-site.ts
    Then it runs the node-kind page writer with "--root . --out" on the site
    And that comes after the recipe's site steps run
    And before "rail-standalone-pages.ts" and the link check
