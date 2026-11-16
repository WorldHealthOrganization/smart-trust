Feature: reading a DSpace item into a Dublin Core record

  @test:scripts/fetch-dspace-item.test.ts::dspaceToRecord::qualifiedNamesSplit
  Scenario: qualified names split into element and qualifier
    When the item's metadata is read
    Then dc.identifier.isbn becomes element identifier, qualifier isbn, with two values

  @test:scripts/fetch-dspace-item.test.ts::dspaceToRecord::emptyLanguageAuthorityAbsent
  Scenario: an empty language or authority is absent, not empty
    When the ISBN and MeSH values are read
    Then the ISBN has no language key
    And the MeSH value keeps its authority D014611

  @test:scripts/fetch-dspace-item.test.ts::dspaceToRecord::blankOnlyFieldDropped
  Scenario: a field whose only value is blank is dropped, not kept empty
    When the record is read
    Then the field whose only value is blank is not there

  @test:scripts/fetch-dspace-item.test.ts::licenceFromRecord::recognisedRightsStated
  Scenario: a recognised dc.rights is stated, quoting the field
    When the licence is read from a record with dc.rights "CC BY-NC-SA 3.0 IGO"
    Then it is stated as CC-BY-NC-SA-3.0-IGO, quoting the field

  @test:scripts/fetch-dspace-item.test.ts::licenceFromRecord::nearMissNotMapped
  Scenario: a near-miss is NOT mapped: 3.0 without IGO is a different licence
    When the licence is read from dc.rights "CC BY-NC-SA 3.0"
    Then it is unknown, saying it is not a licence it recognises

  @test:scripts/fetch-dspace-item.test.ts::licenceFromRecord::noRightsUnknown
  Scenario: no dc.rights is unknown, saying where it looked
    When the licence is read from a record with no dc.rights
    Then it says it looked in dc.rights

  @test:scripts/fetch-dspace-item.test.ts::fetchItem_destination_checks_(bean_folio-core-xpsq)::refusesBadHandleUrl
  Scenario: refuses non-https handle URLs and unexpected hosts before any network call
    When an http handle URL and one on another host are fetched
    Then both are refused before any network call

  @test:scripts/fetch-dspace-item.test.ts::fetchItem_destination_checks_(bean_folio-core-xpsq)::refusesForeignBitstreamHref
  Scenario: refuses server-supplied bitstreams.href or content.href pointing to another host or http://
    When the server's bitstream links point to another host or to http
    Then the fetch is refused

  @test:scripts/fetch-dspace-item.test.ts::fetchItem_destination_checks_(bean_folio-core-xpsq)::refusesForeignRedirect
  Scenario: refuses a bitstream download that redirects to an unexpected host or http://
    When a bitstream download redirects to an unexpected host
    Then the fetch is refused
