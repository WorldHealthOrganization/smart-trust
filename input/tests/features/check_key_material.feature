Feature: Comprehensive Certificate Quality Validation
  In order to onboard certificates consistently for WHO Trust Network participants

  Background:
    Given a PEM-encoded X.509 certificate is loaded
    And the certificate group and filename prefix are known

  Rule: Submitted certificate material must be PEM certificates and not private keys
    Scenario: PEM certificate files are accepted for onboarding
      Given the submitted file is a certificate artifact
      Then the file SHALL be a PEM-encoded certificate
      And the file SHALL NOT contain a private key block

    Scenario: Private key files are rejected
      Given the submitted file contains a PRIVATE KEY block
      Then the certificate onboarding SHALL fail
      And the validation result SHALL contain "Only PEM certificates are allowed"  

  Rule: Public keys must meet bit-length requirements for their algorithm
    Scenario Outline: Certificate public key length is compliant
      Given the certificate public key algorithm is "<algorithm>"
      And the public key length is <actualBits> bits
      Then the certificate SHALL pass public key strength validation
      And the public key length SHALL be at least <minimumBits> bits

      Examples:
        | algorithm | actualBits | minimumBits |
        | RSA       | 3072       | 3000        |
        | EC        | 256        | 250         |
        | DSA       | 3072       | 3000        |

  
  Rule: Signature algorithms must be approved for onboarding
    Scenario Outline: Approved signature algorithms are accepted
      Given the certificate signature algorithm is "<algorithm>"
      Then the certificate SHALL pass signature algorithm validation

      Examples:
        | algorithm                  |
        | sha256WithRSAEncryption    |
        | ecdsa-with-SHA256          |
        | sha384WithRSAEncryption    |

    Scenario: Weak or unsupported signature algorithms are rejected
      Given the certificate signature algorithm is weak or unsupported
      Then the certificate SHALL be rejected

  Rule: Key usage must reflect certificate role and not enable unintended capabilities
    Scenario: All certificates include keyUsage
      Then the certificate SHALL contain the keyUsage extension (OID 2.5.29.15)

    Scenario: TLS client certificates require digitalSignature and disallow cRLSign
      Given the certificate group is TLS and the filename starts with TLS
      Then the keyUsage SHALL include digitalSignature
      And the keyUsage SHALL NOT include cRLSign

    Scenario: CA certificates require keyCertSign
      Given the certificate group is TLS and the filename starts with CA
      Then the keyUsage SHALL include keyCertSign

    Scenario: Upload certificates require digitalSignature and disallow cRLSign
      Given the certificate group is UP
      Then the keyUsage SHALL include digitalSignature
      And the keyUsage SHALL NOT include cRLSign

    Scenario: SCA certificates require keyCertSign
      Given the certificate group is SCA
      Then the keyUsage SHALL include keyCertSign

    Scenario: DSC certificates require digitalSignature
      Given the certificate group is DSC
      Then the keyUsage SHALL include digitalSignature

    Scenario: DECA certificates require keyCertSign
      Given the certificate group is DECA
      Then the keyUsage SHALL include keyCertSign  

  Rule: Extended key usage applies to TLS client certificates and is optional elsewhere
    Scenario: TLS client certificates require client authentication EKU
      Given the certificate group is TLS and the filename starts with TLS
      Then the certificate SHALL contain the extendedKeyUsage extension (OID 2.5.29.37)
      And the extendedKeyUsage SHALL include client authentication (OID 1.3.6.1.5.5.7.3.2)

    Scenario: TLS client certificates may also include server authentication EKU
      Given the certificate group is TLS and the filename starts with TLS
      Then the extendedKeyUsage MAY include server authentication (OID 1.3.6.1.5.5.7.3.1)

    Scenario: SCA certificates may omit extended key usage
      Given the certificate group is SCA
      Then the extendedKeyUsage extension is OPTIONAL

    Scenario: Upload certificates may omit extended key usage
      Given the certificate group is UP
      Then the extendedKeyUsage extension is OPTIONAL

    Scenario: CA certificates may omit extended key usage
      Given the certificate group is TLS and the filename starts with CA
      Then the extendedKeyUsage extension is OPTIONAL

    Scenario: DECA certificates may omit extended key usage
      Given the certificate group is DECA
      Then the extendedKeyUsage extension is OPTIONAL

  Rule: Basic constraints must identify CA certificates correctly
    Scenario: SCA certificates are CA:true with pathLength 0 or absent
      Given the certificate group is SCA
      Then the certificate SHALL contain the basicConstraints extension (OID 2.5.29.19)
      And basicConstraints CA SHALL be true
      And basicConstraints pathLength SHALL be 0 or absent

    Scenario: TLS client certificates must not be CA certificates
      Given the certificate group is TLS and the filename starts with TLS
      Then basicConstraints CA SHALL be false

    Scenario: Upload certificates must not be CA certificates
      Given the certificate group is UP
      Then basicConstraints CA SHALL be false

    Scenario: DSC certificates must not be CA certificates
      Given the certificate group is DSC
      Then basicConstraints CA SHALL be false

  Rule: TLS certificate chains must resolve to a valid issuer in the same TLS group
    Scenario: TLS end-entity certificate resolves to a CA certificate
      Given the participant provides TLS-group PEM files including CA and TLS certificates
      When each TLS certificate is validated
      Then there SHALL be a CA certificate in the same TLS group that validates the TLS certificate
      And the CA certificate public key SHALL verify the TLS certificate signature

    Scenario: TLS certificate that cannot be verified by a CA is rejected
      Given the participant provides TLS-group PEM files
      And no CA certificate in the TLS group can verify the TLS certificate
      Then the certificate SHALL be rejected

  Rule: CA bundle content must match the CA type and trust model
    Scenario: A self-signed CA uses CA.pem that mirrors the TLS certificate
      Given the CA certificate is self-signed
      Then the CA.pem file SHALL contain the same PEM certificate as the TLS certificate

    Scenario: A non-self-signed CA uses a CA.pem bundle containing the issuing chain
      Given the CA certificate is not self-signed
      Then the CA.pem file SHALL contain a CA bundle with the issuing certificate chain
      And the CA.pem file SHALL NOT be empty

    Scenario: Missing or invalid CA.pem prevents TLS onboarding
      Given TLS onboarding material is submitted
      And the CA.pem file is missing or does not contain a valid PEM certificate bundle
      Then TLS onboarding SHALL fail    

    
    Scenario: DSC certificates are validated against their issuing SCA
      Given a DSC certificate is issued by an SCA certificate
      Then the DSC SHALL be validated using the issuing SCA as the trust anchor
      And certificates above the SCA SHALL NOT be treated as the primary trust anchor

  Rule: Subject DN requirements must include identity information
    Scenario Outline: Certificate subject contains required DN elements
      Given the certificate group is <group>
      Then the subject SHALL contain a non-empty common name (CN)
      And the subject SHALL contain a country code (C) matching the participant

      Examples:
        | group |
        | TLS   |
        | UP    |
        | SCA   |
        | DSC   |

  Rule: Certificate validity periods must follow WHO limits
    Scenario Outline: Certificate lifetime stays within governance limits
      Given the certificate group is <group>
      Then the certificate validity period SHALL NOT exceed <maxYears> years

      Examples:
        | group | maxYears |
        | SCA   | 4        |
        | DSC   | 2        |
        | UP    | 2        |
        | TLS   | 2        |

    Scenario: DSC certificates must not outlive their issuing SCA
      Given an SCA certificate and a DSC certificate issued by that SCA
      Then the DSC expiration date SHALL NOT be later than the SCA expiration date







