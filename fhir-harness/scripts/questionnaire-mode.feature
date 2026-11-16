Feature: The Questionnaire suggest mode: checks, JSON Patch and the change request

  @test:scripts/questionnaire-mode.test.ts::check:_findings_in_the_registry's_shape::checkErrorsSyntaxOnly
  Scenario: errors are syntax only
    Then a suggestion that is not JSON has one error starting "not JSON"
    And a suggestion of a Patient has an error first

  @test:scripts/questionnaire-mode.test.ts::check:_findings_in_the_registry's_shape::checkWarnsIntroducedOnly
  Scenario: warnings report only what the edit introduces
    Given an original with a dangling enableWhen and an edit that also reuses linkId "1" on that item
    Then the warnings are the duplicate linkId and the dangling enableWhen on item "1"
    And checking the original against itself gives nothing

  @test:scripts/questionnaire-mode.test.ts::check:_findings_in_the_registry's_shape::wireframeAddsFidelityWarning
  Scenario: a wireframe adds fidelity warnings
    When two items are swapped with a wireframe in the context
    Then there is one finding, saying the order differs

  @test:scripts/questionnaire-mode.test.ts::the_JSON_Patch::changedTextOneReplace
  Scenario: a changed item text is one replace, annotated with its linkId
    When an item's text changes
    Then the patch is one replace of that text, annotated with the item's linkId "2"

  @test:scripts/questionnaire-mode.test.ts::the_JSON_Patch::addedRemovedItemsAndKeys
  Scenario: added and removed items, and keys
    Then adding an item is one add, removing it is one remove
    And removing a key with a slash escapes it in the path

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::issueTitleAndBodyOnly
  Scenario: title and body, and no template: GitHub drops a body sent with an issue form
    Given an item made required, edited from the wireframe's side, with a why
    When the change request is written
    Then it has only a title and a body
    And the title names the IG and the Questionnaire
    And the body names the Questionnaire URL, the wireframe side, the source line, and the page
    And the body does not hold the why
    And the body tabulates the item before and after, and its JSON Patch adds required to item "2"

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::sideDefaultsQuestionnaire
  Scenario: the side defaults to the Questionnaire
    When a change request is written with no side
    Then the body says the Questionnaire side and the title names only the Questionnaire

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::sourceAnchoredOnInstanceLine
  Scenario: ctx.sourcePath names the source, anchored on the Instance line of ctx.sourceText
    Given a source FSH whose Instance line for the Questionnaire is line 3
    Then the source link is anchored on line 3
    Given a source that has no Instance line for it
    Then the source link has no anchor
    And no source text gives no instance line

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::withWhyAppendsOnce
  Scenario: withWhy appends the Why as the runtime does, once
    Then a why is appended trimmed under a Why heading
    And an empty why appends nothing
    And appending the same why twice appends it once

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::unchangedItemsSaysSo
  Scenario: an unchanged item list says so
    Then an item table of a title-only change starts "No item changed"

  @test:scripts/questionnaire-mode.test.ts::issue:_the_change_request::fallbackLinkMirrorsRuntime
  Scenario: the fallback link mirrors the runtime: title and body, the clipboard past the cap
    Given a small change request
    Then its link opens a new issue with no template, the body holding the JSON Patch, and nothing on the clipboard
    And a template given is kept in the link
    Given a change request past the URL cap
    Then its link is under the cap, its body says the change is on the clipboard, and the clipboard holds the JSON Patch

  @test:scripts/questionnaire-mode.test.ts::open:_the_mode_the_runtime_calls::untouchedEditorHandsBack
  Scenario: an untouched editor hands back ctx.text, so the runtime sees no change
    When the mode is opened and nothing is edited
    Then it hands back the original text and says "Not edited yet."
    And disposing it empties the host

  @test:scripts/questionnaire-mode.test.ts::open:_the_mode_the_runtime_calls::rawEditReachesIssue
  Scenario: the raw JSON edit and the side chosen reach issue() through the session; the Why is ctx's, not the DOM's
    Given the mode opened with a source, a why and a repository
    When the JSON is edited to change an item's text and the wireframe side is chosen
    Then the edited text is handed back and checks clean
    And the change request names the wireframe side and the source line, and not the why
    And appending the why gives one Why heading
    And the body holds the patch path of the changed text

  @test:scripts/questionnaire-mode.test.ts::open:_the_mode_the_runtime_calls::refusesNonQuestionnaire
  Scenario: text that is not a Questionnaire is refused, which the runtime reports
    Then opening the mode on Markdown text throws that it is not a Questionnaire as JSON

  @test:scripts/questionnaire-mode.test.ts::the_Form_Builder_hand-back_(formbuilder-lhcforms_API.md)::initializedAnsweredWithQ
  Scenario: initialized is answered with the Questionnaire
    Then the builder's "initialized" message is answered with the Questionnaire and the state becomes editing

  @test:scripts/questionnaire-mode.test.ts::the_Form_Builder_hand-back_(formbuilder-lhcforms_API.md)::updatesKeepLatest
  Scenario: updates and close keep the latest; cancel and abort say so
    Then an update keeps it as the latest
    And closing keeps the closing version as the latest and the first update as the round trip
    And cancel and abort set their status, abort with its error
    And an unknown message leaves the state as it was

  @test:scripts/questionnaire-mode.test.ts::the_Form_Builder_hand-back_(formbuilder-lhcforms_API.md)::builderOpenedSameSite
  Scenario: the builder is opened with referrer and fhirVersion, on the same site
    Then the builder URL is on the same site, with the referrer and the FHIR version "R4"
