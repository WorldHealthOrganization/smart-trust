# scripts/pdf-viewer.ts: the inline PDF viewer, an open shim run inside the vendored pdf.js
# viewer and an embed whose client frames that viewer lazily, plus its install helpers.
# Each Scenario names the test that executes it.
Feature: Inline PDF viewer

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::opens_an_allowlisted_CDN_document_and_clears_the_sample
  Scenario: The shim opens an allowlisted CDN document and clears the sample
    Given the open shim allowlisting "https://cdn.jsdelivr.net/gh/acme/"
    When it runs with a src of repo@main/x.pdf under that prefix
    Then pdf.js is asked to open exactly that address
    And the default sample URL is set to empty

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::opens_a_same-origin_document_without_an_allowlist_entry
  Scenario: The shim opens a same-origin document without an allowlist entry
    Given the open shim running at https://site.example
    When it runs with a src of "/docs/a.pdf"
    Then pdf.js is asked to open "https://site.example/docs/a.pdf"

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::refuses_any_other_origin,_on_screen,_and_opens_nothing
  Scenario: The shim refuses any other origin on screen and opens nothing
    Given the open shim allowlisting only the CDN prefix
    When it runs with a src of "https://evil.example/x.pdf"
    Then nothing is opened
    And the refusal shown on screen contains "Refused: https://evil.example/x.pdf"

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::a_prefix_is_a_prefix,_not_a_substring:_the_owner's_name_inside_a_path_is_not_the_owner
  Scenario: An allowlist prefix must match at the start, not as a substring
    Given the open shim allowlisting the CDN prefix
    When it runs with an evil.example address whose path contains the CDN prefix
    Then nothing is opened

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::listens_on_the_parent_document_too_—_where_pdf.js_dispatches_when_framed_same-origin
  Scenario: The shim also listens on a same-origin parent document
    Given the open shim framed by a same-origin parent
    When webviewerloaded fires on the parent document for a CDN src
    Then pdf.js is asked to open that address

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::a_document_that_fails_to_load_is_SAID_on_screen,_with_its_address,_not_left_as_an_empty_viewer
  Scenario: A document that fails to load is reported on screen with its address
    Given the open shim and a pdf.js open that fails with "Unexpected server response (403)"
    When it runs with a CDN src
    Then pdf.js was asked to open that address
    And the message shown contains "could not be loaded (Unexpected server response (403))"
    And the message shown contains the address

  @test:scripts/tests/ui/pdf-viewer.test.ts::openShim::no_?src=_opens_nothing_and_refuses_nothing
  Scenario: With no src the shim opens and refuses nothing
    Given the open shim
    When it runs with no src query parameter
    Then nothing is opened
    And nothing is refused

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed::carries_the_marker,_the_title_and_both_plain_links
  Scenario: The embed carries the marker, the escaped title and a download link
    # Gap: only the download link is checked, not a second plain link
    Given an embed of a CDN PDF titled "A <title>" on page 3
    Then it contains the viewer marker
    And its title attribute is "A &lt;title&gt; (PDF viewer)"
    And it links the PDF address with a download attribute

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed::at_%s_the_frame_opens_the_viewer_under_%s,_on_page_3
  Scenario: The embed frame opens the viewer under the site root derived from the page path
    Given an embed of a CDN PDF on page 3 routed by the who-iris path
    When its client runs at each page path and the frame scrolls into view
    Then the frame was empty before it came into view
    And the frame opens the viewer under the derived root with the encoded src, the viewer revision and #page=3
    And the rows are /who-iris/item-x.html under /, /folio-assistant/who-iris/item-x.html under /folio-assistant/, and /STAGING/my-branch/who-iris/item-x.html under /STAGING/my-branch/

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed::the_frame's_address_changes_with_each_deploy_of_the_page_around_it,_so_a_cache_cannot_serve_last_deploy's_viewer
  Scenario: The frame address changes with each deploy of the surrounding page
    Given the embed client run twice at the same path with lastModified 19:44:12 and 19:55:56
    Then the two frame addresses differ
    And each carries the viewer revision in the v query parameter
    And each still ends with #page=3

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed::the_viewer's_own_shim_is_fetched_under_its_revision
  Scenario: The viewer fetches its own shim under its revision
    Given a viewer.html head loading pdf.mjs
    When it is patched
    Then it loads folio-open.js with v set to the viewer revision
    And the viewer revision is 10 lowercase hex characters

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed::a_page_off_the_route_says_so_in_the_frame_instead_of_loading_a_404
  Scenario: A page off the route says so in the frame instead of loading a 404
    Given the embed client
    When it runs at "/elsewhere/x.html", outside the who-iris route
    Then the frame gets no src
    And the frame's srcdoc says it "could not find this site's root"

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed_inside_a_closed_<details>_(owner,_2026-10-16:_load_the_viewer_only_when_the_panel_opens)::closed:_nothing_is_fetched_until_the_panel_is_opened,_then_the_page-relative_viewer
  Scenario: Inside a closed details panel nothing is fetched until it opens
    Given an embed with a page-relative viewer route inside a closed details panel
    When its client runs
    Then the frame has no src and no in-view observer is set
    When the panel is opened
    Then the frame opens the page-relative viewer with the encoded src and the viewer revision

  @test:scripts/tests/ui/pdf-viewer.test.ts::embed_inside_a_closed_<details>_(owner,_2026-10-16:_load_the_viewer_only_when_the_panel_opens)::open:_the_in-view_observer,_as_before
  Scenario: Inside an open details panel the in-view observer is used
    Given an embed inside an open details panel
    When its client runs
    Then the in-view observer is observing

  @test:scripts/tests/ui/pdf-viewer.test.ts::install_helpers::the_shim_is_loaded_before_pdf.js's_own_modules
  Scenario: The shim is loaded before pdf.js's own modules
    Given a viewer.html head loading pdf.mjs
    When it is patched
    Then folio-open.js appears before pdf.mjs

  @test:scripts/tests/ui/pdf-viewer.test.ts::install_helpers::a_release_whose_viewer.html_moved_the_anchor_is_refused,_not_shipped_half-wired
  Scenario: A viewer.html without the expected anchor is refused
    Given a viewer.html head with no pdf.mjs script
    When it is patched
    Then patching throws an error mentioning "re-measure"

  @test:scripts/tests/ui/pdf-viewer.test.ts::install_helpers::only_the_installed_viewer_is_vendored
  Scenario: Only the installed viewer counts as vendored
    Then "assets/vendor/pdfjs/web/viewer.html" is the vendored viewer
    And "who-iris/item-x.html" is not
    And "assets/vendor/pdfjs-other/x.html" is not

  @test:scripts/tests/ui/pdf-viewer.test.ts::the_site's_page-wide_passes_leave_the_framed_viewer_alone::the_staging_banner_goes_on_our_page_and_not_inside_the_PDF_frame
  Scenario: The staging banner goes on site pages but not inside the PDF frame
    Given a site with who-iris/item.html and the vendored viewer page
    When the staging banner pass runs
    Then exactly one page is injected
    And who-iris/item.html carries the staging banner
    And the vendored viewer page does not
