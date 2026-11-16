# pipeline/derive-po.ts recovers .po catalogues from already-translated pages, refusing any
# page-locale pair it cannot align rather than guessing, and discovers the pairs from the site.
# Each Scenario names the test that executes it.
Feature: Deriving .po catalogues from translated pages

  @test:pipeline/derive-po.test.ts::a_faithful_translation_is_derivable::derives_one_catalogue_per_aligned_locale
  Scenario: A faithful translation derives one catalogue per aligned locale
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    When the page is derived for "fr"
    Then nothing is refused
    And one catalogue is derived
    And it holds as many entries as the source extracts

  @test:pipeline/derive-po.test.ts::a_faithful_translation_is_derivable::pairs_each_msgid_with_the_translation_at_the_SAME_position
  Scenario: Each msgid is paired with the translation at the same position
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    When the page is derived for "fr"
    Then the catalogue pairs "Heading one" with "Titre un"
    And it pairs "first item" with "premier élément"

  @test:pipeline/derive-po.test.ts::a_faithful_translation_is_derivable::marks_every_catalogue_UNOFFICIAL_in_its_header
  Scenario: Every derived catalogue is marked UNOFFICIAL in its header
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    When the page is derived for "fr"
    Then the catalogue contains "UNOFFICIAL"
    And it says "No human has adjudicated it"

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::a_SHORTER_translation_is_no_longer_refused_outright_—_it_aligns_as_a_grown_source
  Scenario: A shorter translation aligns as a grown source rather than being refused
    Given a fixture site whose source page has a heading, a paragraph and two list items
    And a French translation holding only the heading and the paragraph
    When the page is derived for "fr"
    Then nothing is refused
    And one catalogue is derived with 2 untranslated entries

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::...but_a_translation_whose_SHAPE_differs_is_still_refused,_with_both_counts_named
  Scenario: A shorter translation of a different shape is refused as a count difference
    # Gap: only the source count 4 is checked in the detail, not the translation's count
    Given a fixture site whose source page has a heading, a paragraph and two list items
    And a French translation holding a heading and a table row
    When the page is derived for "fr"
    Then nothing is derived
    And the refusal reason is "count-differs" with a detail naming 4

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::SAME_COUNT_but_a_divergent_kind_is_refused_—_the_case_that_nearly_shipped
  Scenario: The same count with a divergent kind is refused
    Given a fixture site whose source page has a heading, a paragraph and two list items
    And a French translation of the same count with a second-level heading where the paragraph should be
    When the page is derived for "fr"
    Then nothing is derived
    And the refusal reason is "kind-diverges" with a detail naming "paragraph" and "heading"

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::an_absent_translation_is_refused_as_missing,_not_as_divergent
  Scenario: An absent translation is refused as missing, not as divergent
    Given a fixture site whose source page has a heading, a paragraph and two list items and no translation
    When the page is derived for "fr"
    Then the refusal reason is "translation-missing"

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::an_absent_source_refuses_every_locale,_rather_than_reporting_none
  Scenario: An absent source refuses every locale
    Given a fixture site with a _config.yml but no source page
    When the page is derived for "fr" and "es"
    Then both are refused as "source-missing"
    And nothing is derived

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::a_tree_with_NO_site_is_refused_for_every_pair,_not_reported_as_nothing_to_do
  Scenario: A tree with no site is refused for every pair
    Given a directory with no site _config.yml
    When pages "a" and "b" are derived for "fr" and "es"
    Then nothing is derived
    And all 4 pairs are refused
    And the refusal detail says there is "no site root"

  @test:pipeline/derive-po.test.ts::it_REFUSES_rather_than_guesses::a_refusal_reaches_the_report,_and_says_it_is_a_finding_about_the_CORPUS
  Scenario: A refusal reaches the report as a finding about the corpus
    Given a fixture site whose source page has a heading, a paragraph and two list items and no translation
    When the derivation report is formatted
    Then it contains "REFUSED"
    And it says this is "not a tool limit"

  @test:pipeline/derive-po.test.ts::firstKindDivergence::returns_-1_when_the_sequences_agree
  Scenario: The first kind divergence is -1 when the sequences agree
    Given the extracted source and its faithful translation
    When their first kind divergence is found
    Then it is -1

  @test:pipeline/derive-po.test.ts::firstKindDivergence::returns_the_INDEX,_so_the_report_can_name_where
  Scenario: The first kind divergence is the index where the kinds differ
    Given the extracted source and a copy whose entry 1 is relabelled a heading
    When their first kind divergence is found
    Then it is 1

  @test:pipeline/derive-po.test.ts::the_catalogue_is_well-formed::a_repeated_msgid_is_emitted_once_—_gettext_permits_only_one
  Scenario: A repeated msgid is emitted once
    Given a source page with the heading "Same text here" twice and a translation repeating its heading the same way
    When the page is derived for "fr"
    Then the catalogue holds msgid "Same text here" exactly once

  @test:pipeline/derive-po.test.ts::the_catalogue_is_well-formed::quotes_and_backslashes_are_escaped
  Scenario: Quotes and backslashes are escaped in the catalogue
    Given a source page with a quoted heading and a backslash in its prose, and a French translation
    When the page is derived for "fr"
    Then the catalogue holds the escaped form of "quoted"
    And no msgid holds an unescaped quote

  @test:pipeline/derive-po.test.ts::the_catalogue_is_well-formed::names_the_locale_the_way_the_existing_catalogues_do
  Scenario: The locale is named the way the existing catalogues name it
    When the locale name of "ar" is read, it is "Arabic"
    And a catalogue formatted for "ar" carries "Language-Team: Arabic" and "Language: ar"

  @test:pipeline/derive-po.test.ts::write::writes_each_catalogue_to_translations/<locale>/<page>.po
  Scenario: Each catalogue is written to translations/<locale>/<page>.po
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    When the derivation is written
    Then one file is written under translations/fr/page.po
    And it contains "UNOFFICIAL"

  @test:pipeline/derive-po.test.ts::write::writes_nothing_when_everything_was_refused
  Scenario: Nothing is written when everything was refused
    Given a fixture site whose source page has a heading, a paragraph and two list items and no translation
    When the derivation is written
    Then nothing is written and nothing is skipped

  @test:pipeline/derive-po.test.ts::write::NEVER_replaces_an_existing_catalogue_—_it_skips_and_says_so
  Scenario: An existing catalogue is never replaced; it is skipped and reported
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    And its catalogue has been written once and then hand-edited
    When the derivation is written again
    Then nothing is written
    And the existing catalogue is reported as skipped
    And the hand edit survives

  @test:pipeline/derive-po.test.ts::write::replaces_one_only_when_the_caller_has_explicitly_decided_to
  Scenario: An existing catalogue is replaced only with an explicit overwrite
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    And its catalogue has been written once and then replaced with stale text
    When the derivation is written again with overwrite
    Then the catalogue is written and nothing is skipped
    And it again contains "UNOFFICIAL"

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::splits_25_pairs_into_derivable_and_refused,_and_every_pair_is_accounted_for
  Scenario: Every one of the 25 real page-locale pairs is either derived or refused
    Given this repository's real site, its five published pages and the locales ar, es, fr, ru and zh
    When they are derived
    Then derived plus refused is 25
    And at least one pair is derived

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::NO_pair_diverges_by_kind_any_more_—_both_that_did_were_threshold_artefacts
  Scenario: No real pair diverges by kind
    Given this repository's real site, its five published pages and the locales ar, es, fr, ru and zh
    When they are derived
    Then no pair is refused as "kind-diverges"

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::alignment_is_incomplete,_and_every_refusal_is_a_COUNT_difference
  Scenario: Real alignment derives some pairs and refuses only on count differences
    Given this repository's real site, its five published pages and the locales ar, es, fr, ru and zh
    When they are derived
    Then at least one pair is derived
    And every refusal is "count-differs"

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::the_same_table_cell_is_now_translatable_in_the_same_way_in_every_script_(`6b8u`)
  Scenario: The same table cell is translatable in the same way in every script
    Given an English table row of two code spans and words, and its Arabic translation
    When each is extracted
    Then each yields exactly one entry
    And both are table cells

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::a_letterless_string_is_never_offered_to_a_translator
  Scenario: A letterless string is never offered to a translator
    Given table rows whose first cell is ", ", " | ", "...", an em dash or Arabic punctuation
    When each row is extracted
    Then that letterless cell is never a msgid

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::an_INDENTED_code_fence_is_a_code_fence_(`ig4a`)
  Scenario: An indented code fence is treated as a code fence by the extractor
    Given a list item introducing an indented sh code fence running "bun run scripts/gen-schema-docs.ts", then a second prose item
    When it is extracted
    Then no msgid is a bare fence run
    And no msgid holds the command
    And the second item's prose is a msgid

  @test:pipeline/derive-po.test.ts::this_repository's_five_uncatalogued_pages::nothing_is_derived_for_a_pair_whose_counts_differ
  Scenario: Nothing is derived for a real pair that is refused
    Given this repository's real site, its five published pages and the locales ar, es, fr, ru and zh
    When they are derived
    Then no refused page-locale pair is also derived

  @test:pipeline/derive-po.test.ts::the_two_halves_of_the_round_trip_agree_about_where_the_code_is_(`ig4a`)::the_extractor_offers_nothing_from_inside_an_indented_fence
  Scenario: The extractor offers nothing from inside an indented fence
    Given a list item introducing an indented sh code fence running "bun run scripts/gen-schema-docs.ts", then a second prose item
    When it is extracted
    Then no msgid holds the command
    And "Real prose in the second item." is a msgid

  @test:pipeline/derive-po.test.ts::the_two_halves_of_the_round_trip_agree_about_where_the_code_is_(`ig4a`)::the_injector_leaves_an_indented_fence_alone_while_translating_the_prose_beside_it
  Scenario: The injector leaves an indented fence alone while translating the prose beside it
    Given a list item introducing an indented sh code fence running "bun run scripts/gen-schema-docs.ts", then a second prose item
    And a catalogue that maps the command to "CORRUPTED" and the prose to "Prose traduite."
    When the catalogue is injected
    Then the command is unchanged and "CORRUPTED" does not appear
    And the prose reads "Prose traduite."

  @test:pipeline/derive-po.test.ts::the_two_halves_of_the_round_trip_agree_about_where_the_code_is_(`ig4a`)::both_halves_read_ONE_definition_of_every_shared_construct_(`wlyg`)
  Scenario: The extractor and injector share one definition of every shared Markdown construct
    Given the source of po-inject.ts and pot-extract.ts and the ten shared Markdown regex names
    When the source text is inspected
    Then po-inject.ts redeclares none of them
    And po-inject.ts calls segmentMarkdown
    And pot-extract.ts's segmentMarkdown names every one of them
    And pot-extract.ts exports every one of them

  @test:pipeline/derive-po.test.ts::a_repeated_msgid_translated_two_ways_is_REFUSED,_not_deduped_(`f6r1`)::identical_translations_of_a_repeated_msgid_stay_benign
  Scenario: Identical translations of a repeated msgid stay benign
    Given a source repeating the heading "Same words here" and a translation repeating the same French heading
    When the page is derived for "fr"
    Then nothing is refused
    And the catalogue holds that msgid once

  @test:pipeline/derive-po.test.ts::a_repeated_msgid_translated_two_ways_is_REFUSED,_not_deduped_(`f6r1`)::DIFFERENT_translations_of_a_repeated_msgid_refuse_the_pair
  Scenario: Different translations of a repeated msgid refuse the pair
    Given a source repeating the heading "Same words here" and a translation rendering it two different ways
    When the page is derived for "fr"
    Then nothing is derived
    And the refusal reason is "msgid-conflict"
    And the detail names both French renderings and "msgctxt"

  @test:pipeline/derive-po.test.ts::a_repeated_msgid_translated_two_ways_is_REFUSED,_not_deduped_(`f6r1`)::no_catalogue_this_tool_has_written_carries_a_conflicting_duplicate
  Scenario: No real derived catalogue carries a duplicate msgid
    Given this repository's real site, its five published pages and the locales ar, es, fr, ru and zh
    When they are derived
    Then at least one catalogue is derived
    And no derived catalogue repeats a non-empty msgid
    And no pair is refused as "msgid-conflict"

  @test:pipeline/derive-po.test.ts::a_msgid_does_not_depend_on_where_the_author_pressed_return_(`lvk9`)::%s:_the_wrapped_and_unwrapped_forms_extract_the_same_messages
  Scenario: Wrapped and unwrapped forms of a construct extract the same messages
    Given the same content written unwrapped and wrapped, for each row: a list item over one line against two, a list item over two lines against three, a blockquote over one line against two, an emphasis span broken by the wrap, and a plain paragraph
    When both forms are extracted
    Then they yield the same kinds and msgids
    And at least one entry

  @test:pipeline/derive-po.test.ts::a_msgid_does_not_depend_on_where_the_author_pressed_return_(`lvk9`)::an_UNINDENTED_following_line_is_a_new_paragraph,_not_a_continuation
  Scenario: An unindented following line is a new paragraph, not a continuation
    Given a list item followed on the next line by an unindented sentence
    When it is extracted
    Then the kinds are "list-item" then "paragraph"

  @test:pipeline/derive-po.test.ts::a_msgid_does_not_depend_on_where_the_author_pressed_return_(`lvk9`)::a_bare_`>`_separates_two_quoted_paragraphs_rather_than_joining_them
  Scenario: A bare > separates two quoted paragraphs
    Given two quoted lines separated by a bare ">" line
    When it is extracted
    Then the msgids are the two quoted paragraphs, separately

  @test:pipeline/derive-po.test.ts::a_msgid_does_not_depend_on_where_the_author_pressed_return_(`lvk9`)::a_change_of_quote_depth_starts_a_new_entry
  Scenario: A change of quote depth starts a new entry
    Given a quoted line followed by a doubly quoted line
    When it is extracted
    Then there are two entries

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::pairs_around_an_inserted_construct_and_leaves_it_unmatched
  Scenario: A grown source aligns around an inserted construct and leaves it unmatched
    Given source kinds heading, paragraph, paragraph, list-item and translation kinds heading, paragraph, list-item
    When they are aligned as a grown source
    Then the alignment is m0, m1, unmatched, m2

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::REFUSES_when_the_translation_has_a_construct_the_source_does_not
  Scenario: A translation with a construct the source lacks is refused
    Given source kinds heading, paragraph and translation kinds heading, table-cell
    When they are aligned as a grown source
    Then there is no alignment

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::refuses_a_translation_LONGER_than_its_source
  Scenario: A translation longer than its source is refused
    Given a source of one heading and a translation of a heading and a paragraph
    When they are aligned as a grown source
    Then there is no alignment

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::an_identical_shape_aligns_positionally,_with_nothing_unmatched
  Scenario: An identical shape aligns positionally with nothing unmatched
    Given source and translation both of kinds heading, paragraph
    When they are aligned as a grown source
    Then no entry is unmatched

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::a_grown_source_leaves_the_added_construct_untranslated,_and_says_so
  Scenario: A grown source leaves the added construct untranslated and marks the catalogue incomplete
    Given the fixture source with one paragraph added after its faithful French translation
    When the page is derived for "fr"
    Then the catalogue has 1 untranslated entry
    And it carries the "INCOMPLETE" banner saying the entry was added to the source after the translation
    And it carries a "#, fuzzy" mark and an empty msgstr

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::a_complete_catalogue_does_NOT_claim_to_be_incomplete
  Scenario: A complete catalogue does not claim to be incomplete
    Given a fixture site whose source page has a heading, a paragraph and two list items and a faithful French translation
    When the page is derived for "fr"
    Then it has 0 untranslated entries
    And it carries neither "INCOMPLETE" nor "#, fuzzy"

  @test:pipeline/derive-po.test.ts::a_source_that_GREW_since_its_translation_is_still_alignable::over_the_REAL_corpus:_the_banner_appears_exactly_when_something_is_untranslated
  Scenario: Over the real corpus the incomplete banner appears exactly when something is untranslated
    Given this repository's real site and its installation page in the five locales
    When it is derived
    Then at least one catalogue is derived
    And each catalogue's untranslated count is at most its entries
    And it carries "INCOMPLETE" and "#, fuzzy" exactly when it has untranslated entries

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::finds_a_page_published_in_a_locale_that_has_a_source_beside_it
  Scenario: A page published in a locale with a source beside it is discovered
    Given a fixture site with source pages "alpha" and "beta" and a French translation of alpha declaring its source
    When the published pairs are discovered for en, fr and ru with en as source
    Then the pages are "alpha" only
    And the locales are "fr" only

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::finds_a_NESTED_page,_and_resolves_its_locale_sibling_beside_it
  Scenario: A nested page is discovered and its translation is resolved beside it
    Given a fixture site with source page guides/deep.md and its French translation at guides/fr/deep.md
    When the published pairs are discovered
    Then the pages are "guides/deep" and the locales "fr"
    And the translation path of "guides/deep" in fr is guides/fr/deep.md, not fr/guides/deep.md
    And a root-level page's translation path is fr/top.md
    And deriving reaches the nested translation, with no "translation-missing" refusal and one catalogue for "guides/deep"
    And the catalogue's reference names the site path guides/deep.md

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::a_translated_page_with_NO_source_beside_it_is_not_a_pair
  Scenario: A translated page with no source beside it is not a pair
    Given a fixture site with only a French "orphan.md" and no source
    When the published pairs are discovered
    Then no page is found

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::locales_come_from_the_DECLARATION,_so_a_lookalike_directory_is_not_one
  Scenario: Locales come from the declaration, so a lookalike directory is not one
    Given a fixture site with source "intent.md", a translation in "fsh-guts" declaring the unsupported locale "fsh", and a French translation
    When the published pairs are discovered for en and fr
    Then the locales are "fr" only
    And "fsh" is not among them

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::an_index_that_cannot_be_built_is_a_FINDING,_never_an_empty_set
  Scenario: An index that cannot be built is a finding, never an empty result
    Given a site directory with no _config.yml
    When the published pairs are discovered
    Then no page is found
    And there is at least one finding, saying the index is "unreadable"

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::this_repository's_real_pairs_are_found,_and_`fsh-guts`_is_not_among_them
  Scenario: This repository's real pairs are discovered without the fsh-guts lookalike
    Given this repository's real site
    When the published pairs are discovered for en, ar, es, fr, ru and zh
    Then the locales are ar, es, fr, ru and zh, without "fsh-guts"
    And there are no findings
    And more than 5 pages are found, including "concepts/architecture" and "guides/agent-onboarding"

  @test:pipeline/derive-po.test.ts::the_pages_to_catalogue_are_DISCOVERED,_not_listed_in_the_script::over_the_REAL_corpus:_every_composed_translation_path_exists_on_disk
  Scenario: Over the real corpus composed translation paths that exist lie under the site
    # Gap: a composed path that does not exist is skipped, not failed, so a missing translation path is not caught
    Given this repository's real site
    When a translation path is composed for every discovered page and locale
    Then each composed path that exists starts with the site directory
    And at least one exists, and the count of existing ones is a multiple of 5
