Feature: deciding what a getting-started request means

  @test:scripts/tests/getting-started.test.ts::folio-intent.dmn_—_five_requests,_one_sentence::bareDirIsNewRepo
  Scenario: a bare non-folio directory is the ONE state that answers itself
    When the intent table is asked about an empty non-folio directory with nothing stated
    Then it answers new-repo

  @test:scripts/tests/getting-started.test.ts::folio-intent.dmn_—_five_requests,_one_sentence::existingFolioAsks
  Scenario: an existing folio is ambiguous — add-folio, new-repo and new-content all fit
    When it is asked about an existing folio with nothing stated
    Then it answers ask

  @test:scripts/tests/getting-started.test.ts::folio-intent.dmn_—_five_requests,_one_sentence::contentRepoAsks
  Scenario: somebody's repository is never overlaid on inference
    When it is asked about a repository with content that is not a folio
    Then it answers ask

  @test:scripts/tests/getting-started.test.ts::folio-intent.dmn_—_five_requests,_one_sentence::statedIntentWins
  Scenario: what the user actually said beats every filesystem heuristic
    When it is asked with a stated intent
    Then the stated intent is the answer

  @test:scripts/tests/getting-started.test.ts::folio-intent.dmn_—_five_requests,_one_sentence::outcomesAreBranches
  Scenario: every outcome the table can return names a real branch of the gateway
    When the table's outcomes are compared with the intent gateway's branches
    Then each is a branch, and ask is among them

  @test:scripts/tests/getting-started.test.ts::pages-live-gate.dmn_—_'could_not_check'_is_not_'not_yet'::measured404NotYet
  Scenario: a measured 404 is `not-yet`; a failed request is `unknown`
    When the pages-live table is asked about a 404, an error, an unchecked probe and an ok
    Then they are not-yet, unknown, unknown and live

  @test:scripts/tests/getting-started.test.ts::pages-live-gate.dmn_—_'could_not_check'_is_not_'not_yet'::noBranchUnprovisioned
  Scenario: no gh-pages branch is `unprovisioned`, before the address is considered (#2417)
    When the table is asked with no gh-pages branch, and with an unknown branch
    Then without the branch it is unprovisioned, address or not
    And an unknown branch with an ok probe is live

  @test:scripts/tests/getting-started.test.ts::pages-live-gate.dmn_—_'could_not_check'_is_not_'not_yet'::noUrlUnknown
  Scenario: no URL means unknown whatever a probe claims to have found
    When the table is asked with no URL and an ok probe
    Then it is unknown

  @test:scripts/tests/getting-started.test.ts::pages-live-gate.dmn_—_'could_not_check'_is_not_'not_yet'::scriptAgreesWithTable
  Scenario: the script's own decision agrees with the table it documents
    When every combination of inputs is decided by the script and by the table
    Then they agree
