Testing of this specification is done by running the test cases defined in [Test Cases](test-cases.html). These test cases are expressed as Feature files in Gherkin language.

#### Testing Platforms
The following test infrastructure has been made available for the testing of this specification.

##### GDHCN Validator

Accessible on the web at [gdhcn-validator.net](https://gdhcn-validator.net/#home). The tool is equipped to validate certificates with keys available on WHO GDHCN Dev environment.

The tool can be used to validate
- QR code encoding
- CWT Claim structure
- validating signatures with public keys from GDHCN Dev

The tool cannot be used to validate
- publishing and retrieving of keys to the GDHCN

##### ITB

**Work in Progress** This specification shall be available for conformance testing within the EC DIGIT's [Interoperability Test Bed](https://www.itb.ec.europa.eu/itb/)