Feature: a compiled copy and its inputs

  @test:schemas/materialization-compiled.test.ts::the_schema::compiledWithInputsParses
  Scenario: a compiled copy with its inputs parses
    When a compiled copy with inputs is validated
    Then it is accepted

  @test:schemas/materialization-compiled.test.ts::the_schema::compiledWithoutInputsRefused
  Scenario: a compiled copy WITHOUT inputs is refused: nothing could tell current from stale
    When a compiled copy without inputs is validated
    Then it is refused saying it requires inputs

  @test:schemas/materialization-compiled.test.ts::the_schema::toolchainAndRevisionRequired
  Scenario: toolchain and sourceRevision are both required inside inputs
    When inputs with only a toolchain, and only a source revision, are validated
    Then both are refused

  @test:schemas/materialization-compiled.test.ts::the_schema::compiledCannotDischargeSourceLoss
  Scenario: a compiled copy cannot discharge sourceLoss: it is derived, not the source
    When a compiled copy whose sourceLoss gate is permitted is validated
    Then it is refused saying it cannot discharge it

  @test:schemas/materialization-compiled.test.ts::the_schema::inputsOnNonCompiledRefused
  Scenario: inputs on a non-compiled copy is refused
    When a working copy with inputs is validated
    Then it is refused

  @test:schemas/materialization-compiled.test.ts::freshness::compiledNoExpiryInputBound
  Scenario: a compiled copy with no expiry is input-bound, not a no-expiry finding
    When the freshness of a compiled copy with no expiry is computed
    Then it is input-bound

  @test:schemas/materialization-compiled.test.ts::freshness::statedExpiryWins
  Scenario: a stated expiry still wins
    When the freshness of a compiled copy that expired in 2000 is computed
    Then it is expired

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::validWhenInputsMatch
  Scenario: valid when every stated input matches
    When the compiled copy is checked against matching inputs
    Then it is valid

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::staleNamesChangedInputs
  Scenario: stale-inputs names each input that changed
    When it is checked against a different toolchain and revision
    Then it is stale-inputs naming toolchain and sourceRevision

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::changedDigestAloneStale
  Scenario: a changed input digest alone is stale, even when the revision matches
    When it is checked against a different input digest only
    Then it is stale-inputs naming inputDigest

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::cannotTellWithoutNeededInput
  Scenario: cannot-tell when the caller cannot state an input the record needs compared — never valid
    When it is checked without the input digest it records
    Then the verdict is cannot-tell

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::noDigestJudgedOnToolchain
  Scenario: a record without a digest is judged on toolchain and revision
    Given a compiled copy recording no digest
    When it is checked against its toolchain and revision
    Then it is valid

  @test:schemas/materialization-compiled.test.ts::compiledValidity:_three_answers,_checked_before_use::cannotTellForNonCompiled
  Scenario: cannot-tell for anything that is not a compiled copy
    When a referenced node is checked
    Then the verdict is cannot-tell
