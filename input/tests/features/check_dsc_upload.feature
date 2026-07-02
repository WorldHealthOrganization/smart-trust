@DSC @Upload @CMS @GDHCN

Feature: Upload Document Signer Certificate (DSC) to the Trust Network Gateway
  As a Trust Network Participant (TNP)
  I want to upload a DSC signed by my SCA, wrapped in a CMS signed by my UPLOAD key
  So that the DSC becomes available in the trust list for other participants

  Background:
    Given the Trust Network Gateway is running
    And the TNP has been onboarded with the following trusted party certificates in the gateway database
      | certificateType | country |
      | AUTHENTICATION  | DE     |
      | UPLOAD         | DE     |
      | CSCA           | DE     |

  # --- Successful Upload ---

  @HappyPath
  Scenario: Successfully upload a DSC signed by SCA and wrapped in a CMS signed by the UPLOAD key
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 201
	
  # --- SCA Chain Validation ---
  @SCAValidation
  Scenario: DSC signed by the correct SCA is accepted
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 201
	
  @SCAValidation @negative
  Scenario: DSC not signed by any known SCA is rejected
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the Trust Anchor (not a CSCA)
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 400
   
  @SCAValidation @negative
  Scenario: DSC signed by an SCA from a different country is rejected
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "XX"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 400
    
  # --- Country of Origin Validation ---
  @CountryValidation
  Scenario: DSC with matching country code is accepted
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 201
    
  @CountryValidation @negative
  Scenario: DSC subject country does not match the authenticated country is rejected
    Given a DSC key pair is generated for country "XX"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 400
    
  # --- UPLOAD Certificate (CMS Signer) Validation ---
  @UploadCertValidation
  Scenario: CMS signed by a valid UPLOAD certificate for the same country is accepted
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 201
	
  @UploadCertValidation @negative
  Scenario: CMS signed by an UPLOAD certificate from a different country is rejected
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "XX"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 400
   
  # --- CMS Signature Validation ---
  @CMSSignature
  Scenario: Valid CMS signature is accepted
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a valid CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the CMS package
    Then the response status code is 201
	
  @CMSSignature @negative
  Scenario: Tampered CMS message is rejected
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    And the CMS payload is randomly tampered
    When the TNP sends a POST request to "/trustedCertificate" with the tampered CMS package
    Then the response status code is 400
   
  # --- Duplicate Detection ---
  @DuplicateCheck
  Scenario: Uploading the same DSC twice results in a conflict
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with the same CMS package again
    Then the response status code is 409
    
  # --- Trusted Certificate API (GDHCN endpoint) ---
  @TrustedCertificate @GDHCN
  Scenario: Upload a DSC via /trustedCertificate endpoint with group "DSC"
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate" with JSON body
      | field    | value              |
      | cms      | <base64 CMS>       |
      | group    | DSC                |
      | domain   | DCC                |
    Then the response status code is 201
   
  @TrustedCertificate @GDHCN @negative
  Scenario: Upload a DSC with an invalid CMS that cannot be parsed is rejected
    Given a malformed CMS string that is not valid base64 or CMS structure
    When the TNP sends a POST request to "/trustedCertificate" with JSON body
      | field    | value              |
      | cms      | <malformed CMS>    |
      | group    | DSC                |
    Then the response status code is 400
	
  @TrustedCertificate @GDHCN @negative
  Scenario: Upload a DSC with an invalid CMS signature is rejected
    Given a DSC key pair is generated for country "DE"
    And the DSC is signed by the CSCA certificate of country "DE"
    And a CMS package is created containing the DSC but signed by an unknown key
    When the TNP sends a POST request to "/trustedCertificate" with JSON body
      | field    | value              |
      | cms      | <invalid CMS>      |
      | group    | DSC                |
    Then the response status code is 400
	
  # --- DSC Revocation (Delete) ---
  @Revocation @Delete
  Scenario: Successfully revoke a previously uploaded DSC
    Given a DSC has been successfully uploaded for country "DE"
    And a CMS package is created containing the same DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a DELETE request to "/trustedCertificate" with the CMS package
    Then the response status code is 204	

  @Revocation @Delete @negative
  Scenario: Revoking a non-existent DSC returns not found
    Given no DSC exists in the gateway for the given thumbprint
    And a CMS package is created containing a DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a DELETE request to "/trustedCertificate" with the CMS package
    Then the response status code is 404
	
  @Revocation @Delete
  Scenario: Revoking a DSC via the alias POST /trustedCertificate/delete endpoint
    Given a DSC has been successfully uploaded for country "DE"
    And a CMS package is created containing the same DSC, signed by the UPLOAD certificate of country "DE"
    When the TNP sends a POST request to "/trustedCertificate/delete" with the CMS package
    Then the response status code is 204
    
  # --- Trust List Verification (End-to-End) ---
  @TrustList @E2E
  Scenario: After uploading a DSC, it appears in the DSC trust list
    Given a DSC has been successfully uploaded for country "DE" 
    When the TNP downloads the trust list from "/trustList/DSC"
    Then the response status code is 200
   
  @TrustList @E2E
  Scenario: After revoking a DSC, it no longer appears in the trust list
    Given a DSC has been successfully uploaded for country "DE"
    And the DSC has been revoked
    When the TNP downloads the trust list from "/trustList/DSC"
    Then the trust list does not contain an entry with the revoked DSC 