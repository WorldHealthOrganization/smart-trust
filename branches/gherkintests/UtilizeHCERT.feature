Feature: Utilize HCERT


Scenario: Received QR code is a valid HCERT QR Code
GIVEN a Receiver is presented a QR Code
AND the QR code uses a format as defined in (ISO/IEC 18004:2015)
AND the QR code uses Alphanumeric mode (Mode 2) encoding
WHEN the Receiver scans the QR Code
THEN the QR code is successfully decoded
AND the decoded raw Alphanumeric string starts with "HC1:" prefix

@negative
Scenario: Received QR code is not a valid HCERT QR Code
GIVEN a Receiver is presented a QR Code
AND the QR code uses a format as defined in (ISO/IEC 18004:2015)
AND the QR code uses Base45 encoding
AND the QR code uses Alphanumeric mode (Mode 2) encoding
WHEN the Receiver scans the QR Code
THEN the QR code is successfully decoded
AND the decoded raw Alphanumeric string does not start with "HC1:" prefix
AND the QR Code is rejected with an Error

Scenario: Received QR code is a valid HCERT QR Code and a correct CWT Token is retrieved
GIVEN a Receiver is presented a QR Code
WHEN Receiver decodes the raw Alphanumeric string from QR Code
AND removes the "HC1:" prefix
THEN the remaining Alphanumeric string can be Base45 decoded to retrieve a binary payload
AND ZLIB decompression can be applied to the binary payload
THEN the retrieved Payload is a valid CBOR Web Token (CWT) as defined [here](http://smart.who.int/trust/StructureDefinition/CWT)

Scenario: Retrieved CWT is valid
GIVEN a valid CBOR CWT token is decoded from a QR Code
WHEN THE CWT is parsed
THEN CWT structure validates against the StructureDefinition as defined [here](http://smart.who.int/trust/StructureDefinition/CWT)

Scenario: Validate supported signature algorithms
GIVEN a valid CWT
WHEN the Receiver validates the algorithm i.e. Claim '1' in the Header
THEN the algorithm is be one of the supported types:
      | Algorithm | COSE Parameter | SOG-IT Level |
      | ES256     | ES256         | Primary (ECC P-256) |
      | PS256     | PS256         | Secondary (RSA PSS) |

Scenario: Validate Key Identifier - key is valid and onboarded to Trust Network
GIVEN a valid CWT Structure
WHEN the Receiver extracts the Key Identifier i.e. Claim '4' in the Header
AND extracts the Issuer i.e. Claim '1' from the Payload
THEN the extracted Key Id is 8 bytes
AND the extracted issuer is ISO 3166-1 alpha-2 Country Code
AND the public key can be retrieved from the trust network using the Country Code and Key Id

Scenario: Validate Signature of the CWT
GIVEN a valid CWT Structure
WHEN the Receiver extracts the public key of the issuer from the trust network that matches the Key Id in the COSE Header
AND the payload has not expired i.e. current time is between Issued at (Claim '6') and  Expiration Date (Claim '4') 
THEN the signature is cryptographically valid

Scenario: Extract HCERT Payload from validated CWT
GIVEN a CWT with verified signature
WHEN the Receiver extracts the HCERT Payload using claim key -260
THEN the extracted HCERT structure validates against the StructureDefinition as defined [here](http://smart.who.int/trust/StructureDefinition/HCert)