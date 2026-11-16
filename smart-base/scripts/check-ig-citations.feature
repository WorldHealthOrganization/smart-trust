Feature: The IG citation gate
  IG pages cite the KG bibliography page; dangling citations, page reference
  lists, hand-written references and unlisted links are flagged, and the gate
  applies only to an IG that has adopted a references directory.

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::passesCitationOfEntryPage
  Scenario: passes a citation of a bibliography entry's own page
    Given a page citing "voo2021" and "w3c-did-core" by links to their entry pages under the bibliography
    Then it has no findings

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::flagsDanglingEntryPage
  Scenario: flags a link to a bibliography page that is no entry
    Given a page linking the bibliography's "references/nope/" and "catalogue/voo2021/"
    Then it has two "dangling-citation" findings
    And the second says "bibliography/catalogue/voo2021/ is no entry of the KG bibliography"

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::flagsAnchorCitationWithItsPage
  Scenario: flags a "#ref-" anchor citation and names the entry page to link instead
    Given a page citing "#ref-voo2021" on the bibliography page and "#ref-nope" on the page itself
    Then it has two "anchor-citation" findings
    And the first says "#ref-voo2021 is an anchor; link the entry's own page, bibliography/references/voo2021/"
    And the second says there is no entry

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::flagsPageReferenceList
  Scenario: flags a page reference list
    Given a page with a "### References" heading and a generated references block
    Then its only finding is "page-reference-list"

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::flagsHandWrittenAndUnlistedReferences
  Scenario: flags hand-written entries and unlisted links in a references section, and stops at the next heading
    Given a "## References" section with a plain-text entry, a label line, a known DID Core link, an unknown example.org link and a DIIG link, then a "## Next" section with another unknown link
    Then the findings are exactly line 2 "hand-written-reference" and line 5 "unlisted-link"

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::referencesMdIsReferencesSection
  Scenario: treats a whole references.md as a references section, but not a 'Reference Implementations' heading
    Then an unknown link in input/pagecontent/references.md is an "unlisted-link"
    And a "## Reference Implementations" section on another page has no findings

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::matchesLinkByIsbnOrIrisHandle
  Scenario: matches a link by its ISBN or IRIS handle
    Then the IRIS handle link "10665/334306" is known
    And a WHO publication link with the unknown ISBN 9789241548960 is not

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::readsDeclaredReferencesDirectory
  Scenario: reads the own instance's references directory through its declaration
    Given an instance declaring a references directory holding entry "k1", and a page citing "k1" and "k2"
    When the instance is judged
    Then the bibliography directories are "references"
    And the only finding is "#ref-k2 is no entry of the KG bibliography"

  @test:smart-base/scripts/check-ig-citations.test.ts::check-ig-citations::readsLibraryEntriesAsBibliography
  Scenario: reads library entries, flat and filed in a group, by slug, source URL and the ISBN in the slug (bean djj5)
    Given an instance declaring a library with a flat entry "gdhcn-framework" with a source URL and an entry "9789240010567-eng" filed in the group "who"
    When its bibliography is read
    Then both slugs are keys
    And the entry's source URL and a WHO publication link with ISBN 9789240010567 are known
    And a page citing "#ref-gdhcn-framework" has no findings

  @test:smart-base/scripts/check-ig-citations.test.ts::ratchet::adoptedOnlyWithReferencesDirectory
  Scenario: an IG with no declared bibliography has not adopted the gate; one with a references directory has
    Given an empty IG directory
    Then it has not adopted the gate
    When it declares a references directory
    Then it has adopted the gate

  @test:smart-base/scripts/check-ig-citations.test.ts::ratchet::libraryOnlyIsNotAdopted
  Scenario: declaring only a library is not adopting the KG bibliography: a re-pin does not turn an untouched IG red
    Given an IG declaring only a library directory
    Then it has not adopted the gate
