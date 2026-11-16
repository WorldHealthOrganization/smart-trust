# The test helpers in scripts/tests/helpers.ts resolve CHAPTERS_DIR from the working directory at module load, so it points into an attached folio rather than the platform checkout.
# Each Scenario names the test that executes it.
Feature: CHAPTERS_DIR resolves against the folio

  @test:scripts/tests/chapters-dir.test.ts::CHAPTERS_DIR_resolves_against_the_folio::a_folio_is_detected_when_run_from_one
  Scenario: A folio is detected when the helpers load from inside one
    Given a minimal synthetic folio with a paper manifest, a chapters directory and a folio-assistant symlink
    When a probe script imports the helpers with the folio as its working directory
    Then hasFolio reports true

  @test:scripts/tests/chapters-dir.test.ts::CHAPTERS_DIR_resolves_against_the_folio::points_inside_the_folio,_not_the_platform
  Scenario: CHAPTERS_DIR points inside the folio, not the platform
    Given a minimal synthetic folio
    When the helpers are probed from the folio
    Then CHAPTERS_DIR is the folio's "chapters" directory
    And it does not lie under the platform checkout

  @test:scripts/tests/chapters-dir.test.ts::CHAPTERS_DIR_resolves_against_the_folio::findChapterFiles()_actually_finds_the_folio's_chapters
  Scenario: findChapterFiles finds the folio's chapters
    Given a synthetic folio whose chapters directory holds one "ch01.tex"
    When the helpers are probed from the folio
    Then findChapterFiles returns 1 file

  @test:scripts/tests/chapters-dir.test.ts::CHAPTERS_DIR_resolves_against_the_folio::falls_back_to_the_platform_when_no_folio_is_attached
  Scenario: With no folio attached the helpers fall back to the platform
    Given the platform checkout as working directory
    When the helpers are probed
    Then hasFolio reports false
    And CHAPTERS_DIR is the platform's "chapters" directory
    And findChapterFiles returns 0 files without throwing
