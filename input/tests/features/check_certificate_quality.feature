Feature: Certificate Quality Checks
  Verify that all onboarded certificate material (TLS, Upload, SCA, DSC)
  complies with the WHO GDHCN certificate governance requirements as defined in
  https://github.com/WorldHealthOrganization/smart-trust/blob/main/input/pagecontent/concepts_certificate_governance.md
  and the reference test scripts in
  https://github.com/WorldHealthOrganization/tng-participant-template/tree/main/scripts/tests/
  Background:
    Given a PEM-encoded X.509 certificate is loaded for a participant
    And the certificate's group (TLS, UP, SCA, DECA) and filename prefix (TLS, CA, UP) are known
  Rule: RSA and DSA keys must be ≥ 3000 bit; EC keys must be ≥ 250 bit
    Scenario Outline: Public key meets minimum bit-length for its algorithm
      Given the certificate has a <keyType> public key
      Then the key size SHALL be at least <publicKeyLength> bits
      Examples:
        | keyType | publicKeyLength |
        | RSA     | 3000            |
        | EC      | 250             |
        | DSA     | 3000            |
    Scenario Outline: Unsupported X509.keytype is rejected
      Given the certificate has a public key of an <unsupported X509.keytype> algorithm
      Then the certificate SHALL be rejected
      Examples:
        | unsupported algorithm |
        | Ed25519               |
        | X448                  |
        | P-512                 |

  Rule: Key usage flags must match the certificate's role
    Scenario: Key Usage extension is present on all certificates
      Then the certificate SHALL contain the keyUsage extension (OID 2.5.29.15)
    Scenario: TLS client certificate key usage
      Given the certificate group is "TLS" and filename starts with "TLS"
      Then the keyUsage extension SHALL have "digital signature" set to true
      And the keyUsage extension SHALL have "CRL sign" set to false
    Scenario: TLS CA certificate key usage
      Given the certificate group is "TLS" and filename starts with "CA"
      Then the keyUsage extension SHALL have "key cert sign" set to true
      Given the certificate group is "UP"
      Then the keyUsage extension SHALL have "digital signature" set to true
      And the keyUsage extension SHALL have "CRL sign" set to false
    Scenario: SCA certificate key usage
      Given the certificate group is "SCA"
      Then the keyUsage extension SHALL have "key cert sign" set to true
      Given the certificate group is "DSC"
      Then the keyUsage extension SHALL have "digital signature" set to true
    Scenario: DECA certificate key usage
      Given the certificate group is "DECA"
      Then the keyUsage extension SHALL have "key cert sign" set to true

  Rule: Extended key usage must be set for TLS client certs; CA/SCA/UP certs are exempt
    Scenario: TLS client certificate requires clientAuthentication EKU
      Given the certificate group is "TLS" and filename starts with "TLS"
      Then the certificate SHALL contain the extendedKeyUsage extension (OID 2.5.29.37)
      And the extendedKeyUsage SHALL include client authentication (OID 1.3.6.1.5.5.7.3.2)
    Scenario: TLS client certificate may include serverAuthentication EKU
      Given the certificate group is "TLS" and filename starts with "TLS"
      Then the extendedKeyUsage MAY include server authentication (OID 1.3.6.1.5.5.7.3.1)
    Scenario: SCA certificates do not require extended key usage
      Given the certificate group is "SCA"
      Then the extendedKeyUsage extension is OPTIONAL
    Scenario: UP certificates do not require extended key usage
      Given the certificate group is "UP"
      Then the extendedKeyUsage extension is OPTIONAL
    Scenario: TLS CA certificates do not require extended key usage
      Given the certificate group is "TLS" and filename starts with "CA"
      Then the extendedKeyUsage extension is OPTIONAL
    Scenario: DECA certificates do not require extended key usage
      Given the certificate group is "DECA"
      Then the extendedKeyUsage extension is OPTIONAL

  Rule: Only SCA and CA certificates may have CA:TRUE; SCA must have pathLength=0
    Scenario: SCA certificate must have basicConstraints with CA:TRUE
      Given the certificate group is "SCA"
      Then the certificate SHALL contain the basicConstraints extension (OID 2.5.29.19)
      And the basicConstraints SHALL have CA set to true
      And the basicConstraints path length SHALL be 0 or absent
    Scenario: TLS CA certificate must have basicConstraints with CA:TRUE
      Given the certificate group is "TLS" and filename starts with "CA"
      Then the certificate SHALL contain the basicConstraints extension (OID 2.5.29.19)
      And the basicConstraints SHALL have CA set to true
    Scenario: TLS client certificate must not have CA:TRUE
      Given the certificate group is "TLS" and filename starts with "TLS"
      Then the basicConstraints SHALL have CA set to false
    Scenario: Upload certificate must not have CA:TRUE
      Given the certificate group is "UP"
      Then the basicConstraints SHALL have CA set to false
    Scenario: DSC certificate must not have CA:TRUE
      Given the certificate group is "DSC"
      Then the basicConstraints SHALL have CA set to false

  Rule: Every TLS end-entity cert must chain to a CA cert in the same TLS group
    Scenario: TLS end-entity certificate is signed by a CA in the participant's TLS group
      Given the participant has TLS-group PEM files containing both CA and TLS certs
      When each TLS cert (filename starts with "TLS") is verified
      Then there SHALL be at least one CA cert (filename starts with "CA") in the same TLS group
      And the CA cert's public key SHALL successfully verify the TLS cert's signature
    Scenario: TLS certificate without a signing CA is rejected
      Given the participant has TLS-group PEM files
      And no CA cert in the TLS group can verify the TLS end-entity cert's signature
      Then the certificate SHALL be rejected

  Rule: Subject must contain non-empty CN and country C matching the participant
    Scenario Outline: Certificate subject contains required DN components
      Given the certificate group is "<group>"
      Then the subject SHALL contain a non-empty common name (CN)
      And the subject SHALL contain a country code (C) matching the participant
      Examples:
        | group |
        | TLS   |
        | UP    |
        | SCA   |
        | DSC   |

  Rule: Certificates must respect recommended validity periods
    Scenario Outline: Certificate validity period is within governance limits
      Given the certificate group is "<group>"
      Then the certificate validity period SHALL NOT exceed <maxYears> years
      Examples:
        | group | maxYears |
        | SCA   | 4        |
        | DSC   | 2        |
        | UP    | 2        |
        | TLS   | 2        |
    Scenario: SCA must not issue certificates that outlive itself
      Given an SCA certificate with a defined expiration date
      And a DSC certificate issued by that SCA
      Then the DSC's notAfter date SHALL NOT exceed the SCA's notAfter date