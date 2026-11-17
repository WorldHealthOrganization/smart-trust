---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-023-61-signing-a-ddccvs
section_title: "Signing a DDCC:VS"
section_number: 6.1
pages: 65-66
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The process of signing a DDCC:VS is shown in the top row of Fig. 13 and involves three steps.
1.	 The PHA generates a private and public key pair that serve as the “root certificate”. The private 
key is kept highly secure (never revealed to another party, maintained in a disconnected location, 
stored on media that is itself password-protected, etc.); the public key will be widely disseminated.
2.	 The PHA generates one or more DSC key pairs. DSC private keys are kept highly secure, and public 
keys are widely disseminated. The DSC key pair is digitally signed by the root certificate’s private 
key.
3.	 A DDCC:VS is digitally signed using the DSC’s private key. A barcode representation (e.g. QR code) 
of the signed content can be generated if required. The process of signing is illustrated in Fig. 14 
and works as follows.
a.	 A human-readable plain text description of the vaccination data is transformed into a non-human-
readable “document hash” using a hashing algorithm, which is a mathematical function that 
performs a one-way transformation of data of any size to data of a fixed size in a manner that is 
impossible to unambiguously reverse.
b.	 The DSC’s private key is used to sign the hash in a process in which the digital information of the 
private key further transforms the digital hash to produce a “signed hash”.
c.	 This signed hash now effectively contains information about the private key and the data contained 
on the DDCC:VS in a non-human-readable and cryptographically secure format.
Figure 14
How digital signatures work
Document
(vaccination 
data)
Document
hash
Signed 
hash
Document
with digitally 
signed hash 
(the DDCC:VS)
private 
key
Calculate 
hash from 
document
Signer
Add to 
document
01100010110
Digitally 
sign 
hash
01100010110
01100010110
Document Signing
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
49
SECTION 6
PKI for signing and verifying a DDCC:VS
