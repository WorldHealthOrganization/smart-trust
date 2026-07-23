# =============================================================================
# check_dsc_upload.feature  (revised)
#
# OPPORTUNITIES TO STRENGTHEN THIS SPEC
#   (The coverage and intent here are already right — these are refinements so
#    each check stays observable, unambiguous, and survives a refactor.)
#   - Redundancy: five byte-identical happy paths (@HappyPath, @SCAValidation,
#     @CountryValidation, @UploadCertValidation, @CMSSignature accepted) — the
#     tag doesn't change the test.
#   - Status-only assertions: every rejection asserted only "400", so a negative
#     could pass for the wrong reason.
#   - Missing context: the country rules key off the authenticated (mTLS) caller,
#     which the spec never establishes.
#   - Unonboarded "XX": cross-country negatives used an unonboarded country,
#     conflating "unknown issuer" with "wrong country".
#   - Terminology: "SCA" vs "CSCA" used interchangeably.
#   - Inconsistent request format: some scenarios "with the CMS package", others
#     "with JSON body {cms,group,domain}".
#   - Missing precondition: the "duplicate" scenario says "again" with no first
#     upload. Weak E2E: "appears in trust list" only asserted HTTP 200.
#   - Non-determinism: "the CMS payload is randomly tampered".
#
# SUGGESTED DIRECTION
#   One happy path; onboard TWO real countries (DE, FR) so cross-country cases
#   test the country rule; set the authenticated identity; assert the rejection
#   CAUSE; deterministic tamper; verify trust-list CONTAINMENT. Verbs map to a
#   `trust-network` dialect backed by a DSC/CMS signing service; HTTP + asserts
#   reuse the core dialect.  (A Scenario Outline would collapse the negatives —
#   parser support pending.)
# =============================================================================
@DSC @Upload @CMS @GDHCN
Feature: Upload a Document Signer Certificate (DSC) to the Trust Network Gateway
  A TNP uploads a DSC (signed by its country's CSCA, wrapped in a CMS signed by
  its UPLOAD key) so it appears in the DSC trust list.

  Background:
    Given TNP is the system under test
    And Gateway is infrastructure at "https://tng-dev.example.org"
    # stronger: onboard TWO countries so cross-country rejections test the COUNTRY
    # rule, not "unknown issuer".
    And the gateway trusts these party certificates:
      | certificateType | country |
      | AUTHENTICATION  | DE      |
      | UPLOAD          | DE      |
      | CSCA            | DE      |
      | AUTHENTICATION  | FR      |
      | UPLOAD          | FR      |
      | CSCA            | FR      |
    # stronger: the country checks key off the mTLS client identity, never set before.
    And TNP is authenticated as country "DE"

  # HAPPY PATH — replaces the 5 identical positive scenarios.
  @HappyPath
  Scenario: A DSC signed by its CSCA and wrapped in a valid UPLOAD CMS is accepted
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "201"

  # SCA chain — FIX: assert the CAUSE, not just 400.
  @SCAValidation @negative
  Scenario: A DSC signed by the trust anchor (not a CSCA) is rejected
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the trust anchor
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "no known CSCA"

  @SCAValidation @negative
  Scenario: A DSC signed by a CSCA from a different (but trusted) country is rejected
    # stronger: use FR — a REAL onboarded CSCA — so this tests the country rule.
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "FR"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "country"

  # Country of origin.
  @CountryValidation @negative
  Scenario: A DSC whose subject country differs from the authenticated country is rejected
    Given TNP builds a DSC with subject country "FR"   # caller is authenticated as DE
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "country"

  # UPLOAD (CMS signer) country.
  @UploadCertValidation @negative
  Scenario: A CMS signed by an UPLOAD certificate from a different country is rejected
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "FR"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "signer"

  # CMS integrity — FIX: deterministic tamper + assert signature failure.
  @CMSSignature @negative
  Scenario: A CMS whose signed content is altered is rejected as an invalid signature
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    And one byte of the CMS signed content is flipped
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "signature"

  @TrustedCertificate @GDHCN @negative
  Scenario: A CMS that is not valid base64 / CMS structure is rejected
    Given TNP has a malformed CMS "%%%not-base64%%%"
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"
    And "response" should contain "parse"

  @TrustedCertificate @GDHCN @negative
  Scenario: A CMS signed by an unknown (non-onboarded) UPLOAD key is rejected
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by an unknown UPLOAD key
    When TNP uploads the DSC package to Gateway
    Then "response status" should be "400"

  # Duplicate — FIX: establish the first upload.
  @DuplicateCheck
  Scenario: Uploading the same DSC a second time returns a conflict
    Given a DSC has already been uploaded for country "DE"
    When TNP uploads the same DSC package to Gateway
    Then "response status" should be "409"

  # Revocation.
  @Revocation @Delete
  Scenario: A previously uploaded DSC can be revoked
    Given a DSC has already been uploaded for country "DE"
    When TNP revokes the DSC package on Gateway           # DELETE /trustedCertificate
    Then "response status" should be "204"

  @Revocation @Delete @negative
  Scenario: Revoking a DSC that was never uploaded returns not found
    Given TNP builds a DSC with subject country "DE"
    And the DSC is signed by the CSCA of "DE"
    And it is wrapped in a CMS signed by the UPLOAD certificate of "DE"
    When TNP revokes the DSC package on Gateway
    Then "response status" should be "404"

  @Revocation @Delete
  Scenario: A DSC can also be revoked via the POST /trustedCertificate/delete alias
    Given a DSC has already been uploaded for country "DE"
    When TNP revokes the DSC package via the delete alias on Gateway
    Then "response status" should be "204"

  # Trust list end-to-end — FIX: verify CONTAINMENT, not just HTTP 200.
  @TrustList @E2E
  Scenario: An uploaded DSC appears in the DSC trust list
    Given a DSC has already been uploaded for country "DE"
    When TNP downloads the "DSC" trust list from Gateway as "trustList"
    Then "response status" should be "200"
    And "trustList" should contain the DSC

  @TrustList @E2E
  Scenario: A revoked DSC no longer appears in the DSC trust list
    Given a DSC has already been uploaded for country "DE"
    And that DSC has been revoked
    When TNP downloads the "DSC" trust list from Gateway as "trustList"
    Then "trustList" should not contain the DSC
