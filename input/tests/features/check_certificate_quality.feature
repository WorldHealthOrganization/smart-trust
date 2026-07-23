# =============================================================================
# check_certificate_quality.feature  (revised)
#
# OPPORTUNITIES TO STRENGTHEN THIS SPEC
#   (The coverage and intent here are already right — these are refinements so
#    each check stays observable, unambiguous, and survives a refactor.)
#   Mostly well-structured (good use of Rule + declarative checks), but with
#   a few things worth tightening:
#     - Ambiguity: two scenarios each tested TWO roles in one scenario
#       ("TLS CA key usage" also asserted UP rules; "SCA key usage" also asserted
#       DSC) — a failure would be ambiguous about which role broke.
#     - Crypto precision: "EC keys >= 250 bit" (P-256 is 256); "P-512" is not a
#       curve (P-521 is); the "unsupported" list was ad-hoc instead of an
#       allow-list of what GDHCN actually permits (RSA / EC P-256).
#     - Assertions that don't yet check anything: several "... is OPTIONAL" scenarios assert nothing.
#     - Scenario Outline is used, which your parser doesn't support yet.
#
# SUGGESTED DIRECTION
#   One role per scenario; correct crypto facts; allow-list unsupported algos;
#   outlines expressed as data-table-driven single scenarios (the certificate
#   plugin iterates the table). Verbs map to a `certificate` dialect backed by
#   an X.509 inspection service (gdhcn-helper can host /cert/inspect).
# =============================================================================
@certificates @governance @GDHCN
Feature: Certificate governance quality checks
  Validate onboarded certificate material (TLS, UPLOAD, SCA/CSCA, DSC, DECA)
  against WHO GDHCN certificate governance.

  Background:
    Given certificate "cert" is loaded from the participant material
    And its group and filename prefix are known

  # --- Key strength ---------------------------------------------------------
  Rule: RSA/DSA keys >= 3000 bit; EC keys P-256 (256 bit)
    Scenario: Public key meets the minimum bit-length for its algorithm
      Then "cert" public key must satisfy the minimum size:
        | algorithm | minBits |
        | RSA       | 3000    |
        | DSA       | 3000    |
        | EC        | 256     |   # stronger: P-256 is 256-bit, not "250"

    Scenario: Only allowed public-key algorithms are accepted
      # stronger: replaces the ad-hoc "unsupported: Ed25519, X448, P-512" list
      # (P-512 isn't a curve). GDHCN signing is RSA or EC P-256 only.
      Then "cert" public key algorithm must be one of "RSA, EC(P-256)"

  # --- Key usage ------------------------------------------------------------
  Rule: keyUsage flags must match the certificate's role
    Scenario: keyUsage extension is present
      Then "cert" must contain extension "2.5.29.15"        # keyUsage

    # clearer here: the original crammed TLS-CA+UP and SCA+DSC together.
    # One role per scenario.
    Scenario: TLS client certificate keyUsage
      Given "cert" group is "TLS" and filename starts with "TLS"
      Then "cert" keyUsage "digitalSignature" must be true
      And "cert" keyUsage "cRLSign" must be false

    Scenario: TLS CA certificate keyUsage
      Given "cert" group is "TLS" and filename starts with "CA"
      Then "cert" keyUsage "keyCertSign" must be true

    Scenario: UPLOAD certificate keyUsage
      Given "cert" group is "UP"
      Then "cert" keyUsage "digitalSignature" must be true
      And "cert" keyUsage "cRLSign" must be false

    Scenario: SCA (CSCA) certificate keyUsage
      Given "cert" group is "SCA"
      Then "cert" keyUsage "keyCertSign" must be true

    Scenario: DSC certificate keyUsage
      Given "cert" group is "DSC"
      Then "cert" keyUsage "digitalSignature" must be true

    Scenario: DECA certificate keyUsage
      Given "cert" group is "DECA"
      Then "cert" keyUsage "keyCertSign" must be true

  # --- Extended key usage ---------------------------------------------------
  Rule: TLS client certs require clientAuth EKU; CA/SCA/UP/DECA are exempt
    Scenario: TLS client certificate requires clientAuth EKU
      Given "cert" group is "TLS" and filename starts with "TLS"
      Then "cert" must contain extension "2.5.29.37"        # extendedKeyUsage
      And "cert" EKU must include "1.3.6.1.5.5.7.3.2"        # clientAuth
      # serverAuth (…3.1) is MAY: asserting an optional element is present would
      # be wrong, so we assert nothing about it.

    # stronger: the four "extendedKeyUsage is OPTIONAL" scenarios asserted nothing
    # testable. Fold into one documentation-only waiver.
    Scenario: EKU is not required for CA/SCA/UP/DECA certificates
      Then "cert" EKU requirement is waived for groups "CA, SCA, UP, DECA"

  # --- Basic constraints ----------------------------------------------------
  Rule: Only SCA and CA certs may be CA:TRUE; SCA pathLen 0 or absent
    Scenario: SCA certificate is a CA with pathLen 0 or absent
      Given "cert" group is "SCA"
      Then "cert" must contain extension "2.5.29.19"        # basicConstraints
      And "cert" basicConstraints CA must be true
      And "cert" basicConstraints pathLen must be "0 or absent"

    Scenario: TLS CA certificate is a CA
      Given "cert" group is "TLS" and filename starts with "CA"
      Then "cert" basicConstraints CA must be true

    Scenario: End-entity certificates must not be CAs
      # stronger: 3 near-identical scenarios (TLS client, UP, DSC) -> one table.
      Then "cert" basicConstraints CA must be false for groups:
        | group |
        | TLS   |   # filename TLS
        | UP    |
        | DSC   |

  # --- Chain ----------------------------------------------------------------
  Rule: Every TLS end-entity cert must chain to a CA in the same TLS group
    Scenario: A TLS end-entity certificate is signed by a CA in its TLS group
      Given "tlsCert" is a TLS end-entity certificate
      And "caCert" is the CA certificate in the same TLS group
      Then "tlsCert" must be signed by "caCert"             # verifies signature

    Scenario: A TLS end-entity certificate with no signing CA in its group is rejected
      Given "tlsCert" is a TLS end-entity certificate
      And no CA certificate in its TLS group verifies it
      Then "tlsCert" must be rejected

  # --- Subject DN -----------------------------------------------------------
  Rule: Subject must contain a non-empty CN and a country matching the participant
    Scenario: Subject has a non-empty CN and a matching country
      # Original outline over TLS/UP/SCA/DSC applied the same rule -> one scenario.
      Then "cert" subject CN must be non-empty
      And "cert" subject country must equal the participant country

  # --- Validity -------------------------------------------------------------
  Rule: Certificates must respect recommended validity periods
    Scenario: Validity period is within the governance limit for its group
      Then "cert" validity must not exceed the limit for its group:
        | group | maxYears |
        | SCA   | 4        |
        | DSC   | 2        |
        | UP    | 2        |
        | TLS   | 2        |

    Scenario: An SCA must not issue a DSC that outlives it
      Given "sca" is an SCA certificate
      And "dsc" is a DSC issued by "sca"
      Then "dsc" notAfter must not exceed "sca" notAfter
