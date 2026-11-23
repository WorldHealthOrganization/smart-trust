Feature: reading a WHO publication page

  @test:scripts/fetch-who-publication.test.ts::readItemPage::headerFields
  Scenario: heading, subtitle, date and type from the header
    When the item page is read
    Then its title, subtitle, date and type come from the header

  @test:scripts/fetch-who-publication.test.ts::readItemPage::overviewParagraphs
  Scenario: the Overview keeps <p> and <div> paragraphs, drops inline tags, stops at the related items
    When the overview is read
    Then it keeps the two paragraphs without inline tags and stops before the related items

  @test:scripts/fetch-who-publication.test.ts::readItemPage::detailsAndDownload
  Scenario: details and the one download
    When the details and downloads are read
    Then the details give pages and copyright
    And there is one download, facilityanalysisguide-immunization.pdf

  @test:scripts/fetch-who-publication.test.ts::readItemPage::refusesPageWithoutHeading
  Scenario: a page without the heading block is refused, not read loosely
    When a page without the heading block is read
    Then it throws

  @test:scripts/fetch-who-publication.test.ts::pageToRecord::onlyStatedInDublinCore
  Scenario: only what the page states, in Dublin Core
    When the page is turned into a record
    Then the issued date, extent, rights, URI and alternative title are the page's

  @test:scripts/fetch-who-publication.test.ts::pageToRecord::noPublisherInferred
  Scenario: no publisher is inferred from the copyright line
    When the record's publisher is read
    Then there is none

  @test:scripts/fetch-who-publication.test.ts::isoDate::isoDateOnlyDayMonthYear
  Scenario: d Month yyyy, and nothing else
    When dates are converted
    Then "1 December 2025" gives 2025-12-01
    And a month without a day, and a misspelt month, give nothing

  @test:scripts/fetch-who-publication.test.ts::fetchWhoPublication_destination_checks_(bean_folio-core-xpsq)::refusesBadDownloadLink
  Scenario: refuses a page download link that points to http:// or an unexpected host
    When the page's download link points to http or another host
    Then the fetch is refused

  @test:scripts/fetch-who-publication.test.ts::fetchWhoPublication_destination_checks_(bean_folio-core-xpsq)::refusesBadPdfRedirect
  Scenario: refuses a PDF download redirect to non-https or an unexpected host
    When the PDF download redirects to an http address
    Then the fetch is refused as not https
