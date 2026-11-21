Feature: the passages where a glossary term is explained or used

  @test:scripts/term-passages.test.ts::term_passages_(folio-assistant-core#498)::proseTextKeepsLinkText
  Scenario: prose text drops headings, code, HTML and link targets, keeps link and directive text
    When prose text is taken from Markdown
    Then headings, code, HTML and link targets are dropped and link and directive text kept

  @test:scripts/term-passages.test.ts::term_passages_(folio-assistant-core#498)::multiWordAnyCase
  Scenario: a multi-word label matches in any case and across a line break; a plural counts
    When a multi-word label is looked for across a line break in plural
    Then it is found

  @test:scripts/term-passages.test.ts::term_passages_(folio-assistant-core#498)::acronymOwnCase
  Scenario: an acronym and a one-word label match only in their own case and as a whole word
    When a one-word label and an acronym are looked for
    Then each matches only in its own case and as a whole word, a plural counting

  @test:scripts/term-passages.test.ts::term_passages_(folio-assistant-core#498)::definingBlockFirst
  Scenario: a block that defines the term comes first; the glossary row itself is not a passage
    When passages are found for a term defined in one block and mentioned in another
    Then the defining block comes first, then the mention with its link
    And the glossary row is not a passage

  @test:scripts/term-passages.test.ts::term_passages_(folio-assistant-core#498)::mentionsCapped
  Scenario: mentions are capped per document; a term no block names has no entry
    When more blocks than the cap mention a term, and another term is named nowhere
    Then the mentions are capped
    And the unnamed term has no entry
