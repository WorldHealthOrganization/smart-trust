Feature: Answering the Form Builder's terminology requests from this site

  @test:scripts/terminology-map.test.ts::LOINC:_only_what_the_IG's_cache_holds::loincItemSearchCtss
  Scenario: the builder's item search, in the CTSS shape
    When the builder searches LOINC questions for "body we"
    Then the answer is the one cached code with its names in the CTSS shape

  @test:scripts/terminology-map.test.ts::LOINC:_only_what_the_IG's_cache_holds::loincByCodeOnly
  Scenario: by code, as the variable editor asks; other systems never appear
    Then searching LOINC by code "2000-2" finds "Heart rate"
    And searching for "female" finds only the not-in-cache answer

  @test:scripts/terminology-map.test.ts::LOINC:_only_what_the_IG's_cache_holds::notInCacheSaysSo
  Scenario: a code not in the cache says so, rather than an empty list
    Then searching for "glucose" answers with one empty code and the not-in-cache text
    And that text says to add it through the FSH source

  @test:scripts/terminology-map.test.ts::LOINC:_only_what_the_IG's_cache_holds::noIndexSameAnswer
  Scenario: no index at all is the same answer, not an error
    Then with no index the answer is the not-in-cache text

  @test:scripts/terminology-map.test.ts::UCUM:_the_full_list::ucumSearchPagingFields
  Scenario: the unit search, with paging and extra fields
    Then searching UCUM for "mm" finds "mm[Hg]" with its name and guidance
    And "gram" matches the start of a word, finding "g" with its extra name field
    And a page of 1 at offset 1 finds the second of 3 units

  @test:scripts/terminology-map.test.ts::LHC-Forms,_served_from_this_site::lhcVersionListing
  Scenario: the version listing names the vendored version, and its files map here
    Then the LHC-Forms version listing names the vendored version
    And a file of the vendored version maps to the local copy
    And a file of another version is 404

  @test:scripts/terminology-map.test.ts::everything_else_is_a_local_error,_never_the_network::localErrorNeverNetwork[%s]
  Scenario Outline: <url>
    Given a request to <url>
    Then the answer is a local JSON 503
    And its diagnostics mention <says> and that it is disabled on this site

    Examples:
      | url | says |
      | https://lforms-fhir.nlm.nih.gov/baseR4/Questionnaire/x | Import from and export to a FHIR server |
      | https://clinicaltables.nlm.nih.gov/loinc_form_definitions?loinc_num=1 | LOINC forms |
      | https://fonts.gstatic.com/s/roboto/x.woff2 | https://fonts.gstatic.com |
      | https://snomedbrowser.org/fhir/CodeSystem | https://snomedbrowser.org |

  @test:scripts/terminology-map.test.ts::everything_else_is_a_local_error,_never_the_network::ownRequestsUntouched
  Scenario: this site's own requests are not touched
    Then a request for this site's own terminology index is not answered

  @test:scripts/terminology-map.test.ts::everything_else_is_a_local_error,_never_the_network::swNeverForwardsCrossOrigin
  Scenario: terminology-sw.js never forwards an unanswered cross-origin request to fetch(e.request)
    Given the terminology service worker
    Then it never calls fetch(e.request) and answers with status 503
