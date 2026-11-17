Feature: A live form page for each Questionnaire in an IG

  @test:scripts/questionnaire-form.test.ts::questionnaireFormPages::pagePerQuestionnaire
  Scenario: a page, the rendered copy and the vendored files for each Questionnaire; nothing for other types
    Given an AST holding a Questionnaire and a Patient
    When the form pages are written with an edit base
    Then one page is listed for the Questionnaire, with its JSON copy and source
    And the page's config points the suggest builder and its worker at the vendored Form Builder
    And the rendered copy is the Questionnaire's JSON
    And the vendored form library, scripts, Form Builder, jQuery and terminology files are written
    And no page is written for the Patient and the platform's edit-links script is not written

  @test:scripts/questionnaire-form.test.ts::questionnaireFormPages::noQuestionnaireNothingWritten
  Scenario: no AST, or none with a Questionnaire: nothing written
    Then a missing AST writes no pages
    And an AST with no Questionnaire writes no pages and no assets

  @test:scripts/questionnaire-form.test.ts::questionnaireFormPages::sourceReadFromAstCacheCommit
  Scenario: the unexpanded Questionnaire is read from the AST cache commit when the site reads the AST by URL
    Given an AST holding a Questionnaire
    When the form pages are written without an AST commit
    Then the unexpanded copy is written into the site and the page reads it there
    When the form pages are written with the AST cache commit's raw base
    Then the page reads the manifest's file at that commit
    And no unexpanded copy is written into the site

  @test:scripts/questionnaire-form.test.ts::questionnaireFormPages::astFileUrlEncodesSegments
  Scenario: an AST file's URL encodes each path segment
    Then a file name with a space and a hash is encoded under the raw base

  @test:scripts/questionnaire-form.test.ts::answerValueSetExpandedInCopy
  Scenario: answerValueSet is expanded from the IG's expansions in the rendered copy only
    Given a Questionnaire with one item bound to an expanded value set and one bound to a value set with no expansion
    When its form page is written
    Then the first item is reported as expanded and the second as not expanded
    And the rendered copy carries the expanded answer options
    And the AST's own Questionnaire still names the value set
    And the terminology index holds the expanded code

  @test:scripts/questionnaire-form.test.ts::the_Form_Builder's_index.html,_as_this_site_serves_it::builderIndexLoadsNothingRemote
  Scenario: the vendored page loads jQuery and fonts from other origins; the served one loads nothing from anywhere else
    Then the vendored Form Builder page loads jQuery and fonts from other origins
    And the served page loads nothing from another origin and loads jQuery from this site

  @test:scripts/questionnaire-form.test.ts::the_Form_Builder's_index.html,_as_this_site_serves_it::workerGuardFirst
  Scenario: the worker guard runs first
    Then the service worker guard comes before the first script and names the terminology worker

  @test:scripts/questionnaire-form.test.ts::the_page::pageLinksAndLocalScripts
  Scenario: ✎, 📣 and ✍, the Smart Forms link-out, and nothing loaded from another origin
    Given a Questionnaire's form page
    Then it has edit, feedback and suggest links and a Smart Forms link-out
    And it is set to FHIR R5 and titles the form with the escaped Questionnaire title
    And every script it loads is from this site

  @test:scripts/questionnaire-form.test.ts::the_page::linksArtefactPage
  Scenario: links the Questionnaire's own page under artifact/, where every artefact page is
    Then it links the Questionnaire's own page under artifact/

  @test:scripts/questionnaire-form.test.ts::the_page::suggestConfigNamesMode
  Scenario: the suggest config names the Questionnaire mode
    Then its suggest config names the repository, branch, the Questionnaire profile module, FHIR R5, the source and the slug
    And it names no mode and no checker

  @test:scripts/questionnaire-form.test.ts::the_page::formHostNamesModeAndBlock
  Scenario: the form host names the mode and the block, for the runtime to match
    Then the form host names the source, the suggest text and the block

  @test:scripts/questionnaire-form.test.ts::the_page::modeEditsUnexpandedJson
  Scenario: the mode edits the unexpanded built JSON; the FSH stays the named source
    Then the form host's suggest text is the unexpanded source JSON, not the rendered copy

  @test:scripts/questionnaire-form.test.ts::the_page::noRepoNoLinks
  Scenario: without a repository there is no edit, feedback or suggest link
    Given a form page written with no repository
    Then it has no edit, feedback or suggest link

  @test:scripts/questionnaire-form.test.ts::lformsFhirVersionNames
  Scenario: FHIR versions as LHC-Forms names them
    Then FHIR 3.0.2, 4.0.1, 4.3.0 and 5.0.0 are STU3, R4, R4B and R5, and none is R4

  @test:scripts/questionnaire-form.test.ts::checkerBrowserModule
  Scenario: the checker ships as a browser module: types stripped, no Node import at load
    Given the checker module
    Then it has no type annotation and no Node import
    When it is loaded as a module
    Then a suggestion "{" has one error

  @test:scripts/questionnaire-form.test.ts::the_worker's_configuration::swUrlNamesTheBundleBesideTheBuilder
  Scenario: the service worker's URL names the form builder bundle beside the builder
    Given the service worker URL for index.json
    Then its bundle parameter is the versioned formbuilder bundle two folders up
    And the value is percent-encoded in the URL
