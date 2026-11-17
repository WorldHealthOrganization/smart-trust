---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-025-63-trusting-a-ddccvs-signature
section_title: "Trusting a DDCC:VS signature"
section_number: 6.3
pages: 67-68
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The cryptographic strength of private–public key pairs is based on the mathematics of asymmetric 
cryptography, a process involving “one-way” mathematical functions, which are operations that are 
easy to compute in one direction but extremely hard to reverse. They provide a high level of security 
provided the private key is not compromised and remains available only to the entity performing 
the signing. Operationally, private keys are kept highly secure and public keys are broadly shared. 
Provided that a private key is not compromised and unintentionally revealed to another party, content 
that is “signed” by (i.e. encoded with) a private key may be readily verified by (i.e. decrypted by) 
anyone who has the corresponding public key. Anyone using the public key associated with the private 
key can be confident that: 
1.	 material they decrypt with a public key can only have been signed by the holder of the 
corresponding private key; and
2.	 the holder of the private key cannot deny that they signed the material.
PKI is the mechanism whereby the public key is circulated to all who need it and the receiver is 
assured that the public key comes from a trusted source. Furthermore, a PKI also includes means for 
revoking keys, so that if a private key is compromised, the public keys can be flagged as no longer 
valid. 
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
51
SECTION 7
