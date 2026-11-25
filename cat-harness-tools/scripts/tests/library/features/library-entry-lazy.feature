# scripts/gen-library-viz.ts and scripts/lib/library-document.ts: an entry page asks for its own
# document and blocks at once, revalidates them rather than refetching them, and uses the page's
# edit-links runtime rather than a second copy inside viewer.js. Each Scenario names the test that executes it.
Feature: An entry page loads what it shows, once, and as early as it can

  @test:scripts/tests/library/library-entry-lazy.test.ts::an_entry_page_asks_for_its_own_document_without_waiting_for_the_index::the_entry's_blocks_and_document_are_requested_beside_index.json,_before_it_answers
  Scenario: The entry's blocks and document are requested beside the index
    Given viewer.js running on the entry page layer-a/doc-x/ whose index fetch never answers
    Then index.json, entries/doc-x.json and entries/doc-x.doc.json have each been requested once

  @test:scripts/tests/library/library-entry-lazy.test.ts::an_entry_page_asks_for_its_own_document_without_waiting_for_the_index::they_are_revalidated,_not_refetched:_no-cache,_never_no-store
  Scenario: The entry's files are revalidated, not refetched
    Given viewer.js running on an entry page
    Then both entry files are requested with cache "no-cache"
    And viewer.js asks for "no-store" nowhere

  @test:scripts/tests/library/library-entry-lazy.test.ts::an_entry_page_asks_for_its_own_document_without_waiting_for_the_index::a_library_page,_or_an_entry_of_another_library,_starts_nothing_early
  Scenario: A library page or another library's entry starts nothing early
    Given viewer.js on the library page layer-a/, and on layer-b/doc-x/ scoped to layer-a
    Then only index.json is requested

  @test:scripts/tests/library/library-entry-lazy.test.ts::the_edit-links_runtime_is_the_page's,_not_a_second_copy_in_viewer.js::viewer.js_does_not_inline_the_runtime
  Scenario: viewer.js carries no copy of the edit-links runtime
    Given the runtime's own guard line
    Then viewer.js does not contain it

  @test:scripts/tests/library/library-entry-lazy.test.ts::the_edit-links_runtime_is_the_page's,_not_a_second_copy_in_viewer.js::a_document_drawn_before_the_deferred_runtime_runs_is_filled_once_it_has
  Scenario: A document drawn before the deferred runtime is filled once it runs
    Given a page still loading and no runtime
    When the document asks for the runtime, and the deferred script then defines it before DOMContentLoaded
    Then the document's callback runs with that runtime

  @test:scripts/tests/library/library-entry-lazy.test.ts::the_edit-links_runtime_is_the_page's,_not_a_second_copy_in_viewer.js::on_a_host_whose_head_has_no_runtime,_it_is_loaded_from_the_site_root
  Scenario: On a host with no runtime, it is loaded from the site root
    Given a loaded page with no runtime
    When the document asks for it
    Then assets/js/edit-links.js is added under the site root, and the callback runs once it loads
