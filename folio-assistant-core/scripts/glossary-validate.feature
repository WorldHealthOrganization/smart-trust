Feature: validating a glossary's links

  @test:scripts/glossary-validate.test.ts::glossary-validate::resolvedSchemePasses
  Scenario: a scheme whose links all resolve passes
    When a scheme whose links all resolve is validated with capitalisation
    Then there are no errors and the mounted layer is noted

  @test:scripts/glossary-validate.test.ts::glossary-validate::unknownMountedIriFails
  Scenario: a mounted layer's IRI that names no term fails
    When an exactMatch names a missing term of a mounted layer
    Then one error says it is not a term there

  @test:scripts/glossary-validate.test.ts::glossary-validate::unparsedSchemeReported
  Scenario: a scheme that does not parse is reported, not thrown
    When a scheme with a related link to an unknown term is validated
    Then one error names it, without throwing

  @test:scripts/glossary-validate.test.ts::glossary-validate::capitalizedRefusesLowercase
  Scenario: --capitalized refuses a lower-case prefLabel; without it, it passes
    When a lower-case prefLabel is validated with and without --capitalized
    Then with it, it is refused; without it, it passes

  @test:scripts/glossary-validate.test.ts::glossary-validate::capitalizedAcceptsOwnerSpelling
  Scenario: --capitalized accepts a name its owner spells with a lower-case first letter, such as iHRIS
    When iHRIS and mHealth are validated with --capitalized
    Then there are no errors

  @test:scripts/glossary-validate.test.ts::glossary-validate::blockGlossaryLinkChecked
  Scenario: a block's meta.glossary link is checked; ArchiMate links with no model mounted are noted, not failed
    When a block's glossary links and ArchiMate links are validated
    Then the missing glossary IRI is the one error
    And ArchiMate links with no model mounted are noted as not checked

  @test:scripts/glossary-validate.test.ts::glossary-validate:_the_overlay_rule_and_links_into_the_instance's_own_model::overlayPasses
  Scenario: an overlay of reference copies and owned items passes, and links into it are checked
    When an overlay of reference copies and owned items is validated
    Then there are no errors and the overlay is noted with its counts

  @test:scripts/glossary-validate.test.ts::glossary-validate:_the_overlay_rule_and_links_into_the_instance's_own_model::badOverlayItemsFail
  Scenario: an untagged item, an owned item the base already holds, and a copy the base lacks fail
    When an untagged item, an owned item the base holds, a copy the base lacks and a wrong owner are validated
    Then each fails with its own message

  @test:scripts/glossary-validate.test.ts::glossary-validate:_the_overlay_rule_and_links_into_the_instance's_own_model::slashIrisPassLikeTheOlderForm
  Scenario: slash IRIs pass like the older .jsonld form
    Given an overlay tagging its reference copies with slash IRIs (…/element/<id>) and with the older …/elements/<id>.jsonld form
    And glossary links into the own model and the base by slash IRI
    When the overlay is validated
    Then there are no errors and the overlay is noted with 1 owned and 3 reference copies checked
    And a slash IRI of a view is read with its model, kind and id
    And a slash IRI ending in .jsonld is not read as an ArchiMate IRI

  @test:scripts/glossary-validate.test.ts::glossary-validate:_the_overlay_rule_and_links_into_the_instance's_own_model::linkToMissingOwnItemFails
  Scenario: a block link into the own model that names no item fails
    When a block links into the own model naming no item
    Then one error says it is not in the model

  @test:scripts/glossary-validate.test.ts::metaOf_reads_a_block's_meta::metaOfReadsMeta
  Scenario: on one line or pretty-printed, and not from a string's braces
    When meta is read on one line, pretty-printed, absent, and with a brace in a string
    Then it is read correctly, or undefined when absent or unreadable
