# DID Trustlist Specification - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Data Models and Exchange**](data_exchange.md)
* **DID Trustlist Specification**

## DID Trustlist Specification

### DID Specifications

The common trust list specification defines the lowest common denominator format that can interoperate between all included specifications and can support the minimal required features from each specification. This includes considering the minimum security requirements that satisfy each of the specifications. It was designed taking into account the following tenets:

1. SHALL be convertible from each existing trust network's formats
1. SHALL describe a key-to-trust-anchor path for all specifications
1. SHALL be cacheable
1. SHALL be mergeable (trust list operators can integrate each other's entries)
1. SHALL be usable by all stakeholders required to verify health credentials in their operations

#### DID Document v2.0

In [version 2.0 of the WHO GDHCN DID](concepts_did_gdhcn.md) publication specification, multiple DID files are created depending on your key needs.

#### DID Document v1.0 (deprecated)

In [version 1.0 of the WHO GDHCN DID](concepts_did_v1.md) publication specification a single DID file containing all keys.

