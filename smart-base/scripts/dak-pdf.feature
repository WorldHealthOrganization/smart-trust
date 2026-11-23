Feature: The DAK PDF renderer's assembly step
  A DAK's IG tree is assembled into sections and HTML for a PDF; what the
  rendering leaves out is declared in the assembly and in the document; and
  whether the tree is a DAK is read from its declared dependencies.

  Background:
    Given an IG tree titled "Test DAK" with an index page, a processes page, an empty page, a BPMN file and a workbook

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::titleFromSushiConfig
  Scenario: takes its title from sushi-config, not the directory name
    Then the assembly's title is "Test DAK"

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::titleFallsBackToDirectory
  Scenario: falls back to the directory when there is no config
    Given a tree with a page and no sushi-config.yaml
    Then the assembly's title is the directory's name

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::findsDeclaredBusinessProcesses
  Scenario: finds the business processes where the instance declares them
    Given a temporary instance whose declaration names "processes/" with the graph typology "business-processes"
    When its business-process directory is resolved and the document is assembled
    Then the directory is its "processes" folder and the "Business processes" section's source is "processes/"
    And for the repository root, which declares none, the directory is "input/business-processes" and the section's source is "input/business-processes/"

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::rendersMarkdownNarrative
  Scenario: renders markdown narrative to HTML
    Then the "index" section's HTML has "<h1>Overview</h1>" and "<em>narrative</em>"

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::skipsEmptyPage
  Scenario: skips an empty page rather than emitting a blank section
    Then no section is titled "empty"

  @test:smart-base/scripts/dak-pdf.test.ts::assembly::everySectionRecordsSource
  Scenario: every section records where it came from
    Then every section has a non-empty source

  @test:smart-base/scripts/dak-pdf.test.ts::omissions_are_declared,_never_silent::reportsUndrawnBpmn
  Scenario: BPMN present but not drawn is reported
    Then the omissions mention "BPMN" and "not drawn"

  @test:smart-base/scripts/dak-pdf.test.ts::omissions_are_declared,_never_silent::reportsWorkbookCount
  Scenario: workbooks are reported with a count
    Then the omissions say "1 workbook(s) not rendered"

  @test:smart-base/scripts/dak-pdf.test.ts::omissions_are_declared,_never_silent::reportsMissingNarrative
  Scenario: a DAK with no narrative says so rather than rendering nothing quietly
    Given an empty directory
    Then its omissions mention "no input/pagecontent/"

  @test:smart-base/scripts/dak-pdf.test.ts::omissions_are_declared,_never_silent::omissionsReachDocument
  Scenario: the omissions reach the DOCUMENT, not just the run log
    Then the HTML contains "Not included in this rendering" and "BPMN"

  @test:smart-base/scripts/dak-pdf.test.ts::html::htmlHasCoverTocAndAnchors
  Scenario: carries a cover, a contents list and one anchor per section
    Then the HTML has a "cover" class, a "toc" id, and an id "s<n>" for every section

  @test:smart-base/scripts/dak-pdf.test.ts::html::escapesTitles
  Scenario: escapes titles rather than trusting the tree
    Given a tree titled "<script>x</script>"
    Then its HTML contains "&lt;script&gt;" and not the raw script tag

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::baseDependencyMakesDak
  Scenario: a declared smart.who.int.base dependency makes it a DAK
    Given a sushi-config.yaml depending on smart.who.int.base "current"
    Then it is a DAK with base version "current"

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::carriesPinnedBaseVersion
  Scenario: a pinned version is carried, not just the fact of the dependency
    Given a dependency on smart.who.int.base "0.2.0"
    Then the base version is "0.2.0"

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::readsObjectDependencyForm
  Scenario: SUSHI's object dependency form is read too
    Given a dependency on smart.who.int.base written as an object with version "1.2.3"
    Then it is a DAK with base version "1.2.3"

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::otherDependenciesDoNotQualify
  Scenario: other WHO-adjacent dependencies do not qualify a repository
    Given a dependency only on hl7.fhir.uv.cpg
    Then it is not a DAK, and the reason mentions "smart.who.int.base"

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::lookalikeIsNotDak
  Scenario: looking like a DAK is not being one
    Given a directory with input/business-processes/ and input/dictionary/ and no config
    Then it is not a DAK

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::eachNonDakReasonDistinct
  Scenario: each way of not being a DAK gives its own reason
    Then a directory with no config gives the reason "no sushi-config.yaml"
    And a config with no dependencies gives the reason "no dependencies"
    And a config whose dependencies do not parse is not a DAK

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::nonDakCoverSaysSo
  Scenario: a non-DAK is rendered but says so on its cover
    Then the HTML of the tree says "Not a recognised DAK"
    And it does not call itself a Digital Adaptation Kit

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::realDakCoverNamesBase
  Scenario: a real DAK's cover names the base version it pins
    Given a tree depending on smart.who.int.base "current" with a page
    Then its HTML says "Digital Adaptation Kit" and names "smart.who.int.base"
    And it does not say "Not a recognised DAK"

  @test:smart-base/scripts/dak-pdf.test.ts::DAK_identity_is_declared,_never_inferred::titleFromTopLevelNotNested
  Scenario: the title comes from the IG's own title, not a nested one
    Given a config with a nested page title "A page" and a top-level title "The IG"
    Then the assembly's title is "The IG"
