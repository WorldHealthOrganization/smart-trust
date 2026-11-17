# scripts/gen-review-page.ts writes the review page of a preview build: a self-contained page whose script
# fetches the ChangeSet, comments and rendered impact from the site root it finds on its own path.
# Most Scenarios here read the generated page's text; each Scenario names the test that executes it.
Feature: The review page

  @test:scripts/tests/gen-review-page.test.ts::review_page::reads_its_data_when_opened,_from_the_preview's_own_files
  Scenario: The page fetches its data from the site root it finds on its own path
    # Gap: only the page's script text is checked; nothing is fetched
    Given the generated review page
    When its HTML is read
    Then the script sets "var ROOT = reviewSiteRoot(location.pathname, LOCALES);" with "var LOCALES = [\"en\"];"
    And no fetch goes to a fixed "../" path
    And it fetches "changeset.json" and "staging.json" from ROOT

  @test:scripts/tests/gen-review-page.test.ts::review_page::never_builds_markup_from_folio_content
  Scenario: The page never builds markup from folio content
    Given the generated review page
    When its HTML is read
    Then it never uses "innerHTML"
    And it uses "textContent"

  @test:scripts/tests/gen-review-page.test.ts::review_page::says_each_state_in_words:_no_ChangeSet,_and_no_change
  Scenario: The page says in words when there is no ChangeSet and when nothing changed
    Given the generated review page
    When its HTML is read
    Then it carries "No ChangeSet on this build"
    And it carries "No block changed."

  @test:scripts/tests/gen-review-page.test.ts::review_page::says_which_published_site_is_the_before_side,_main's_or_a_stacked_PR's_base_(5uuf)
  Scenario: The page names the published site it compares against
    # Gap: only the script text is checked; no stacked-PR base is rendered
    Given the generated review page
    When its HTML is read
    Then the script reads "st.beforeRef"
    And it labels the "Before side:" and the "view on" link with the before side's name
    And it never hard-codes "view on main"

  @test:scripts/tests/gen-review-page.test.ts::review_page::one_key_or_one_click:_j/k_and_their_visible_button_twins,_and_a_live_status
  Scenario: The keys j and k have visible button twins and a live status
    # Gap: only the page text is checked; no key press or click is run
    Given the generated review page
    When its HTML is read
    Then it has the buttons "next" and "prev"
    And the script handles the keys "j" and "k"
    And it has a region with "aria-live=\"polite\""

  @test:scripts/tests/gen-review-page.test.ts::review_page::change_kinds_are_words,_not_colours
  Scenario: Change kinds are written as words
    Given the generated review page
    When its HTML is read
    Then it carries the words "added", "removed", "reworded", "edited", "moved" and "renamed"

  @test:scripts/tests/gen-review-page.test.ts::review_page::reads_review_comments,_and_says_when_there_is_no_comment_data_rather_than_showing_none
  Scenario: The page fetches review comments and says when there is no comment data
    Given the generated review page
    When its HTML is read
    Then it fetches "review-comments.json" from ROOT
    And it carries "No comment data on this build."

  @test:scripts/tests/gen-review-page.test.ts::review_page::keeps_the_three_groups_that_would_otherwise_vanish,_and_the_tag_to_start_a_comment_with
  Scenario: The page keeps the unchanged, orphaned and unreadable comment groups and the block tag
    Given the generated review page
    When its HTML is read
    Then it carries "Comments on blocks this pull request did not change"
    And it carries "Orphaned: the block these were made on is gone"
    And it carries "Tags that could not be read or applied"
    And it offers a comment start tag of "block: " followed by the block label

  @test:scripts/tests/gen-review-page.test.ts::review_page::lists,_filters_and_resolves_comments,_and_shows_the_recorded_Decision_(423d)
  Scenario: The page lists, filters and resolves comments and shows the recorded Decision
    # Gap: only the page text is checked; no comment is filtered or resolved in the page
    Given the generated review page
    When its HTML is read
    Then it has a "comment-filter" select and embeds "var matchesCommentFilter = "
    And it offers "resolve: " with a comment id and "decision: " tags
    And the script reads "r.decision"

  @test:scripts/tests/gen-review-page.test.ts::review_page::embeds_the_tested_renderers_and_the_registry,_not_copies_of_them_(d903)
  Scenario: The page embeds the tested renderers and the view registry
    # Gap: only the page text is checked, not that the embedded code is identical to the tested modules
    Given the generated review page
    When its HTML is read
    Then it fetches "changeset-text.json" from ROOT
    And it embeds "var wordDiff = " and "var renderInline = "
    And it registers the views "word", "inline" and "side-by-side" with a "view" select

  @test:scripts/tests/gen-review-page.test.ts::review_page::the_viewer's_choice_is_stored_only_through_guarded_calls
  Scenario: The viewer's choice is stored only through guarded localStorage calls
    Given the generated review page
    When its HTML is read
    Then it calls localStorage exactly twice
    And the getItem call and the setItem call each sit inside a try

  @test:scripts/tests/gen-review-page.test.ts::review_page::loads_the_rendered_list_when_opened,_and_says_when_the_build_published_none_(bean_bnjs)
  Scenario: The page loads the rendered-impact list and says when the build published none
    Given the generated review page
    When its HTML is read
    Then it fetches "rendered-impact.json" from ROOT
    And it carries "Rendered pages this change alters"
    And it carries "is not known (which is not the same as none)"
    And it embeds "var renderedModel = "

  @test:scripts/tests/gen-review-page.test.ts::review_page::shows_the_build_diff_under_the_list,_and_says_when_there_is_none_(bean_ehh6)
  Scenario: The page shows the measured build diff and says when there is none
    Given the generated review page
    When its HTML is read
    Then it fetches "rendered-measured.json" from ROOT
    And it embeds "var measuredModel = " and "var renderMeasured = "
    And it carries "Not measured: this build published no rendered-measured.json"

  @test:scripts/tests/gen-review-page.test.ts::review_page::links_documents,_the_outline_and_the_list_of_documents_from_the_site_root_it_found_(#2527)
  Scenario: Documents, the outline and the document list are linked from the site root found
    Given the generated review page
    When its HTML is read
    Then the script builds document, outline and page links from ROOT, with "all documents" at ROOT "index.html"
    And before the script runs the "all-documents" link is "../../index.html"
    And a page generated with the prefix "../" links "all-documents" to "../index.html"
    And it defines "function docPage(doc)" and links "base + docPage(doc)"

  @test:scripts/tests/gen-review-page.test.ts::review_page::links_back_to_the_source_document_at_the_top_(owner,_2026-11-02)
  Scenario: The page links back to the source document right under its heading
    Given the generated review page
    When its HTML is read
    Then "source-docs" comes after the heading "What changed" and before "brief"
    And it starts with the link "the document" to "../../index.html"
    And the script links each outline document at ROOT plus its page

  @test:scripts/tests/gen-review-page.test.ts::review_page::names_every_chapter,_section_and_block_with_an_anchor_and_a_copy-link_button_(owner,_2026-11-02)
  Scenario: Chapters, sections and blocks get anchors and copy-link buttons
    # Gap: only the script text is checked; no list is built in a browser
    Given the generated review page
    When its HTML is read
    Then the script gives sections an id from their key path, chapters their chapter id and blocks their label
    And it adds anchor buttons for each section and each block
    And it calls "goToHash();"

  @test:scripts/tests/gen-review-page.test.ts::review_page::says_when_the_words_did_not_change,_instead_of_an_inline_diff_with_no_marks_(owner,_2026-11-02)
  Scenario: The page says when the words did not change
    Given the generated review page
    When its HTML is read
    Then it carries "No visible text change. "
    And it defines "function sameText(a, b)"
    And it carries the change aspects through as "aspects: c.aspects || []"

  @test:scripts/tests/gen-review-page.test.ts::reviewSiteRoot_—_the_site_root_from_the_review_page's_own_path_(#2527)::one_level_up_from_<root>/review/,_the_address_before_the_locale
  Scenario: A review page with no locale finds the site root one level up
    Given the published locales are "en"
    When the site root is found for "/preview/review/", "/smart-ra/STAGING/my-branch/review/index.html" and "/review/"
    Then each is "../"

  @test:scripts/tests/gen-review-page.test.ts::reviewSiteRoot_—_the_site_root_from_the_review_page's_own_path_(#2527)::two_levels_up_from_<root>/<locale>/review/
  Scenario: A review page under a locale finds the site root two levels up
    Given the published locales are "en"
    When the site root is found for "/preview/en/review/", "/smart-ra/STAGING/my-branch/en/review/index.html", "/en/review/" and "/tmp/site/en/review/index.html"
    Then each is "../../"

  @test:scripts/tests/gen-review-page.test.ts::reviewSiteRoot_—_the_site_root_from_the_review_page's_own_path_(#2527)::only_a_PUBLISHED_locale_counts:_another_segment_there_is_the_site's_own_path
  Scenario: Only a published locale counts as the locale segment
    Given the path "/preview/fr/review/"
    When the site root is found with only "en" published
    Then it is "../"
    And with "en" and "fr" published it is "../../"

  @test:scripts/tests/gen-review-page.test.ts::reviewSiteRoot_—_the_site_root_from_the_review_page's_own_path_(#2527)::runs_in_the_page_as_embedded:_no_TypeScript_survives_toString()
  Scenario: The site-root function still runs when embedded as source text
    Given the site-root function rebuilt from its own source text
    When it is called for "/x/en/review/" with "en" published
    Then it returns "../../"

  @test:scripts/tests/gen-review-page.test.ts::matchesCommentFilter_—_filtering_review_comments_on_the_page_(423d)::all_comments_pass_an_empty_filter;_open-addressed_keeps_active_ones
  Scenario: An empty filter passes every comment and open-addressed keeps active ones
    Given a resolved defect comment
    When it is filtered with an empty filter
    Then it passes
    And with the filter "open-addressed" an open and an addressed comment pass
    And a resolved comment does not

  @test:scripts/tests/gen-review-page.test.ts::matchesCommentFilter_—_filtering_review_comments_on_the_page_(423d)::filters_by_exact_status_or_kind,_and_runs_as_embedded_via_toString()
  Scenario: Comments filter by exact status or kind, with the filter rebuilt from its source text
    Given the comment filter rebuilt from its own source text
    When it is applied with "status:resolved"
    Then a resolved comment passes and an open one does not
    And with "kind:defect" a defect passes and a question does not
