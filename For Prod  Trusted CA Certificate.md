## Steps to Obtain and Use a CA-Signed Certificate

**1. Generate a Certificate Signing Request (CSR)**
To begin, generate a CSR using the following OpenSSL command. This request will include a new private key and a configuration file:

```
openssl req -new -nodes -newkey ec:<(openssl ecparam -name prime256v1) -keyout CAprivkey.key -out CAreq.csr -config sca.conf
```


**CAprivkey.key:** This file contains the private key.
C**Areq.csr:** This file contains the Certificate Signing Request.
**sca.conf:** This is the OpenSSL configuration file used during the CSR generation.

**2. Submit the CSR to a Public Certificate Authority (CA)**
Submit the generated CAreq.csr file to the public CA of your choice. The CA will use this CSR to issue a certificate. Upon approval, the CA will provide you with:

**2. Submit CSR to the Public CA**
Submit the generated CAreq.csr file to the public CA of your choice. They will use the CSR to issue a certificate. The CA will provide you with the signed certificate and possibly a certificate chain or intermediate certificates.

**3. Use the CA-Signed Certificate**
Once you receive the CA-signed certificate, you will use it instead of generating a new self-signed certificate. Here’s how you can replace the placeholders with the signed certificate:
cp signed_CA_cert.pem ${subdir}/CAcert.pem 
cp CAprivkey.key ${subdir}/CAprivkey.key
