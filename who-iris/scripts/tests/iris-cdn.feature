Feature: The IRIS CDN release: BagIt bags, detached JWS signing, the DSpace REST feed and the runner
  How an IRIS CDN release is packaged without churn, signed and verified with
  did:web and detached JWS, fed from the DSpace REST change feed, loaded,
  checkpointed and reverted.

  @test:scripts/tests/iris-cdn.test.ts::BagIt_manifests_(RFC_8493)_—_no_churn::discoveryOrderKeepsBytes
  Scenario: order of discovery does not change the bytes
    Given three payload entries
    Then the tag files for them equal the tag files for the same entries in reverse order

  @test:scripts/tests/iris-cdn.test.ts::BagIt_manifests_(RFC_8493)_—_no_churn::refusesBaggingDate
  Scenario: no Bagging-Date, and a date label is refused
    Given three payload entries
    Then the bag-info.txt tag file contains no "Date"
    And asking for a "Bagging-Date" label throws an error mentioning "date"

  @test:scripts/tests/iris-cdn.test.ts::BagIt_manifests_(RFC_8493)_—_no_churn::payloadOxumIsOctetsCount
  Scenario: Payload-Oxum is octets.count
    Given three payload entries of 1, 3 and 3 bytes
    Then bag-info.txt contains "Payload-Oxum: 7.3"

  @test:scripts/tests/iris-cdn.test.ts::BagIt_manifests_(RFC_8493)_—_no_churn::manifestRoundTripsAndDiffs
  Scenario: manifest round-trips and diffs to exactly what moved
    Given a payload manifest written and parsed back
    And a second manifest where graph/spine.nq changed, records/10665/2.json was added and bitstreams/ab.pdf was removed
    When the two are diffed
    Then the diff is added records/10665/2.json, changed graph/spine.nq, removed bitstreams/ab.pdf, 1 unchanged
    And a manifest diffed with itself is empty

  @test:scripts/tests/iris-cdn.test.ts::BagIt_manifests_(RFC_8493)_—_no_churn::refusesUnsafeAndDuplicatePaths
  Scenario: unsafe and duplicate paths are refused
    Then a payload manifest with the path "../x" throws an error mentioning "unsafe"
    And a payload manifest with the path "x" twice throws an error mentioning "duplicate"

  @test:scripts/tests/iris-cdn.test.ts::did:web_+_detached_JWS_(RFC_7515_App._F,_ES256_/_EdDSA)::resolvesDidWebUrl
  Scenario: did:web resolution
    Then "did:web:litlfred.github.io:who-iris-cdn" resolves to "https://litlfred.github.io/who-iris-cdn/did.json"
    And "did:web:example.org" resolves to "https://example.org/.well-known/did.json"
    And "did:web:localhost%3A8443:a" resolves to "https://localhost:8443/a/did.json"

  @test:scripts/tests/iris-cdn.test.ts::did:web_+_detached_JWS_(RFC_7515_App._F,_ES256_/_EdDSA)::signsVerifiesAndFails
  Scenario: sign, verify, and every way it should fail
    Given a DID document with an active key "release-2026" and a retired key "old"
    And a tag manifest signed as a detached JWS with the active key
    Then the JWS payload segment is empty
    And its header's alg is "ES256"
    And it verifies with the active kid and chain "absent"
    And verification of an altered payload fails
    And verification with no DID document is "unknown"
    And a JWS signed with the retired key fails with a reason mentioning "assertionMethod"

  @test:scripts/tests/iris-cdn.test.ts::did:web_+_detached_JWS_(RFC_7515_App._F,_ES256_/_EdDSA)::didDocumentIsByteStable
  Scenario: the DID document is byte-stable for the same keys
    Given two key pairs
    When DID documents are built with the keys listed in either order
    Then both serialise to the same JSON
    And the first verification method's type is "JsonWebKey"

  @test:scripts/tests/iris-cdn.test.ts::DSpace_REST_change_feed::pagesNewestFirstToCursor
  Scenario: pages newest first and stops at the cursor; returns oldest first
    Given a fake Discovery API of five items, two per page
    When items changed since 2026-10-29T00:00:00+00:00 are fetched
    Then the result is u3, u4, u5 in that order
    And only two pages were requested
    And the first request sorts by dc.date.accessioned descending
    And the first request filters lastModified from 2026-10-29T00:00:00.000Z onwards

  @test:scripts/tests/iris-cdn.test.ts::DSpace_REST_change_feed::weeklyReconciliationListsAll
  Scenario: weekly reconciliation lists everything
    Given a fake Discovery API of five items, two per page
    When all item ids are listed
    Then they are u1 to u5

  @test:scripts/tests/iris-cdn.test.ts::DSpace_REST_change_feed::shortListingIsNotMassWithdrawal
  Scenario: a short listing is not read as a mass withdrawal
    Then with known ids a and b, a listing of only a, and a 0.5 threshold, b is reported withdrawn or hidden
    And with known ids a, b and c, a listing of only a, and a 0.5 threshold, it throws an error mentioning "faulty"

  @test:scripts/tests/iris-cdn.test.ts::DSpace_REST_change_feed::bitstreamsFromEmbeddedBundles
  Scenario: bitstreams come out of embedded bundles, sorted, with their bundle
    Given an item whose embedded bundles are THUMBNAIL with c.jpg and ORIGINAL with c.pdf
    When its bitstreams are read
    Then they are "ORIGINAL/c.pdf" then "THUMBNAIL/c.jpg"

  @test:scripts/tests/iris-cdn.test.ts::canonical_records_—_no_churn::recordBytesIgnoreKeyOrderAndLinks
  Scenario: key order and HAL links do not change the bytes
    Given two raw items with the same content in different key order and different HAL self links
    When each is turned into a record and serialised as canonical JSON
    Then the two serialisations are identical
    And the serialisation ends with "}" and a newline

  @test:scripts/tests/iris-cdn.test.ts::metadata_can_change_while_the_PDF_does_not::metadataShaIgnoresKeyOrder
  Scenario: metadataSha ignores key order and sees a value change
    Then the metadata hash is the same for the same metadata in a different key order
    And it differs when dc.date.issued changes from 2020 to 2021

  @test:scripts/tests/iris-cdn.test.ts::metadata_can_change_while_the_PDF_does_not::weeklyListingCarriesMetadataHash
  Scenario: the weekly listing carries each item's metadata hash
    Given a fake Discovery API returning one item "u" with metadata
    When all items are listed
    Then the entry for "u" is the metadata hash of that metadata

  @test:scripts/tests/iris-cdn.test.ts::metadata_can_change_while_the_PDF_does_not::containersPagedInFull
  Scenario: communities and collections are paged in full
    Given a fake API of five collections served two per page over three pages
    When all collections are listed with page size 2
    Then they are c0 to c4 in order

  @test:scripts/tests/iris-cdn.test.ts::x5c_trust_chain_up_to_WHO's_key::verifiesX5cChainToWhoAnchor
  Scenario: leaf signed by the WHO anchor verifies; a stranger's chain fails
    Given a test WHO root certificate made with openssl, an IRIS CDN leaf certificate it signed, and an unrelated key
    And a DID document whose key carries the leaf as its x5c chain
    And a detached JWS signed with the IRIS key
    Then with the WHO key as trust anchor it verifies with chain "verified"
    And with no anchor it verifies with chain "not-checked"
    And with the unrelated key as anchor it fails with a reason mentioning "trust anchor"
    And with the WHO anchor at 2099-01-01 it fails with a reason mentioning "validity"

  @test:scripts/tests/iris-cdn.test.ts::verification_refuses_what_the_release_cannot_prove::failsAnchoredKeyWithoutX5c
  Scenario: with a trust anchor, a key with no x5c chain fails
    Given a DID document whose key has no x5c chain and a JWS signed with it
    When it is verified against a trust anchor
    Then it fails with a reason mentioning "no certificate chain"

  @test:scripts/tests/iris-cdn.test.ts::verification_refuses_what_the_release_cannot_prove::failsKidOutsideExpectedDid
  Scenario: a kid outside the expected DID fails
    Given a JWS signed by a key of did:web:example.net
    Then verification expecting did:web:example.org fails with a reason mentioning "expected DID"
    And verification expecting did:web:example.net is verified

  @test:scripts/tests/iris-cdn.test.ts::verification_refuses_what_the_release_cannot_prove::refusesNonPlainDidWeb
  Scenario: did:web with a host or path that is not plain is refused
    Then resolving "did:web:a.org%2Fb" and "did:web:user%40a.org" throws an error mentioning "host"
    And resolving "did:web:a.org:.." and "did:web:a.org:x%2Fy" throws an error mentioning "segment"

  @test:scripts/tests/iris-cdn.test.ts::IRIS_values_used_as_path_segments_are_refused,_never_repaired::refusesUnsafePathSegments
  Scenario: handles, uuids and segments
    Then "10665/123" is an acceptable handle
    And "10665/1/x", "../1", a handle ending in a newline, the empty string and the number 7 are not
    And a well-formed UUID is acceptable and "x/../y" is not
    And "report.pdf" is an acceptable segment
    And the empty string, ".", "..", "a/b", "a\b", a value with a newline, and null are not
    And an item with no handle is keyed "uuid/<uuid>"
    And keying the handle "10665/1/../2" throws an error mentioning "handle"

  @test:scripts/tests/iris-cdn.test.ts::per-item_manifests_(Q4_A)::itemManifestHoldsOwnFilesStably
  Scenario: an item's manifest holds its record and files only, and is stable
    Given payload entries for items 10665/1 and 10665/12
    When the manifest for item 10665/1 is made
    Then it lists exactly data/bitstreams/10665/1/ORIGINAL/a.pdf and data/records/10665/1.json
    And it is the same when the entries are given in reverse order
    And its path is "items/10665/1/manifest-sha256.txt"
    And making the manifest for item 10665/9 throws an error mentioning "no record"

  @test:scripts/tests/iris-cdn.test.ts::per-item_manifests_(Q4_A)::metadataChangeMovesRecordOnly
  Scenario: a metadata-only change moves the record digest and not the PDF's
    Given item 10665/1's manifest before and after its record's content changes, with the PDF unchanged
    When the two are diffed
    Then only records/10665/1.json changed, nothing was added or removed, and 1 entry is unchanged

  @test:scripts/tests/iris-cdn.test.ts::live_iris.who.int_DSpace_7_REST_shapes_(#104)::recordOfLiftsEmbeddedContainers
  Scenario: recordOf lifts owningCollection and parentCommunity from _embedded while stripping HAL _links
    Given an item shaped like a live iris.who.int DSpace 7 response, with an embedded owning collection carrying its own HAL links
    When it is turned into a record
    Then the record has no _links and no _embedded
    And its owningCollection is the collection's uuid, handle and name only

  @test:scripts/tests/iris-cdn.test.ts::live_iris.who.int_DSpace_7_REST_shapes_(#104)::itemBitstreamsPagesBundles
  Scenario: itemBitstreams pages bundle bitstreams when a bundle has more than one page
    Given an item whose ORIGINAL bundle embeds part2.pdf on page 0 of 2
    And the bundle's bitstreams endpoint serves part1.pdf on page 1
    When the item's bitstreams are read
    Then they are part1.pdf then part2.pdf
    And two requests were made, the second for page 1 of that bundle's bitstreams with size 100

  @test:scripts/tests/iris-cdn.test.ts::initial-load_runner:_budget,_batch_plan,_checkpoint_and_graph_rebuild_(#104)::parseBudgetRequiresDenominators
  Scenario: parseBudget refuses a budget without upstream denominators (Task_StateBudget)
    Then parsing an empty budget throws an error mentioning "totalItemsUpstream"
    And parsing a budget with totalBytesUpstream 0 throws an error mentioning "totalBytesUpstream"
    And a complete budget given as JSON text parses with totalItemsUpstream 274071, maxBatchesPerRun 1 and pageSize 1

  @test:scripts/tests/iris-cdn.test.ts::initial-load_runner:_budget,_batch_plan,_checkpoint_and_graph_rebuild_(#104)::initialLoadBatchesResumesBuildsGraph
  Scenario: runInitialLoad plans batches by collection, checkpoints after each batch, resumes where it stopped, and builds the Oxigraph graph
    Given a signing key in the environment, an in-memory object store and a temporary release directory
    And a fake IRIS API with one community, one collection and two items, one per page, each with one PDF
    And a budget of at most one batch per run with page size 1
    When the initial load runs the first time
    Then one batch is completed and one remains
    And state/initial-load.json exists and state/cursor.json does not
    When the initial load runs again
    Then one batch is completed and none remain
    And state/cursor.json exists with cursor "2026-10-31T02:23:11.326+00:00"
    And the release manifest lists records/10665/387974.json, records/10665/387973.json, graph/who-iris-spine.nq.gz and graph/subgraph-manifest.json

  @test:scripts/tests/iris-cdn.test.ts::Task_Revert:_automatic_revert_when_post-publish_verification_fails_(#104)::revertRestoresPreviousRelease
  Scenario: revertRelease reverts HEAD in the release git repository and restores the previous verified release and cursor
    Given a temporary git repository with a valid first release and cursor 2026-10-30T00:00:00Z
    And a second commit whose manifest is corrupted and whose cursor is 2026-10-31T00:00:00Z
    When the release is checked
    Then the check state is "failed"
    When the release is reverted
    Then the reverted commit differs from the head commit
    And manifest-sha256.txt is the first release's again
    And the JWS file is the first release's "header..sig1" again
    And the cursor is 2026-10-30T00:00:00Z again

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::handlesFileParses
  Scenario: a handles file keeps one reason per Handle and refuses what is not a Handle
    Given a handles file with a comment, a blank line and a repeated Handle
    Then each Handle is picked once, with the reason written after it
    And a line that is not a Handle is refused

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::sampleIsSeededAndDistinct
  Scenario: a sample is reproducible from its seed
    Given 17,248 matches and a seed
    Then the same seed picks the same 100 distinct indices, all in range

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::nodeIsReferencedWithPdfLinkAndNoBytes
  Scenario: the node is referenced and links the PDF on IRIS
    Given an item with one ORIGINAL PDF and one TEXT bitstream
    Then the node is referenced, has no libraryId and parents is []
    And its one bitstream links to the IRIS download URL with no sha256 fixity

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::writesRecordAndNodeSkipsHeldAndDoesNotChurn
  Scenario: held items are skipped and a re-run writes nothing
    Given a catalogue holding a node for 10665/375230
    When the subset names 10665/360869, 10665/375230 and an unknown Handle
    Then only 10665/360869 is written, with every MeSH value kept
    And 10665/375230 is reported as held and the unknown Handle as unresolved
    And no file content is requested
    And a re-run a day later rewrites nothing

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::refusesWithdrawnItems
  Scenario: a withdrawn item is refused
    Given an item IRIS marks withdrawn
    Then nothing is written and the item is reported as refused

  @test:scripts/tests/iris-cdn.test.ts::IRIS_subset_—_catalogue_by_reference::querySampleUsesOneRowPages
  Scenario: a sample reads one-row Discovery pages for the query
    Given a query with 5 matches
    Then a sample of 2 returns 2 picks whose reason names the match count
