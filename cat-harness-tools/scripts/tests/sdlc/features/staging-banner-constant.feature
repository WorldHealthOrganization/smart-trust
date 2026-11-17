# scripts/staging-banner.ts injects one constant staging banner into every preview page
# and puts the per-build facts in staging.json, so rebuilds share page bytes.
# Each Scenario names the test that executes it.
Feature: Staging banner is constant across pages and rebuilds

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_build_type_is_a_fact_in_staging.json,_never_in_the_pages_(owner,_2026-11-01)::staging.json_names_it,_so_`pc:release_freeze`_can_refuse_a_preview
  Scenario: staging.json names the build type
    # Gap: pc:release freeze refusing a preview is not exercised
    Given a preview build and a full build of the same pages
    When each build's staging.json is read
    Then the preview's buildType is "preview"
    And the full build's buildType is "full"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_build_type_is_a_fact_in_staging.json,_never_in_the_pages_(owner,_2026-11-01)::the_pages_are_byte-identical_across_build_types
  Scenario: Pages are byte-identical across build types
    Given a preview build and a full build of the same pages
    When the emitted pages are compared
    Then every page is byte-identical between the two

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_injected_HTML_does_not_depend_on_the_build_—_bean_`g196`::two_builds_with_different_SHA,_timestamp_and_PR_emit_BYTE-IDENTICAL_pages
  Scenario: Two builds with different SHA, timestamp and PR emit byte-identical pages
    Given build A at sha "aaaaaaa" and build B at sha "bbbbbbb" with a later timestamp and PR "999"
    When the emitted pages are compared
    Then every page of B is byte-identical to the same page of A

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_injected_HTML_does_not_depend_on_the_build_—_bean_`g196`::...and_staging.json_DOES_differ,_so_the_facts_went_somewhere
  Scenario: staging.json does differ between the two builds, so the facts went somewhere
    Given build A at sha "aaaaaaa" and build B at sha "bbbbbbb"
    When their staging.json files are compared
    Then they differ
    And B's sha is "bbbbbbb" and A's sha is "aaaaaaa"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_injected_HTML_does_not_depend_on_the_build_—_bean_`g196`::the_CI_results_link_rides_in_staging.json,_never_in_the_page
  Scenario: The CI results link rides in staging.json, never in the page
    Given a build with checksUrl "https://github.com/o/r/pull/1/checks"
    When its staging.json and index.html are read
    Then staging.json carries that checksUrl
    And index.html does not contain "/pull/1/checks" and is identical to a build without it
    And the client source reads "f.checksUrl"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_injected_HTML_does_not_depend_on_the_build_—_bean_`g196`::every_page_in_one_build_carries_the_SAME_fragment,_at_any_depth
  Scenario: Every page in one build carries the same fragment at any depth
    Given a build of pages from the root down to reference/skills/deep/nested/page.html
    When each page is read
    Then each contains the same banner fragment

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_injected_HTML_does_not_depend_on_the_build_—_bean_`g196`::no_build_fact_appears_in_the_page_at_all
  Scenario: No build fact appears in the page at all
    Given build A's index.html
    Then it contains none of "aaaaaaa", "2026-09-20T10:00:00Z", "claude/example" or "o.github.io"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_client_is_served_once_per_preview,_not_inlined_in_every_page_(fhir-harness#325)::run()_writes_it_at_the_preview_root,_beside_staging.json
  Scenario: run() writes the client at the preview root, beside staging.json
    Given a build
    When the banner script file at the preview root is read
    Then it holds the client source followed by a newline

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_client_is_served_once_per_preview,_not_inlined_in_every_page_(fhir-harness#325)::the_page_carries_only_the_loader:_the_fragment_is_a_small_fraction_of_the_client
  Scenario: The page carries only the loader, a small fraction of the client
    Then the fragment contains the loader in a script tag
    And the fragment does not contain "function fill("
    And the fragment is shorter than 1500 characters
    And the client is more than four times as long as the fragment

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_client_is_served_once_per_preview,_not_inlined_in_every_page_(fhir-harness#325)::the_loader_names_the_client_from_the_preview_root,_and_states_a_failure_to_load_it
  Scenario: The loader names the client from the preview root and states a failure to load it
    # Gap: checked against the loader's source text, not by loading it in a browser
    Then the loader source appends the banner script name to the matched preview root
    And its onerror handler says "build details unavailable"
    And it says "not served from a preview path" off a preview path

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::a_failed_fetch_still_says_PREVIEW_—_the_third-state_rule::the_STATIC_markup_announces_the_branch_before_any_fetch_happens
  Scenario: The static markup announces the branch before any fetch happens
    Then the fragment contains "FEATURE BRANCH"
    And the part of the fragment before its first script tag contains "FEATURE BRANCH"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::a_failed_fetch_still_says_PREVIEW_—_the_third-state_rule::the_CATCH_path_specifically_degrades_to_a_stated_unavailability
  Scenario: A failed staging.json fetch degrades to a stated unavailability
    # Gap: checked against the client's source text, not by failing a fetch at runtime
    When the catch handler of the client's staging.json fetch is found
    Then it exists
    And its body says "build details unavailable"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::values_from_the_JSON_are_never_concatenated_into_markup::the_client_builds_nodes_and_sets_textContent
  Scenario: The client builds nodes and sets textContent rather than concatenating markup
    Then the client source contains "textContent"
    And it never assigns innerHTML

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_preview_root_is_derived_from_the_path,_not_baked_in::%s_->_%s
  Scenario: The preview root is derived from the page path
    When a pathname is mapped to its preview root
    Then the result is the expected root, for each row:
    # /folio-assistant/STAGING/my-branch/index.html -> /folio-assistant/STAGING/my-branch/
    # /folio-assistant/STAGING/my-branch/a/b/c.html -> /folio-assistant/STAGING/my-branch/
    # /STAGING/x/ -> /STAGING/x/
    # /folio-assistant/branches/my-branch/a/b/c.html -> /folio-assistant/branches/my-branch/
    # /branches/x/ -> /branches/x/

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_preview_root_is_derived_from_the_path,_not_baked_in::a_path_that_is_not_under_STAGING/_gives_null_rather_than_a_guess
  Scenario: A path not under STAGING/ gives null rather than a guess
    When the preview root of "/folio-assistant/index.html" is derived
    Then it is null

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_preview_root_is_derived_from_the_path,_not_baked_in::the_SHIPPED_regex_is_the_one_tested_here,_so_they_cannot_drift
  Scenario: The shipped path regex matches the tested one, so they cannot drift
    Given the location.pathname regex shipped in both the loader and the client
    When each is applied to STAGING, branches and non-preview paths
    Then each gives the same preview root as the tested function, or null

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::injection_mechanics_carried_over_from_the_bash_version::the_WHOLE_opening_tag_is_matched,_so_attributes_survive
  Scenario: The whole opening body tag is matched, so attributes survive
    When the banner is injected into a body with class "a" and id "b"
    Then the outcome is "injected"
    And the body tag keeps its attributes with no stray text after them
    And the fragment sits immediately after the opening body tag

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::injection_mechanics_carried_over_from_the_bash_version::a_second_pass_is_a_no-op_rather_than_a_doubled_banner
  Scenario: A second pass is a no-op rather than a doubled banner
    Given a page with the banner already injected
    When it is injected again
    Then the page is unchanged and the outcome is "already"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::injection_mechanics_carried_over_from_the_bash_version::a_page_that_only_NAMES_the_attribute_(the_review_page's_CSS)_still_gets_the_banner
  Scenario: A page that only names the banner attribute still gets the banner
    Given a page whose CSS and script mention "[data-fa-staging-banner]"
    When the banner is injected
    Then the outcome is "injected"
    And a second injection reports "already"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::a_commented_`<body>`_before_the_real_one_does_not_absorb_the_banner
  Scenario: A commented body tag before the real one does not absorb the banner
    Given a page whose head holds an HTML comment mentioning a body tag
    When the banner is injected
    Then the outcome is "injected"
    And the fragment lands after the comment, right after the real body tag

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::a_Liquid-commented_`<body>`_in_an_unrendered_include_does_not_absorb_the_banner
  Scenario: A Liquid-commented body tag does not absorb the banner
    Given a page whose head holds a Liquid comment block mentioning a body tag
    When the banner is injected
    Then the outcome is "injected"
    And the fragment lands after "endcomment -%}", right after the real body tag

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::THE_WITNESS_—_the_real_head_custom.html,_which_is_what_actually_broke
  Scenario: The real head_custom.html include does not absorb the banner
    Given cat-harness's own _includes/head_custom.html, which mentions a body tag
    And a page built with it in the head and a body with class "x"
    When the banner is injected
    Then the outcome is "injected"
    And the fragment sits right after the real body tag

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::a_document_with_NO_body_is_a_reported_state,_not_a_silent_success
  Scenario: A document with no body is a reported state, not a silent success
    When the banner is injected into a page with no body
    Then the outcome is "no-body"
    And the page has no banner attribute

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::a_`<body>`_that_appears_ONLY_inside_a_comment_is_no_body_at_all
  Scenario: A body tag that appears only inside a comment is no body at all
    When the banner is injected into a page whose only body tag is in a comment
    Then the outcome is "no-body"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::run()_reports_the_pages_it_could_not_place_a_banner_in
  Scenario: run() reports the pages it could not place a banner in
    Given good.html with a body and bad.html whose only body tag is in a comment
    When the banner is run over the directory
    Then 1 page is injected
    And noBody lists only "bad.html"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_banner_goes_in_the_BODY,_not_in_a_comment_that_mentions_one::a_bodiless_meta-refresh_stub_is_counted_as_a_redirect,_not_a_page_with_no_banner
  Scenario: A bodiless meta-refresh stub is counted as a redirect
    Given a meta-refresh stub page with no body and a bad.html with no body
    When the banner is run over the directory
    Then 1 redirect is counted
    And noBody lists only "bad.html"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::newPages_is_the_SHORT_list,_and_absent_is_not_empty::a_page_missing_from_the_publish_ref_lands_in_newPages;_one_present_does_not
  Scenario: New pages handed to run() land in staging.json
    # Gap: whether a page is missing from the publish ref is not computed here; the list is passed in
    Given a build run with newPages "guides/agent-onboarding.html"
    When its staging.json is read
    Then newPages is exactly "guides/agent-onboarding.html"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::newPages_is_the_SHORT_list,_and_absent_is_not_empty::mainPagesKnown_false_is_a_DIFFERENT_state_from_an_empty_newPages
  Scenario: mainPagesKnown false is checked before the newPages list
    # Gap: checked against the client's source text, not by rendering the banner
    Then the client source branches on "!f.mainPagesKnown"
    And the first mention of mainPagesKnown comes before "newPages.indexOf"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_STAGING_build_does_not_bake_a_per-run_stamp_into_the_footer::`%s`_is_not_written_on_a_staging_build_—_the_footer_renders_it_on_every_page
  Scenario: A per-run footer key is not written on a staging build
    Given the "Stamp the build" step of feature-staging.yml, comments stripped
    Then it does not contain the key, for each of "short_sha", "built_at" and "run_url"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_STAGING_build_does_not_bake_a_per-run_stamp_into_the_footer::the_keys_that_ARE_written_are_constant_for_a_preview
  Scenario: The keys the stamp step does write are constant for a preview
    Given the "Stamp the build" step of feature-staging.yml, comments stripped
    Then it contains "branch:", "staging_slug:" and "pr_number:"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_STAGING_build_does_not_bake_a_per-run_stamp_into_the_footer::the_client_fills_the_stamp_from_the_facts_it_already_fetched
  Scenario: The client fills the stamp from the facts it already fetched
    # Gap: checked against the client's source text, not by rendering the footer
    Then the client source contains "fa-build-stamp" and calls "stamp(f);"
    And it fetches staging.json exactly once
    And it makes exactly one HEAD fetch of index.html
    And it makes exactly 3 fetches in all

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_STAGING_build_does_not_bake_a_per-run_stamp_into_the_footer::the_MAIN_site_no_longer_bakes_it_either:_the_browser_fills_it_from_build.json
  Scenario: The main site no longer bakes the build stamp into pages
    # Gap: the browser filling the footer from build.json is not exercised
    Given docs-site.yml with comments stripped
    Then it does not echo "short_sha:", "built_at:" or "run_url:"
    And it mentions "build.json" and writes "runUrl: $runUrl"

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_THIRD_per-build_source:_TypeDoc's_source_links::the_shared_action_passes_--gitRevision_only_when_a_revision_is_given
  Scenario: The shared TypeDoc action passes --gitRevision only when a revision is given
    Given the typedoc-api action's typedoc.sh
    Then it sets the --gitRevision argument only when REV is non-empty
    And it passes those arguments on to TypeDoc

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_THIRD_per-build_source:_TypeDoc's_source_links::the_staging_build_pins_source_links_to_the_branch,_not_the_commit
  Scenario: The staging build pins source links to the branch, not the commit
    Given the typedoc-api step of feature-staging.yml
    Then its git-revision is the slug step's branch output

  @test:scripts/tests/sdlc/staging-banner-constant.test.ts::the_THIRD_per-build_source:_TypeDoc's_source_links::the_MAIN_site_does_not_—_a_published_link_should_freeze_its_commit
  Scenario: The main site build does not pin a git revision
    Given the typedoc-api step of docs-site.yml
    Then it has no "git-revision" input
