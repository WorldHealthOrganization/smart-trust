Feature: materialising a subscribed knowledge graph's parts

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesUnknownSubscription
  Scenario: a subscription that does not exist
    When subscription "nope" is materialised
    Then it is refused saying there is no such subscription
    And nothing is fetched

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesUnchosenSubgraph
  Scenario: a subgraph the subscription did not CHOOSE
    When subgraph kb-skills, which the subscription did not choose, is materialised
    Then it is refused, saying to add it to the subscription's subgraphs
    And nothing is fetched or written

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesUndeclaredChosenSubgraph
  Scenario: a chosen subgraph the cached snapshot does not DECLARE
    When subgraph ghost, chosen but not declared by the cached snapshot, is materialised
    Then it is refused saying the snapshot does not declare it
    And nothing is fetched

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesSnapshotAtOtherPin
  Scenario: a snapshot at another pin: re-subscribe first
    Given a cached snapshot at another pin
    When subgraph kb is materialised
    Then it is refused saying to re-subscribe

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesAssetUnderPolicyNone
  Scenario: an asset under policy `none` (or no policy)
    When an asset is materialised with asset policy none
    Then it is refused naming on-demand or all
    And nothing is fetched

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesAssetOutsideDirectories
  Scenario: an asset outside every declared directory
    When an asset outside every declared directory is materialised
    Then it is refused saying so

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesAssetPath[%s]
  Scenario Outline: an asset path <path>
    Given asset policy all
    When the asset <path> is materialised
    Then it is refused
    And nothing is fetched

    Examples:
      | path |
      | ../etc/passwd |
      | /abs/path |
      | library/../x |
      | library/.hidden/x |

  @test:scripts/kg-materialize.test.ts::refused_before_any_byte_moves,_with_the_reason::refusesWorkingDischargingSourceLoss
  Scenario: a working copy that claims to discharge sourceLoss
    When a working copy claiming to discharge sourceLoss is materialised
    Then it is refused saying it cannot discharge sourceLoss

  @test:scripts/kg-materialize.test.ts::the_gates:_an_unanswered_gate_counts_as_a_refusal::noDecisionsStaysReferenced
  Scenario: no decisions: stays referenced, nothing fetched, and the record says why
    When subgraph kb is materialised with no decisions
    Then it stays referenced and nothing is fetched or written under tree
    And its record conforms, lists all five gates as unanswered and notes no purpose
    And the part is drawn as gates unanswered with no purpose stated

  @test:scripts/kg-materialize.test.ts::the_gates:_an_unanswered_gate_counts_as_a_refusal::refusedGateNamed
  Scenario: a refused gate: ✗, and the refusing gate is named
    When subgraph kb is materialised with copyright refused
    Then it stays referenced, nothing is fetched, and copyright is the refused gate
    And the part is drawn as gate refused naming copyright

  @test:scripts/kg-materialize.test.ts::the_gates:_an_unanswered_gate_counts_as_a_refusal::sizeMeasuredOverBudget
  Scenario: size is MEASURED, and over budget it refuses
    When subgraph kb is materialised with a 10-byte budget
    Then it stays referenced with size refused
    And the size basis says what was measured in how many files

  @test:scripts/kg-materialize.test.ts::the_gates:_an_unanswered_gate_counts_as_a_refusal::sizeGateNoInventedDenominator
  Scenario: sizeGate says what is not known rather than inventing a denominator
    When the size gate is computed without the repository's whole
    Then its basis says the whole was not enumerated and it is permitted

  @test:scripts/kg-materialize.test.ts::could-not-determine_is_never_clean,_and_writes_nothing::throwingFetchCouldNotDetermine
  Scenario: a fetch that throws
    When the fetch throws a 403
    Then the result is could-not-determine saying what was not read
    And nothing is written

  @test:scripts/kg-materialize.test.ts::could-not-determine_is_never_clean,_and_writes_nothing::emptyDeclaredPathRefused
  Scenario: declared, but the commit holds nothing there: refused, not guessed
    When subgraph kb-skills is materialised from a commit holding nothing at skills
    Then it is refused saying the commit holds nothing there

  @test:scripts/kg-materialize.test.ts::could-not-determine_is_never_clean,_and_writes_nothing::subgraphPathIsFileRefused
  Scenario: a subgraph path that is a file at the pin
    When the subgraph path is a file at the pin
    Then it is refused saying so

  @test:scripts/kg-materialize.test.ts::could-not-determine_is_never_clean,_and_writes_nothing::symlinkRefused
  Scenario: a symbolic link in the part is refused
    When the fetched part holds a symbolic link
    Then it is refused naming the link

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::materialisedWithRecordAndGates
  Scenario: bytes under tree/, a record that conforms, and every gate recorded
    When subgraph kb is materialised with every decision
    Then the bytes are under tree/ with the licence beside them
    And the record conforms and is archival at the pin, with its local path, upstream and tree digest
    And every gate is recorded with who decided it

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::fixityCoversCopiesNotUpstream
  Scenario: check:materialized-fixity covers the copies, and does not read upstream's own records as ours
    When subgraph kb is materialised and the fixity check runs
    Then the copies are verified and covered by parts
    And upstream's own record of library/x.pdf is not read as ours

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::editInPlaceFailsBoth
  Scenario: an edit in place fails both gates
    When a held file is edited in place
    Then the fixity check finds a mismatch
    And the materialisation check says the tree and the file do not hash to their digests

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::addedFileCaughtByTreeDigest
  Scenario: a file ADDED in place: the tree digest catches what a per-file walk cannot
    When a file is added to a held tree
    Then the per-file fixity check finds no mismatch
    And the materialisation check says the file is under the tree with no record

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::checkCleanCountsChosenNotHeld
  Scenario: the check is clean after a materialise, and counts what is chosen and not held
    When kb is materialised while kb and kb-skills are chosen
    Then the check is clean with one held and one chosen not held

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::rerunWritesNothing
  Scenario: re-running at the same pin with the same decisions writes nothing
    When kb is materialised again at the same pin with the same decisions on a later day
    Then nothing changes and the record is the same

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::refusalReplacedWhenGatesPass
  Scenario: a refusal record is replaced once the gates pass
    When kb is materialised without and then with decisions
    Then it is then materialised and the check is clean

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::movedPinStaleAndRefused
  Scenario: a moved pin: the held part is stale, and re-materialising is refused as a refresh
    When the subscription's pin moves after kb is held
    Then the check says the part is held at the old pin and to refresh
    And materialising again is refused

  @test:scripts/kg-materialize.test.ts::slice_5:_a_chosen_subgraph,_materialised::unchosenAndUnrecordedFindings
  Scenario: a part no longer chosen, and bytes with no record, are findings
    When kb is no longer chosen and stray directories appear
    Then the check reports the unchosen part, the stray subgraph directory and the parts for no subscription

  @test:scripts/kg-materialize.test.ts::slice_6:_one_asset_on_demand::assetOneFile[%s]
  Scenario Outline: policy <policy>: the one file, its digest, its gates
    Given asset policy <policy>
    When the asset library/report/report.pdf is materialised
    Then its one file is held with an asset part and no file list
    And its local path, upstream and five gates are recorded
    And the fixity and materialisation checks are clean

    Examples:
      | policy |
      | on-demand |
      | all |

  @test:scripts/kg-materialize.test.ts::slice_6:_one_asset_on_demand::directoryNotAsset
  Scenario: a directory is not an asset
    When a directory is materialised as an asset
    Then it is refused saying an asset is one file

  @test:scripts/kg-materialize.test.ts::slice_6:_one_asset_on_demand::heldAssetPolicyOffFinding
  Scenario: an asset held, then the policy turned off, is a finding
    When the asset policy is turned off after an asset is held
    Then the check says an asset is held under policy none

  @test:scripts/kg-materialize.test.ts::the_subscriptions_page_draws_a_part_from_its_record::cardsDrawEachState
  Scenario: held, refused, unanswered and not-yet-held each draw differently
    When kb is held, kb-skills refused, library chosen but not held, and an asset held
    Then there is one card
    And each part is drawn with its own state

  @test:scripts/kg-materialize.test.ts::the_subscriptions_page_draws_a_part_from_its_record::mismatchDrawsWarning
  Scenario: bytes that no longer match draw ⚠, never ⬇
    When a held file no longer matches
    Then the part is drawn as bytes not matching the record

  @test:scripts/kg-materialize.test.ts::the_subscriptions_page_draws_a_part_from_its_record::unreadableRecordDrawsUnknown
  Scenario: an unreadable record draws ?, never skipped
    When a part's record is not JSON
    Then the part is drawn as record unreadable

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesHitLandsWithRecord
  Scenario: a hit: the file lands beside a sha256 record, and --check holds it
    When the nodes of sdlc/skills are materialised
    Then the one hydrated file is fetched and held beside a nodes record
    And the record names the pin, the subgraph, the digest, the upstream, the size verdict and the members
    And no tree or materialization record is written and the check is clean

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesRootRefused
  Scenario: the root is REFUSED, pointing at index.jsonld — never read as an empty subgraph
    When the root is asked for as "", "." and "/"
    Then each is refused pointing at index.jsonld, with nothing fetched or written

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesMissingRefused
  Scenario: a missing file is refused, and nothing is written
    When a subgraph whose file is not published is asked for, with no package
    Then it is refused naming the missing file and the absent package
    And nothing is written

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesFromPinPackage
  Scenario: a nested subgraph the tree does not carry is read from the pin's package, verified, and recorded as from there
    When a nested subgraph the tree lacks is asked for with the pin's package
    Then it is materialised from the package and its record says so
    And the check is clean

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesPackageOtherSubgraphRefused
  Scenario: a package that holds another subgraph is not an answer: refused, saying where else it looked
    When the package holds another subgraph's file
    Then it is refused saying the package holds no file for it
    And nothing is written

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesPackageUnfetchedCouldNotDetermine
  Scenario: a package that could not be fetched is could-not-determine, never 'not published'
    When the package cannot be fetched
    Then the result is could-not-determine with the reason
    And nothing is written

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesPathOutsideRefused
  Scenario: a path outside every declared directory is refused before the fetch
    When a path outside every declared directory is asked for
    Then it is refused before the fetch

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesInvalidFileRefused
  Scenario: a schema-invalid file is refused, and nothing is written
    When the file has an inlined context, is not JSON, or is another subgraph
    Then each is refused saying why
    And nothing is written

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesPinChecked
  Scenario: the pin: a snapshot at another pin, a copy held at another pin, and a remote serving another commit
    When the snapshot is at another pin, the held copy is at another pin, and the remote serves another commit
    Then the first is refused to re-subscribe, with nothing fetched
    And the second is refused as held at the old pin and the check reports it
    And the third could not be determined and writes nothing

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesSizeCapReferenced
  Scenario: the size cap: over maxBytes stays referenced, with a record and no file
    When the nodes are materialised with a 1024-byte cap
    Then they stay referenced, with a record and no file
    And the check is clean

  @test:scripts/kg-materialize.test.ts::kg:materialize_--nodes_—_one_subgraph's_index.hydrated.jsonld,_metadata_only::nodesCheckFindsEditAndExtra
  Scenario: --check: an edit in place, and a file no record accounts for, are findings
    When the held file is edited and an extra file added
    Then the check says the file does not hash to its record
    And it reports the extra file with no record

  @test:scripts/kg-materialize.test.ts::a_nested_subgraph:_chosen_by_its_parent,_materialised_by_its_path_(owner,_2026-10-24,_ruling_4)::nestedHeldApart
  Scenario: its parent chosen, the nested path is held apart from the parent's part, and both checks pass
    When the nested path kb/nested is materialised and then kb
    Then the nested part is held apart, with its upstream and file ids
    And both are held, the check is clean and nothing is chosen but not held
    And the fixity check verifies everything

  @test:scripts/kg-materialize.test.ts::a_nested_subgraph:_chosen_by_its_parent,_materialised_by_its_path_(owner,_2026-10-24,_ruling_4)::nestedAloneNotParent
  Scenario: a nested part alone does not count its parent as held
    When only kb/nested is materialised
    Then kb still counts as chosen but not held

  @test:scripts/kg-materialize.test.ts::a_nested_subgraph:_chosen_by_its_parent,_materialised_by_its_path_(owner,_2026-10-24,_ruling_4)::nestedRefusedUnchosenOrOutside
  Scenario: refused when its parent is not chosen, or when no declared directory holds the path
    When kb/nested is asked for with kb unchosen, and outside/x is asked for
    Then the first is refused saying a nested part is chosen by its parent
    And the second is refused as under no declared directory
    And nothing is fetched
