---
doc_id: who-2019-ncov-digital-certificates-vaccination-20211-eng
doc_title: "DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021 SECTION 1"
section_id: sec-037-4-what-is-public-key-infrastructure-pki
section_title: "What is public key infrastructure (PKI)?"
section_number: 4
pages: 85-89
source_pdf: WHO-2019-nCoV-Digital-certificates-vaccination-2021.1-eng.pdf
source_sha256: f57b14cb2acb728d
toc_source: inferred
---
The solution discussed in this document involves applying digital signatures to information to provide 
a guarantee that the information has been validated by an accredited authority. The proposed method 
is to employ a digital certificate using a private–public key pair, a common mathematical approach 
for encryption and digital trust. The processes, systems, software and rules around the management 
of these certificates form a PKI – essentially, all the components that need to be in place for a trusted 
solution to work.
WHY IS A PKI NEEDED?
Various individuals and organizations, when presented with a vaccination certificate, will need to be 
able to verify that the certificate has come from an approved authority, and that what the document 
purports to be is indeed true. 
For paper-based records, verification has been achieved historically by means of signatures and 
unique seals (e.g. stamps, holographic images, special paper), but these can be copied or forged. The 
electronic equivalent, making use of technology, is a digital certificate. At its simplest, the electronic 
equivalent can be a pair of keys: a private key and a public key. Either key can be used to digitally 
encrypt information in such a way that it can only be decrypted by its twin key. The private key is kept 
secret and protected, as the name suggests, but the public key is widely disseminated.
WHAT IS A PKI?
A system is needed to distribute public keys and to reassure the recipient that the public key has come 
from an accredited source (i.e. the certificate authority). This is one job of a PKI, which is a mechanism 
for disseminating the public keys and for following up with any revocation notices if a public key is 
found to be compromised. Revocation may happen, for example, if the private key is obtained by an 
unintended party.
In essence, the PKI binds a certificate to the identity of a particular individual or organization, so 
that a recipient can trust that the public key provided does reliably resolve back to the individual or 
organization in question.
HOW IS A PKI USED?
This property of the pair of keys for encryption or decryption (based on a one-way mathematical 
operation involving the factorization of large numbers) has many useful applications. Examples are:
Example 1:	
If I want to send a confidential message to a friend, then I can encrypt the message with 
his or her public key and send it out confident that only the person with the private key 
(my friend) will be able to read it.
Example 2:	
Likewise, if I want to send a message to the same friend and give him or her confidence 
that it could only have come from me, I can encrypt it with my private key, and my 
friend can then decrypt it with my public key, knowing that only someone with the 
private key (i.e. me) could have written it.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
69
---- BEGIN SSH2 PUBLIC KEY ----
Comment: “rsa-key-20210528”
AAAAB3NzaC1yc2EAAAABJQAAAQEArK462nWt2/JsHVHgyciu2HzV083IHYEKeLTL
g+7ewhCK26XRRe8f/WsG7qnlWShBvbcKDTARcM8jQS4qSG1KUCh09s6ZLRUT1mYF
JSB6BVBgGU/dDnsalKMNM4HR0utluzMTXnDypHrzDjXG3nqFrzfR0AtARf5aYNA1
ssZmh2jI3BF9M29jglv411WbMQzmmEBNrMYwmm3wCIZ826N/0LleeFuyp8q6TBMN
msRlOaIpGsTeYI2GKU/oRtxzYcP2glY0vLE/uGoySIeYlI3ME6DSJbmUHtxqKsCm
13ggQvEwreysLX6oL0uaUyYfHTTfF2kzCH8MWiB1iQP2z4izQw==
---- END SSH2 PUBLIC KEY ----
This second scenario is of interest for signing DDCC:VS data. It can be guaranteed that data has been 
approved and signed by a trusted authority if certificates are signed using private keys held by that 
authority and the person checking is in possession of the public key.
The keys are long alphanumeric sequences (see Fig. A4.1). There are various software tools for 
generating public–private key pairs.
Figure A4.1 
An example key
Figure A4.2
An example of a key generation tool
Page
70
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
A digital certificate (or public key certificate) is a file that contains a public key along with extra 
information such as the name of the issuer and the validity dates for using the key. A standard such as 
X509 is used to describe the elements in such a file.
HOW DOES A PKI WORK FOR VACCINATION CERTIFICATES?
For the purposes of the DDCC:VS, the PKI is used to establish data provenance, as per example 2 above, 
which works as follows.
A.	 A certificate authority, such as a public health authority, is nominated within a particular country, 
region or jurisdiction, and that certificate authority becomes the “trust anchor” responsible 
for issuing certificates. Trust begins at this point, and this entity has to be a recognized and 
authorized actor. 
B.	 The certificate authority doesn’t sign vaccination documents and data. The signing of vaccination 
documents and data is handled by other agencies, such as public health actors and other 
stakeholders.
C.	 Therefore, the certificate authority issues private–public key pairs to these other actors in the form 
of document signer certificates (DSCs), providing them with the information needed to digitally 
sign documents.
D.	 These different agencies then use the private key in their DSC to perform this signing activity. 
Signing involves encrypting the information using the private key so it is rendered into a format 
that is not human-readable.
E.	 Any electronic information can be signed in this way. The health certificate identifier (HCID) 
could be signed, a representation of the whole vaccination record could be signed, or some other 
combination of information, as determined by the certificate authority, could be signed. 
F.	 An interested party (i.e. a Verifier) who wants to decrypt the encrypted information for the 
vaccination certificate must have two key things. 
	»
The public key corresponding to the private key in the DSC; and
	»
Trust that the public key, from the DSC, came from a certificate authority that the interested party 
trusts.
G.	 To facilitate the two points in (F), a certificate authority usually sets up an online service for this 
purpose. The Verifier can interrogate the service and: 
	»
Ask for the public key if it does not have it. The Verifier can provide the HCID and check that the 
authority has that HCID in its records and that the HCID is linked to a valid public key. This is the 
role of the DDCC:VS Registry Service in this paper.
	»
Once the Verifier has the public key, it can also check with the authority that the public key is valid 
and has not been revoked.
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Page
71
H.	 Finally, now that the Verifier knows that the public key came from a trusted source, the Verifier can 
decrypt whatever information has been provided for the vaccination certificate. If the decryption 
reveals the data, the Verifier can be confident that:
	»
the information could only have been encrypted by someone with the private key, therefore it must 
have come from someone in possession of the DSC;
	»
the information has not been altered or tampered with after it was signed, otherwise the decryption 
would not work; and
	»
the information can be trusted, because the Verifier trusts the certificate authority, and trusts the 
certificate authority to have issued the DSC, which must have been used to encrypt the information.
I.	 If the public key decrypts the encrypted information so that it looks identical to the unencrypted 
version provided, the Verifier can be confident that only the entity in possession of the private key 
sent these data, and that it has not been altered since by any other party. 
	»
For the vaccination certificates, the HCID must resolve back to a digital record that is digitally signed 
in the manner described.
	»
Optionally, the DDCC:VS core data set could also be encoded into a barcode to enable the Verifier to 
perform an offline check, but the Verifier would still need to be able to validate that the public key 
was a valid one.
A PKI is only as secure as the IT infrastructure on which it is implemented; although PKI gives a high 
degree of trust, care must be taken to design and run the system in a manner that maintains security.
Page
72
DDCC:VS - Technical Specifications and Implementation Guidance, 27 August 2021
Annex 5
