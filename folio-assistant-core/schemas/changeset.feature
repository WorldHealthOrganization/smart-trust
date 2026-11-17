Feature: computing a ChangeSet between two commits of a folio

  @test:schemas/changeset.test.ts::ChangeSet::noEditsNoChanges
  Scenario: no edits: no changes, every block counted unchanged
    Given a folio fixture with no edits
    When the change set is computed
    Then there are no changes and 4 blocks are unchanged
    And the change set validates

  @test:schemas/changeset.test.ts::ChangeSet::proseEditIsProseOnly
  Scenario: a prose edit is `prose` only
    Given def:b's prose is reworded
    When the change set is computed
    Then its one change is def:b changed with aspect prose only

  @test:schemas/changeset.test.ts::ChangeSet::topInsertMovesNothing
  Scenario: inserting a block at the top of a section moves NOTHING — moved is relative
    Given a block def:z inserted at the top of a section
    When the change set is computed
    Then one block is added, none changed and none moved
    And the first change is def:z added

  @test:schemas/changeset.test.ts::ChangeSet::swapMovesExactlyOne
  Scenario: swapping two neighbours moves exactly one of them
    Given two neighbouring blocks swapped
    When the change set is computed
    Then exactly one block is moved and there is one change

  @test:schemas/changeset.test.ts::ChangeSet::crossSectionMoveHasBothPositions
  Scenario: moving a block to another section is `moved`, with both positions
    Given def:c moved from sec:one to sec:two
    When the change set is computed
    Then its one change is def:c changed with aspect moved
    And the base section is ch::sec:one and the head section ch::sec:two

  @test:schemas/changeset.test.ts::ChangeSet::declaredRenameNotManifest
  Scenario: a declared rename is `renamed` and NOT also `manifest`
    Given def:a renamed to def:a2 with renamedFrom declared
    When the change set is computed
    Then the only change is def:a2 changed from def:a with aspect renamed alone

  @test:schemas/changeset.test.ts::ChangeSet::undeclaredRenameIsRemoveAdd
  Scenario: an undeclared rename is a removal plus an addition — the failure 5xzc's id-stable catches
    Given def:a relabelled def:a2 without renamedFrom
    When the change set is computed
    Then the changes are def:a2 added and def:a removed

  @test:schemas/changeset.test.ts::ChangeSet::removalReportsBasePosition
  Scenario: a removal reports the base position
    Given def:d dropped from sec:two
    When the change set is computed
    Then the only change is def:d removed with its base file, kind, section and index

  @test:schemas/changeset.test.ts::ChangeSet::unresolvableBaseThrows
  Scenario: an unresolvable base throws — it is not 'no changes'
    When the change set is computed against base "no-such-ref"
    Then it throws

  @test:schemas/changeset.test.ts::ChangeSet::absentFolioAllAdditions
  Scenario: a folio absent at the base makes every head block an addition
    Given a repository whose base commit has no folio, and a head folio with one block
    When the change set is computed
    Then one block is added, none removed or changed
    And comparing an empty snapshot with the folio also gives one addition

  @test:schemas/changeset.test.ts::changeset-text_(bean_d903):_what_the_diff_renderers_read::textCarriesChangedSidesOnly
  Scenario: carries both sides of a changed block, the head of an added one, the base of a removed one — and nothing unchanged
    Given def:b reworded, def:z added and def:d removed
    When the change set is computed with its text
    Then the text validates against ChangeSetTextSchema
    And its blocks are exactly the changed labels
    And def:b has its base prose and head HTML with "<strong>now</strong>"
    And def:z has only a head, def:d has no head, and unchanged def:a is absent

  @test:schemas/changeset.test.ts::changeset-text_(bean_d903):_what_the_diff_renderers_read::tableProseRenderedAsTable
  Scenario: a table's prose is rendered as a table, not left as pipes
    Given def:b's prose is a Markdown table
    When the change set text is computed
    Then the head HTML contains a table with cell "2" and no pipe characters

  @test:schemas/changeset.test.ts::changeset-text_(bean_d903):_what_the_diff_renderers_read::renamedBaseReadUnderOldLabel
  Scenario: a renamed block's base text is read under its OLD label and filed under the new one
    Given def:b renamed to def:bee and reworded
    When the change set text is computed
    Then def:bee's base prose is def:b's old prose
    And def:bee's head prose is the new prose

  @test:schemas/changeset.test.ts::changeset-text_(bean_d903):_what_the_diff_renderers_read::changesetOmitsProsePath
  Scenario: the ChangeSet itself never carries the prose path
    Given def:b's prose is edited
    When the change set is computed
    Then its JSON does not contain "mdPath"
