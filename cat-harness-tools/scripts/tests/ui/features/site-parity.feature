# scripts/site-parity.ts measures a built site on its pages and names what a candidate root
# would lose against the current one; scripts/build-instance-site.ts reads an IG's site.build
# recipe and the published root. Each Scenario names the test that executes it.
Feature: Site parity guard for the root publish

  @test:scripts/tests/ui/site-parity.test.ts::siteFeatures_—_measured_on_the_pages::counts_each_feature,_lists_top-level_directories_without_the_kept_ones,_reads_the_stamp
  Scenario: A site's features are counted per page, its directories listed without the kept ones, and its stamp read
    Given a root with two themed pages, a railed openapi page, two served data directories, a folio-build.json stamp and a preview under branches/
    When its features are measured keeping "branches"
    Then it has 3 pages
    And siteNav and search are on 2 pages, navbarRow and rail on 3, translationMeta on 2
    And index.html carries siteNav, search, navbarRow, rail and translationMeta
    And the directories are artifact, ast-data, fhir-artifact-index and openapi, without branches
    And the stamp names instance "r"

  @test:scripts/tests/ui/site-parity.test.ts::siteFeatures_—_measured_on_the_pages::a_site_that_is_not_there_measures_as_empty
  Scenario: A site that does not exist measures as empty
    Given a path with no site
    When its features are measured
    Then it has 0 pages and no directories

  @test:scripts/tests/ui/site-parity.test.ts::parityShortfall_—_what_the_candidate_would_lose::the_IG_Publisher's_bare_preview_loses_every_feature,_three_directories_and_the_stamp
  Scenario: The IG Publisher's bare preview loses every feature, three directories and the stamp
    Given the current root's features
    And a bare candidate with a plain index.html and an openapi page
    When the parity shortfall is computed
    Then there are 7 shortfall lines
    And one says the side bar is on 2 of the current root's 3 pages and on none of the candidate's 2
    And one names artifact/, ast-data/ and fhir-artifact-index/
    And one names folio-build.json

  @test:scripts/tests/ui/site-parity.test.ts::parityShortfall_—_what_the_candidate_would_lose::a_railed_preview_keeps_the_icon_row_and_the_rail,_and_loses_the_theme's_side_bar,_search_and_the_language_picker
  Scenario: A railed preview loses only the theme's side bar, the search box and the language picker
    Given the current root's features
    And a railed candidate with every served directory and a stamp
    When the parity shortfall is computed
    Then the shortfall names, in order, the theme's side bar, the search box and the language picker's block

  @test:scripts/tests/ui/site-parity.test.ts::parityShortfall_—_what_the_candidate_would_lose::a_feature_on_some_pages_but_missing_from_the_candidate's_index.html_is_named_too
  Scenario: A feature absent from the candidate's index.html is named even when other pages carry it
    Given the current root's features
    And a candidate with the same counts whose index.html carries only navbarRow and rail
    When the parity shortfall is computed
    Then the side bar, the search box and the language picker's block are each named as on the current root's index.html, not on the candidate's

  @test:scripts/tests/ui/site-parity.test.ts::parityShortfall_—_what_the_candidate_would_lose::the_same_site_loses_nothing;_extra_pages_and_directories_are_not_a_shortfall
  Scenario: The same site loses nothing, and extra pages or directories are no shortfall
    Given the current root's features
    And a candidate that is the same root plus a themed qa/index.html
    When the parity shortfall is computed
    Then it is empty

  @test:scripts/tests/ui/site-parity.test.ts::the_recipe_an_IG_declares_(site.build)::keep,_profile_and_links_are_read_and_checked
  Scenario: An IG's site.build keep, profile and links are read and checked
    Given a checkout whose r.config.json declares site.build
    When the recipe is read with pre "site:ast", keep "branches", profile "ig-repo-site" and links "refuse"
    Then those values come back with empty source and site steps
    And links "report" and coverage "report", when declared, are carried, and are absent when not declared
    And extends "document-folio" is carried, and an extends that is not a preset name is refused naming extends
    And a keep of "../x" or "." is refused naming keep
    And a profile of "ig" is refused naming profile
    And links "ignore" is refused naming links

  @test:scripts/tests/ui/site-parity.test.ts::the_recipe_an_IG_declares_(site.build)::every_step_is_told_the_build's_own_values_in_its_environment
  Scenario: Every site step is given the build's own values as SITE_ environment variables
    Given a build with instance, title, base URL, URL, link root, work, source and site paths, repository, commit and ref
    When the step environment is made
    Then it holds SITE_REPOSITORY, SITE_COMMIT, SITE_REF, SITE_INSTANCE, SITE_TITLE, SITE_BASEURL, SITE_URL, SITE_LINK_ROOT, SITE_WORK, SITE_SOURCE and SITE_DIR with those values

  @test:scripts/tests/ui/site-parity.test.ts::publishedRoot_—_the_root_a_publish_would_replace,_read_without_cloning_into_the_checkout::the_branch's_root_is_laid_out_without_the_kept_entries;_an_absent_branch_is_undefined
  Scenario: The published root is read from the branch without its kept entries, and an absent branch is undefined
    Given a bare repository whose gh-pages branch holds the folio-site root
    When the published root is read excluding "branches" and "STAGING"
    Then its directories are artifact, ast-data, fhir-artifact-index and openapi
    And it has a stamp
    And reading a branch that does not exist gives undefined

  @test:scripts/tests/ui/site-parity.test.ts::publishedRoot_—_the_root_a_publish_would_replace,_read_without_cloning_into_the_checkout::an_exclude_is_a_pathspec,_never_shell_text:_`$(touch_…)`_runs_nothing_(bean_cat-tools-j4sh)
  Scenario: An exclude is passed as a pathspec and never run as shell text
    Given a bare repository whose gh-pages branch holds the folio-site root
    When the published root is read with an exclude written as a $( ) substitution, a backtick command or a quoted "; touch" injection
    Then each read gives a root
    And the marker file the injected touch would create does not exist

  @test:scripts/tests/ui/site-parity.test.ts::directories_dropped_by_the_owner's_ruling::the_glob_matches_top-level_directory_names_only
  Scenario: A dropped-directory glob matches top-level directory names only
    Given a ruling dropping "comparison-v*"
    Then "comparison-v1.0.0" and "comparison-v2" match
    And "comparison" and "openapi" do not
    And a ruling naming the nested path "a/b" does not match "x"

  @test:scripts/tests/ui/site-parity.test.ts::directories_dropped_by_the_owner's_ruling::a_dropped_directory_is_not_a_shortfall,_and_is_said_with_its_ruling
  Scenario: A directory dropped by ruling is reported with its ruling and is not a shortfall
    Given a current root with comparison-v1.0.0/ and a candidate without it and without openapi/
    When the drops and the shortfall are computed with the comparison-v* ruling
    Then comparison-v1.0.0 is reported as dropped, with its words and the ruling
    And the shortfall does not mention comparison-v1.0.0
    And the shortfall still names openapi/

  @test:scripts/tests/ui/site-parity.test.ts::directories_dropped_by_the_owner's_ruling::without_the_declaration_the_same_drop_is_a_shortfall
  Scenario: Without the ruling a dropped directory is a shortfall
    Given a current root with comparison-v1.0.0/ and a candidate without it
    When the shortfall is computed with no rulings
    Then it names comparison-v1.0.0/

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::the_dropped_feature_is_reported_with_its_ruling,_not_a_shortfall
  Scenario: A page feature dropped by ruling is reported with that ruling, not as a shortfall
    Given the current root and an IG-route candidate with the rail, its own search box and the language block but no theme side bar
    When the shortfall and the drops are computed with the side-nav ruling
    Then the shortfall is empty
    And siteNav is reported as dropped as "the theme's side bar (#site-nav)" with the ruling

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::without_the_ruling_the_guard_still_refuses_the_same_build
  Scenario: Without the side-nav ruling the IG-route build is refused for the side bar
    Given the current root and an IG-route candidate
    When the shortfall is computed with no rulings
    Then it names only the theme's side bar

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::search_stays_required:_the_side-bar_ruling_does_not_excuse_a_missing_search_box
  Scenario: The side-bar ruling does not excuse a missing search box
    Given an IG-route candidate without a search box
    When the shortfall is computed with the side-nav ruling
    Then it names only the search box

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::the_language_picker_is_required:_a_build_that_drops_fa-translation-meta_is_refused
  Scenario: A build that drops the language picker's block is refused
    Given an IG-route candidate without fa-translation-meta
    When the shortfall is computed with the side-nav ruling
    Then it names only the language picker's block

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::a_feature_entry_excuses_no_directory,_and_a_directory_entry_no_feature
  Scenario: A feature ruling excuses no directory, and a directory ruling no feature
    Given an IG-route candidate without openapi/
    When the shortfall is computed with the side-nav feature ruling
    Then it names openapi/
    And a feature ruling does not match the directory "openapi"
    And with a directory ruling for "site-nav" an IG-route candidate's shortfall still names #site-nav

  @test:scripts/tests/ui/site-parity.test.ts::page_features_dropped_by_the_owner's_ruling_(layout_"C",_2026-10-15)::an_entry_naming_both_a_directory_and_a_feature_excuses_neither
  Scenario: A ruling naming both a directory and a feature excuses neither
    Given an IG-route candidate without openapi/
    When the shortfall is computed with one ruling naming dir "openapi" and feature siteNav
    Then it names openapi/
    And it names #site-nav

  @test:scripts/tests/ui/site-parity.test.ts::the_theme_side_bar_the_rail_pass_replaces::its_loss_is_the_ruling's,_not_a_shortfall;_a_lost_search_box_or_rail_still_is
  Scenario: The rail pass's side-bar ruling excuses the lost theme side bar but not a lost search box
    # Gap: the loss of the rail itself is not checked
    Given a current root with one themed page
    And a railed candidate with a search box and the language block
    Then without rulings the shortfall has 1 line
    And with the theme side-bar ruling the shortfall is empty
    And a railed candidate without a search box still falls short only for the search box under that ruling

  @test:scripts/tests/ui/site-parity.test.ts::a_shortfall_is_a_QA_finding,_not_a_refusal_(owner,_2026-11-14)::an_index.html_without_the_icon_row_is_published_with_the_shortfall_reported
  Scenario: A root index.html without the icon row is published, the shortfall reported
    Given the current root's measures
    And a candidate whose index.html lacks the harness icon row
    When the parity report is made
    Then its outcome is "published-with-shortfall"
    And its only shortfall names the harness icon row on index.html

  @test:scripts/tests/ui/site-parity.test.ts::a_shortfall_is_a_QA_finding,_not_a_refusal_(owner,_2026-11-14)::the_guard_still_finds_the_missing_icon_row;_only_a_caller_that_asks_for_refuse_is_refused
  Scenario: The missing icon row is still found, and refused only when the caller asks
    Given the same candidate
    When the parity report is made with refuse
    Then its outcome is "refused"
    And a candidate that loses nothing is "carries-everything" even with refuse

  @test:scripts/tests/ui/site-parity.test.ts::a_shortfall_is_a_QA_finding,_not_a_refusal_(owner,_2026-11-14)::the_report_is_written_beside_the_link_report,_for_the_QA_page
  Scenario: The parity report is written for the QA page
    Given a built site
    When the parity report is written into it
    Then "assets/site-qa/parity.json" holds a "site-parity-report/v1" with the outcome and one shortfall

  @test:scripts/tests/ui/site-parity.test.ts::a_loss_is_named_against_the_last_clean_publish_until_it_is_fixed_(owner,_2026-11-14:_"last_clean")::a_publish_that_loses_the_icon_row_is_named,_and_the_clean_root_it_replaced_becomes_the_baseline
  Scenario: A publish that loses the icon row is named, and the clean root becomes the baseline
    Given a clean root carrying the icon row on index.html
    When a build without it is reported with no recorded baseline
    Then the icon row is the only shortfall
    And the report's baseline is the clean root

  @test:scripts/tests/ui/site-parity.test.ts::a_loss_is_named_against_the_last_clean_publish_until_it_is_fixed_(owner,_2026-11-14:_"last_clean")::the_next_publish,_still_without_it,_is_named_against_the_last_clean_publish,_not_read_as_clean
  Scenario: The next publishes without the icon row are still named against the last clean publish
    Given the report of the publish that lost the icon row
    When the next build, still without it, is compared with that root
    Then its outcome is "published-with-shortfall"
    And it names the icon row "against the last clean publish"
    And the publish after that names it the same way and keeps the same baseline

  @test:scripts/tests/ui/site-parity.test.ts::a_loss_is_named_against_the_last_clean_publish_until_it_is_fixed_(owner,_2026-11-14:_"last_clean")::once_fixed_it_reads_clean,_and_the_fixed_build_becomes_the_next_baseline,_named_by_its_commit
  Scenario: Once fixed the build is clean and becomes the next baseline
    Given the report of the publish that lost the icon row
    When a build that carries it again is reported as "ddd444"
    Then its outcome is "carries-everything" and its baseline is from "ddd444"
    And a later loss is named against the last clean publish "ddd444"

  @test:scripts/tests/ui/site-parity.test.ts::a_loss_is_named_against_the_last_clean_publish_until_it_is_fixed_(owner,_2026-11-14:_"last_clean")::a_loss_the_owner's_ruling_drops_is_not_named_against_the_baseline_either
  Scenario: A loss dropped by the owner's ruling is not named against the baseline
    Given the report of the publish that lost the icon row
    When the next build is compared with a ruling that drops the icon row
    Then no shortfall is named

  @test:scripts/tests/ui/site-parity.test.ts::a_loss_is_named_against_the_last_clean_publish_until_it_is_fixed_(owner,_2026-11-14:_"last_clean")::a_site's_own_report_is_read_back_with_its_baseline;_an_older_one_without_a_baseline,_or_none,_reads_as_having_none
  Scenario: A site's parity report is read back with its baseline
    Given a site with no parity report
    Then reading it gives nothing
    And a report written with a baseline reads back with it
    And an older report without one reads as having no baseline
    And a file that is not JSON reads as no report

