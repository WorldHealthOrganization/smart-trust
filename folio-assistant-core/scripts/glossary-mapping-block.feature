Feature: the glossary pages' mapping table and per-term mapping state

  @test:scripts/glossary-mapping-block.test.ts::codeSpans_—_bean_`mylx`,_no_raw_backticks_on_a_rendered_page::backticksBecomeCodeSpans
  Scenario: backticks become code spans
    When "a `b` c" is converted
    Then it gives "a <code>b</code> c"

  @test:scripts/glossary-mapping-block.test.ts::codeSpans_—_bean_`mylx`,_no_raw_backticks_on_a_rendered_page::escapeBeforeCodeSpans
  Scenario: escaping happens FIRST, so a reason cannot smuggle markup in
    When text with a script tag and a code span is converted
    Then the script tag is escaped and the code span is made

  @test:scripts/glossary-mapping-block.test.ts::codeSpans_—_bean_`mylx`,_no_raw_backticks_on_a_rendered_page::unpairedBacktickLeft
  Scenario: an unpaired backtick is left alone rather than opening a tag
    When "a ` b" is converted
    Then it is unchanged

  @test:scripts/glossary-mapping-block.test.ts::the_committed_result,_read_the_way_the_page_reads_it::committedResultBothTargets
  Scenario: there is one, and it carries both targets
    When the committed mapping result is read
    Then it exists and covers the targets skos and fhir

  @test:scripts/glossary-mapping-block.test.ts::the_committed_result,_read_the_way_the_page_reads_it::rowsCarryThreeCounts
  Scenario: every row carries all three counts, and they sum to that scheme's candidates
    When each row is read
    Then its mapped, unmapped and undetermined counts are positive in sum and none negative

  @test:scripts/glossary-mapping-block.test.ts::the_committed_result,_read_the_way_the_page_reads_it::undeterminedStatesWhy
  Scenario: an undetermined row states WHY, and an unmapped one does not need to
    When each row with undetermined terms is read
    Then it carries a reason

  @test:scripts/glossary-mapping-block.test.ts::the_committed_result,_read_the_way_the_page_reads_it::targetsCoverSameSchemes
  Scenario: the two targets cover the same schemes — neither is quietly skipped
    When the schemes of each target are compared
    Then skos and fhir cover the same schemes

  @test:scripts/glossary-mapping-block.test.ts::the_committed_result,_read_the_way_the_page_reads_it::mappedRowNamesTerms
  Scenario: a mapped row names its terms, so the page can badge exactly those
    When each row is read
    Then it names as many mapped terms as it counts

  @test:scripts/glossary-mapping-block.test.ts::the_rendered_pages_say_it::glossaryPagesCarryTable
  Scenario: every glossary page carries the mapping table
    When the index, DMN and skills glossary pages are read
    Then each carries the mapping table, the undetermined column and its explanation

  @test:scripts/glossary-mapping-block.test.ts::the_rendered_pages_say_it::perTypeCountsScoped
  Scenario: a per-type page scopes its counts to its own terms
    When the DMN page's and the index's skos totals are read
    Then the DMN total is positive and smaller than the index's

  @test:scripts/glossary-mapping-block.test.ts::the_rendered_pages_say_it::noRawBacktickInTable
  Scenario: no raw backtick survives inside the mapping table
    When the index's mapping table is read
    Then it exists and holds no backtick

  @test:scripts/glossary-mapping-block.test.ts::the_third_state_at_the_PAGE_level_—_nobody_asked::noResultSaysNotChecked
  Scenario: no result at all says NOT CHECKED, and never renders as zero found
    When the block is made with no result
    Then it says Not checked and unknown, names the command, and has no table

  @test:scripts/glossary-mapping-block.test.ts::the_third_state_at_the_PAGE_level_—_nobody_asked::noPageSchemesRendersNothing
  Scenario: a result that covers none of this page's schemes renders nothing
    When the block is made from a result covering none of the page's schemes
    Then it is empty

  @test:scripts/glossary-mapping-block.test.ts::the_third_state_at_the_PAGE_level_—_nobody_asked::countsSummedPerTarget
  Scenario: counts are summed across the page's schemes, per target
    When the block is made from two schemes with 2 and 5 unmapped
    Then it shows 7

  @test:scripts/glossary-mapping-block.test.ts::the_third_state_at_the_PAGE_level_—_nobody_asked::reasonSurfacedForTarget
  Scenario: a reason on any scheme is surfaced for the target
    When the block is made from a row with a reason
    Then the reason is shown

  @test:scripts/glossary-mapping-block.test.ts::the_page_and_the_record_key_a_scheme_the_same_way_(bean_q3n9,_owner_ruling_A)::recordHasRows
  Scenario: the record has rows to compare
    When the committed record is read
    Then it has rows

  @test:scripts/glossary-mapping-block.test.ts::the_page_and_the_record_key_a_scheme_the_same_way_(bean_q3n9,_owner_ruling_A)::recordRowsOnPage
  Scenario: every row's (layer, scheme) is a scheme the page shows under that layer
    When each record row's layer and scheme are looked for on the page
    Then none is missing from the page

  @test:scripts/glossary-mapping-block.test.ts::the_page_and_the_record_key_a_scheme_the_same_way_(bean_q3n9,_owner_ruling_A)::pageSchemesHaveRows
  Scenario: every scheme on the page with a candidate term has a row under the page's owner
    When each page scheme with a candidate term is looked for in the record
    Then each has a row under the page's owner

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::allUnmappedOneDefault
  Scenario: all unmapped: one stated default, no marks
    When the per-term state is made from an all-unmapped row
    Then the note states unmapped on skos as the default, and no term is marked

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::allUndeterminedDefault
  Scenario: all undetermined: the default is undetermined, never unmapped
    When the per-term state is made from an all-undetermined fhir row
    Then the default is undetermined, never unmapped, and no term is marked

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::exactAndConceptMarkedApart
  Scenario: an exact match and a concept-only match are marked DIFFERENTLY, and name the concept
    When the per-term state is made from an exact and a concept-only match
    Then each is marked differently, naming its concept
    And the unmapped term is left to the default and the note counts two exceptions

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::mixedNamedUndetermined
  Scenario: a mixed row with its undetermined terms named: no default, every entry says its own
    When the per-term state is made from a mixed row naming its undetermined term
    Then there is no single default and every term is marked with its own state

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::mixedUnnamedIsUnknown
  Scenario: a mixed row that names NEITHER is `unknown`, never `unmapped` — the falsifier
    When the per-term state is made from a mixed row that names no term
    Then every term says its state cannot be told, never unmapped

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::sharedKeyBothUnknown
  Scenario: two entries sharing a key are both `unknown`, never both badged
    When two entries share a key
    Then both are marked as sharing the id

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::twoInstancesOwnRows
  Scenario: one scheme id and term id in two layers: each reads its own row, neither is unknown
    When the same scheme and term id appear in two layers with their own rows
    Then each reads its own row and neither is unknown

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::noResultNoNote
  Scenario: no committed result: no note and no marks — the table already says Not checked
    When the per-term state is made with no result
    Then there is no note and no mark

  @test:scripts/glossary-mapping-block.test.ts::per_term_—_bean_`5yhm`,_every_term's_state,_none_of_them_graded::typePagesCarryPerTermNote
  Scenario: the rendered type pages carry the per-term note
    When the DMN page and the schema-fields part pages are read
    Then each carries the per-term note
