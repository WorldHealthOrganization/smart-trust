# pipeline/translation-drift.ts checks whether a published translation's heading structure has drifted
# from its source page, ignoring front matter and comparing levels and ordinals, never the words.
# Each Scenario names the test that executes it.
Feature: Translation structure drift

  @test:pipeline/translation-drift.test.ts::front_matter_is_stripped_BEFORE_anything_is_counted::a_`#`_inside_front_matter_is_a_comment,_not_a_heading
  Scenario: A "#" comment inside front matter is not counted as a heading
    Given a page whose front matter holds three "#" comment lines and whose body holds two headings
    When its headings are read
    Then there are 2 headings
    And their levels are 1 and 2

  @test:pipeline/translation-drift.test.ts::front_matter_is_stripped_BEFORE_anything_is_counted::a_page_with_no_front_matter_is_read_whole
  Scenario: A page with no front matter is read whole
    Given a page "# Title" followed by "## One" with no front matter
    When its headings are read
    Then there are 2 headings

  @test:pipeline/translation-drift.test.ts::front_matter_is_stripped_BEFORE_anything_is_counted::unterminated_front_matter_does_not_swallow_the_page
  Scenario: Unterminated front matter does not swallow the page
    Given a page opening with "---" and no closing fence, followed by "# Title"
    When its headings are read
    Then there is 1 heading

  @test:pipeline/translation-drift.test.ts::front_matter_is_stripped_BEFORE_anything_is_counted::a_`#`_that_is_not_a_heading_is_not_counted
  Scenario: A "#" that is not a heading is not counted
    Given a line "#nothashheading" with no space after the hash and a line with a "#" mid-line
    When its headings are read
    Then there are no headings

  @test:pipeline/translation-drift.test.ts::structure_is_compared,_never_the_words::a_faithful_translation_matches_—_different_words,_same_shape
  Scenario: A faithful translation with different words and the same shape matches
    Given a source with a title, sections "1." and "2." and a level-3 detail
    And a French page with the same levels and numbering in other words
    When the two structures are compared
    Then they are the same structure

  @test:pipeline/translation-drift.test.ts::structure_is_compared,_never_the_words::a_MISSING_section_is_drift_—_the_landing-page_defect_this_found
  Scenario: A missing section is drift
    Given the same source
    And a translation lacking section "2."
    When the two structures are compared
    Then they are not the same structure

  @test:pipeline/translation-drift.test.ts::structure_is_compared,_never_the_words::a_RE-LEVELLED_section_is_drift_even_at_the_same_count
  Scenario: A re-levelled section is drift even at the same heading count
    Given the same source
    And a translation with the same number of headings where the level-3 detail is level 2
    When the two structures are compared
    Then they are not the same structure

  @test:pipeline/translation-drift.test.ts::structure_is_compared,_never_the_words::RE-ORDERED_numbering_is_drift
  Scenario: Re-ordered numbering is drift
    Given the same source
    And a translation with section "2." before section "1."
    When the two structures are compared
    Then they are not the same structure

  @test:pipeline/translation-drift.test.ts::structure_is_compared,_never_the_words::an_unnumbered_heading_does_not_match_a_numbered_one
  Scenario: An unnumbered heading does not match a numbered one
    Given the same source
    And a translation whose first section has no "1." ordinal
    When the two structures are compared
    Then they are not the same structure

  @test:pipeline/translation-drift.test.ts::the_backlogs_are_reviewable,_not_a_policy::a_headingless_source_is_UNREADABLE,_never_agreement
  Scenario: A headingless source is not comparable
    When the comparability of a source with no headings is checked
    Then it is not comparable
    And a source with one level-1 heading is comparable

  @test:pipeline/translation-drift.test.ts::the_backlogs_are_reviewable,_not_a_policy::a_backlog_entry_pins_the_SHAPE,_so_a_page_cannot_drift_further_in_silence
  Scenario: A backlog entry pins the full heading shape, not just counts
    Given the recorded KNOWN_DRIFT entries
    Then each entry has a non-empty source shape that differs from its translation shape
    And a five-heading page and the same page with its last heading re-levelled have equal heading counts
    And their shapes differ

  @test:pipeline/translation-drift.test.ts::the_backlogs_are_reviewable,_not_a_policy::every_recorded_drift_names_WHAT_is_missing,_and_when
  Scenario: Every recorded drift names what is missing, and when
    Given the recorded KNOWN_DRIFT entries
    Then each has a reason longer than 20 characters
    And a "since" date in YYYY-MM-DD form
    And a translation path of a locale followed by a page path

  @test:pipeline/translation-drift.test.ts::the_backlogs_are_reviewable,_not_a_policy::every_uncatalogued_entry_states_a_reason_and_a_date
  Scenario: Every uncatalogued entry states a reason and a date
    Given the uncatalogued entries for the real repository
    Then each has a reason longer than 20 characters
    And a "since" date in YYYY-MM-DD form

  @test:pipeline/translation-drift.test.ts::the_backlogs_are_reviewable,_not_a_policy::no_page_is_recorded_TWICE_—_once_would_be_enough_to_hide_it
  Scenario: No page is recorded twice across the backlogs
    Given the translations named by KNOWN_DRIFT and by the uncatalogued entries for the real repository
    Then no translation appears more than once

  @test:pipeline/translation-drift.test.ts::the_glossary_pages_are_recorded_at_their_DECLARED_routes::a_declared_glossary_visualiser_yields_one_entry_per_locale_at_its_route
  Scenario: A declared glossary visualiser yields one entry per locale at its route
    Given a checkout with a layer "acme" declaring a visualiser "terms" drawn by the glossary renderer
    When the uncatalogued glossaries are listed
    Then for each of ar, es, fr, ru and zh there is an entry at "<locale>/acme/terms" and "<locale>/en/acme/terms", in that order

  @test:pipeline/translation-drift.test.ts::the_glossary_pages_are_recorded_at_their_DECLARED_routes::a_checkout_declaring_no_glossary_visualiser_records_none
  Scenario: A checkout declaring no glossary visualiser records none
    Given a checkout with a layer "acme" declaring no visualisers
    When the uncatalogued glossaries are listed
    Then there are none

  @test:pipeline/translation-drift.test.ts::the_glossary_pages_are_recorded_at_their_DECLARED_routes::standing_alone,_a_glossary_page_the_site_holds_is_recorded_at_its_route
  Scenario: Standing alone, a glossary page the site holds is recorded at its route
    Given a checkout with no layer declarations and a site holding a generated glossary page "acme/terms" and a hand-written page "acme/notes"
    When the uncatalogued glossaries are listed against that site
    Then for each of ar, es, fr, ru and zh there is an entry at "<locale>/acme/terms" and "<locale>/en/acme/terms"
    And listed without the site there are none

  @test:pipeline/translation-drift.test.ts::the_glossary_pages_are_recorded_at_their_DECLARED_routes::the_written-down_backlog_holds_no_glossary_route
  Scenario: The written-down backlog holds no glossary route
    Given the written-down UNCATALOGED backlog
    Then no entry's translation ends in "/glossary"

  @test:pipeline/translation-drift.test.ts::the_real_corpus_—_and_the_gate_can_actually_fail::translations_were_COMPARED_—_zero_compared_is_never_agreement
  Scenario: The real corpus has translations compared
    When drift is measured over the real layer
    Then more than zero translations were compared

  @test:pipeline/translation-drift.test.ts::the_real_corpus_—_and_the_gate_can_actually_fail::no_NEW_drift,_and_nothing_unreadable
  Scenario: The real corpus has no new drift and nothing unreadable
    When drift is measured over the real layer
    Then there are no findings of any severity

  @test:pipeline/translation-drift.test.ts::the_real_corpus_—_and_the_gate_can_actually_fail::every_KNOWN_DRIFT_entry_still_describes_drift_that_EXISTS
  Scenario: Every KNOWN_DRIFT entry still describes drift that exists
    When drift is measured over the real layer with the known-drift backlog ignored
    Then every KNOWN_DRIFT translation is among the subjects of an error finding

  @test:pipeline/translation-drift.test.ts::the_real_corpus_—_and_the_gate_can_actually_fail::the_gate_is_not_vacuous_—_a_real_page,_with_a_section_cut,_is_drift
  Scenario: A real page with a section cut is drift
    Given the real English landing page and its French translation
    Then the English page is comparable
    And the French page has the same structure
    And when the "Quatre choses, dans l'ordre" heading is removed from the French page, the page changes
    And the cut page no longer has the same structure
