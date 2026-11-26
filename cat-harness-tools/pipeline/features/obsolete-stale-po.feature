# pipeline/obsolete-stale-po.ts marks the msgids a translation catalogue carries but its declared
# source page no longer has as obsolete, touching nothing else in the file.
# Each Scenario names the test that executes it.
Feature: Obsoleting stale translation entries

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::leaves_the_file_untouched_when_nothing_is_stale
  Scenario: A catalogue with nothing stale is left untouched
    Given an Arabic catalogue with a header and three entries
    When it is obsoleted against no stale msgids
    Then the output equals the input

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::moves_the_stale_entry_to_the_end,_`#~`-prefixed,_keeping_its_translation
  Scenario: A stale entry moves to the end, "#~"-prefixed, keeping its translation
    Given the catalogue and the stale msgid "a fragment the merge removed"
    When the stale entry is obsoleted
    Then the output contains "#~ msgid" for that msgid and "#~ msgstr" with its Arabic translation
    And the obsolete entry comes after the msgid "Still present"

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::EVERY_line_that_is_not_the_stale_entry_survives_byte-for-byte
  Scenario: Every line that is not the stale entry survives
    # Gap: each line is checked only to appear somewhere in the output, not at its byte position
    Given the catalogue and the stale msgid "a fragment the merge removed"
    When the stale entry is obsoleted
    Then every non-empty line other than the stale entry's msgid, msgstr and "#: guides/page.md:14" appears in the output
    And "Heading one" still comes before "Still present"
    And the references "#: guides/page.md:10" and "#: guides/page.md:20" remain

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::drops_the_obsoleted_entry's_`#:`_reference,_which_would_now_dangle
  Scenario: The obsoleted entry's "#:" reference is dropped
    Given the catalogue and the stale msgid "a fragment the merge removed"
    When the stale entry is obsoleted
    Then the output does not contain "#: guides/page.md:14", plain or "#~"-prefixed

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::preserves_a_multi-line_string_as_continuation_lines
  Scenario: A multi-line msgid keeps its continuation lines when obsoleted
    Given a catalogue whose msgid is split over "first half " and "second half"
    When its active msgids are read
    Then the msgid is "first half second half"
    And once obsoleted both quoted parts carry the "#~" marker, on the msgid line and on the "second half" continuation line

  @test:pipeline/obsolete-stale-po.test.ts::obsoleteEntries::is_idempotent_—_a_second_run_finds_nothing_to_do
  Scenario: Obsoleting is idempotent
    Given the catalogue with the stale entry already obsoleted once
    When its active msgids are read
    Then they do not include the obsoleted msgid
    And obsoleting again with the matching active msgids leaves the file unchanged

  @test:pipeline/obsolete-stale-po.test.ts::activeMsgids::excludes_an_entry_that_is_already_obsolete
  Scenario: An already obsolete entry is not an active msgid
    Given a catalogue with a live entry and a "#~" entry "dead"
    When its active msgids are read
    Then they are only "live"

  @test:pipeline/obsolete-stale-po.test.ts::activeMsgids::excludes_the_header's_empty_msgid
  Scenario: The header's empty msgid is not an active msgid
    Given the catalogue with a header
    When its active msgids are read
    Then they do not include the empty string

  @test:pipeline/obsolete-stale-po.test.ts::declaredSources::reads_the_`#:`_references_and_de-duplicates_them
  Scenario: Declared sources are read from "#:" references and de-duplicated
    Given the catalogue whose three references all point into guides/page.md
    When its declared sources are read
    Then they are only "guides/page.md"

  @test:pipeline/obsolete-stale-po.test.ts::declaredSources::returns_nothing_when_the_catalogue_declares_no_source
  Scenario: A catalogue with no references declares no source
    Given a catalogue with one entry and no "#:" reference
    When its declared sources are read
    Then there are none

  @test:pipeline/obsolete-stale-po.test.ts::resolveSource_—_the_declaration,_not_a_guess::resolves_a_reference_that_is_abbreviated_relative_to_the_page's_directory
  Scenario: A reference abbreviated relative to the page's directory resolves
    Given a site with the page guides/deep.md
    When the reference "deep.md" is resolved
    Then it resolves to a path ending in "guides/deep.md"

  @test:pipeline/obsolete-stale-po.test.ts::resolveSource_—_the_declaration,_not_a_guess::REFUSES_an_ambiguous_suffix_rather_than_picking_one
  Scenario: An ambiguous suffix is refused rather than picked
    Given a site with pages a/same.md and b/same.md
    When the reference "same.md" is resolved
    Then it is unresolved as "ambiguous"

  @test:pipeline/obsolete-stale-po.test.ts::resolveSource_—_the_declaration,_not_a_guess::reports_an_absent_source_rather_than_throwing
  Scenario: An absent source is reported rather than thrown
    Given a site with only the page x.md
    When the reference "nope.md" is resolved
    Then it is unresolved as "source-absent"

  @test:pipeline/obsolete-stale-po.test.ts::resolveSource_—_the_declaration,_not_a_guess::never_resolves_to_a_page_inside_a_locale_directory,_at_any_depth
  Scenario: A page inside a locale directory is never a source
    # Gap: only a locale directory one level under guides is tried, not every depth
    Given a site whose only page is guides/ar/only.md
    When the reference "only.md" is resolved
    Then it is unresolved as "source-absent"

  @test:pipeline/obsolete-stale-po.test.ts::survey_classifies_rather_than_counting_zero::marks_a_catalogue_sourced_from_something_other_than_markdown
  Scenario: A catalogue sourced from something other than markdown is marked as such
    Given a site page and a catalogue ar/ui.po referencing "scripts/ui-strings.ts:4"
    When the translations are surveyed
    Then there is one row whose source is "other-sourced"
    And that source counts as unresolved
    And the row has no stale msgids

  @test:pipeline/obsolete-stale-po.test.ts::survey_classifies_rather_than_counting_zero::marks_a_catalogue_that_declares_no_source_at_all
  Scenario: A catalogue that declares no source is marked undeclared
    Given a site page and a catalogue ar/bare.po with no "#:" reference
    When the translations are surveyed
    Then its source is "undeclared"

  @test:pipeline/obsolete-stale-po.test.ts::survey_classifies_rather_than_counting_zero::finds_the_stale_msgid_when_the_source_IS_resolvable,_and_only_that_one
  Scenario: A resolvable source yields exactly its stale msgid
    Given the page guides/p.md with heading "Heading one" and a catalogue ar/p.po with that msgid and "a fragment no longer present"
    When the translations are surveyed
    Then the row's source is the site directory's guides/p.md
    And its stale msgids are only "a fragment no longer present"
    And it has 1 live msgid
