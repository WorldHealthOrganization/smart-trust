# Use Cases - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Business Requirements**](business_requirements.md)
* **Use Cases**

## Use Cases

### Use Cases

#### Federated PKD Aggregation

Keys from Local PKDs are aggregated in a federated PKD for use by verification applications.

**ACTORS:**

* Local PKD – acts as a node within a trust network​
* Aggregating/Federated PKD – trusted aggregation of public keys and trusted services from nodes

**TRANSACTION:** Mirror Local PKD

#### Federated Verification

Verifications can cryptographically verify health credentials using keys retrieved from the Federated PKD.

**ACTORS:**

* Universal Verification Application – verifies health documents using Public Key Infrastructure (PKI)​
* Local PKD – acts as a node within a trust network​
* Aggregating/Federated PKD – trusted aggregation of public keys and trusted services from nodes

**TRANSACTION:** Request PKD

#### Dynamic Business Rule Validation​

Validate one or more verified COVID credential against a dynamic business rule.​

**ACTORS:**

* Universal Verification Application – executes business rules against verified health documents​
* Business Rules Library – trusted service, provided by a node within a trust network, to share business rules using Clinical Quality Language (CQL) specification​

**PRE-CONDITION:** Verification Application has passed Verification Workflow​

**TRANSACTIONS:** Request Business Rule Updates, Execute Business Rule​

**OUT OF SCOPE:** consolidating business rules across trust network members​

