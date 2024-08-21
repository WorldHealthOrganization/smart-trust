# Introduction 
This repository contains the template for building [onboarding](https://github.com/WorldHealthOrganization/smart-trust/blob/main/input/pagecontent/concepts_onboarding.md) informations for the Smart Trust Network Attendees. This includes CSCAs, Auth information, signing information and other relevant files for onboarding a participant.

![Onboarding Process](Onboarding%20Process.drawio.png)

##  Prerequisites

**Create an private git repository on github. One for each Environment (DEV, UAT, PROD)**

> Please check [Create private repository](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/2.1.and2.3.full-video.v2.mp4) video for reference
- From Github profile, go to repositories
- Click on New
- Enter Repository name, follow the convention, it has to contain the ISO 3 letter. All the rest is optional
- Click on Create Repository

 
**Create PAT (Personal Access Token) for Github account if not created already**
- Go to Github profile -> Settings
- Go to Developers Settings -> Personal Access Tokens -> Tokens (Classic)
- Click on Generate New Token button (Generate New Token classic)
- Use Authentication code
- Add Note, Expiration, 'Repo' as a scope and click ‘Generate Token’

## Onboarding process

1. Go to local repo
2. Clone the new Github repo in your local repo

	```
	- git clone https://(your account PAT)@github.com/(your account or organization)/(repo).git
	- cd (repo)
	- git remote add template-repo https://github.com/WorldHealthOrganization/tng-participant-template.git
	- git pull template-repo main
	```

3. Add tng-bot to new repository
	> Please check [Invite tng-bot to private repository](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/2.2.full-video.v2.mp4) video for reference
- Go to Repository -> Settings
- Go to Collaborators
- Authenticate
- Click on Add people
- Add tng-bot for Prod and tng-bot-dev for dev and UAT


4. Create GPG Keys for responsible persons for each environment
	> Note: Before generating a new GPG key, make sure you've verified your email address. If you haven't verified your email address, you won't be able to sign commits and tags with GPG.
	> Please check [GPG key Creation](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/1.2.full-video.v2.mp4)  video for reference
- Download and install the GPG command line tools for your operating system. We generally recommend installing the latest version for your operating system.
- Open Git Bash
- Generate a GPG key pair. Since there are multiple versions of GPG, you may need to consult the relevant man page to find the appropriate key generation command

	If you are on version 2.1.17 or greater, paste the text below to generate a GPG key pair.
	

	```
	Shell
	gpg --full-generate-key
	```
	If you are not on version 2.1.17 or greater, the gpg --full-generate-key command doesn't work. Paste the text below and skip to step 4.
	
	~~~
	Shell
	gpg --default-new-key-algo rsa4096 --gen-key
	~~~
- At the prompt, specify the kind of key you want, or press Enter to accept the default. (Default is RSA)
- At the prompt, specify the key size you want, or press Enter to accept the default. (For RSA go for 4096)
- Enter the length of time the key should be valid. Press Enter to specify the default selection, indicating that the key doesn't expire. Unless you require an expiration date, we recommend accepting this default.
- Verify that your selections are correct.
- Enter your user ID information.
> Note: When asked to enter your email address, ensure that you enter the verified email address for your GitHub account. To keep your email address private, use your GitHub-provided no-reply email address. For more information, see "Verifying your email address" and "Setting your commit email address."
- Authenticate
- Use the **gpg --list-secret-keys --keyid-format=long** command to list the long form of the GPG keys for which you have both a public and private key. A private key is required for signing commits or tags.
	~~~
	Shell
	gpg --list-secret-keys --keyid-format=long
	~~~
> Some GPG installations on Linux may require you to use **gpg2 --list-keys --keyid-format LONG** to view a list of your existing keys instead. In this case you will also need to configure Git to use gpg2 by running **git config --global gpg.program gpg2**.

- From the list of GPG keys, copy the long form of the GPG key ID you'd like to use. In this example, the GPG key ID is 3AA5C34371567BD2:

	``` 
	Shell

	$ gpg --list-secret-keys --keyid-format=long
	/Users/hubot/.gnupg/secring.gpg
	------------------------------------
	sec   4096R/3AA5C34371567BD2 2016-03-10 [expires: 2017-03-10]
	uid                          Hubot <hubot@example.com>
	ssb   4096R/4BB6D45482678BE3 2016-03-10
	```	

- Paste the text below, substituting in the GPG key ID you'd like to use. In this example, the GPG key ID is 3AA5C34371567BD2:

	``` 
	Shell

	gpg --armor --export 3AA5C34371567BD2
	# Prints the GPG key ID, in ASCII armor format
	```
- Copy your GPG key, beginning with -----BEGIN PGP PUBLIC KEY BLOCK----- and ending with -----END PGP PUBLIC KEY BLOCK-----.
- Add the GPG key to your GitHub account.
	> Please check [Adding GPG key to repository](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/1.3.full-video.v2.mp4)  video for reference

	- Go to Github profile -> Settings
	- Go to SSH and GPG Keys
	- Click on New GPG Key
	- Add Title. Add key copied in last step
	- Click on Add GPG Key

5. Fill in content for your country
	>   for DEV and UAT environments you may use the conf files and the  [certgen bash script](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/gen_all_certs.sh)  as a guideline according to the  [Certificate Preparation](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/README.md)
	
- For DEV and UAT
**Certificate Preperation**
	> Disclaimer: The script generates self-signed certificates not intended to be used on production environments.
	
	You must adapt the following default certificate parameter of [DN_template.cnf](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/DN_template.cnf) file which will used  in gen_all_certs.sh to your needs:  
	```
	# Configuration Template for Certificate Generation
	# Modify for your own needs
	
	export OSSL_COUNTRY_NAME="XC"
	export OSSL_STATE_NAME="Test State"
	export OSSL_LOCALITY_NAME="TEST"
	export OSSL_ORGANIZATION_NAME="WHO"
	export OSSL_ORGANIZATIONAL_UNIT_NAME="RND"

	```
	> Note: OSSL_COUNTRY_NAME should be ISO 2 letter name of the country mapped to the name used in repository.
	
	Then execute the script. It will generate all certificates and keys in a subfolder named by current datetime.
	
	```
	For Mac
	cd scripts/certgen
	./gen_all_certs.sh

	For Windows:
	cd scripts/certgen
	./gen_all_certs.ps1

	```
	## Execution On Windows

	Windows plattform you can use  [gen_all_certs.ps1](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/gen_all_certs.ps1)  instead. Please note that you need to have  [OpenSSL installed](https://slproweb.com/products/Win32OpenSSL.html)  (e.g. Win64 OpenSSL v3.3.0 Light) and added to your PATH environment variable. Also you may need allow the execution by setting an execution policy
	```
		Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope Process
	```	
	## Prepare Folders

	**Note**: keep your private keys safe and secure. Do not share them with anyone.

	Copy the generated certificates to the respective folders and change the file names to match the naming convention. For the case of self-signed TLS certificates, the CA.pem is just a copy of the TLS.pem (check to have keyCertSign in the keyUsage). The CA.pem should exist, since it is used to verify the TLS client certificate when connecting to the TNG application.
	Files to be copied in respective folders are as follows:
	- SCA.pem -> onboarding/DCC/SCA
   	- UP.pem -> onboarding/DCC/UP
   	- CA.pem -> onboarding/DCC/TLS
   	- TLS.pem -> onboarding/DCC/TLS

	**Note** On DEV and UAT environment, if the files are generated using a script, delete the generated folder before committing the files.
	

- For Prod
**Concepts Certificate Preparation**
This guide follows the certificate templates defined in the certificate governance. Public Key Certificates generated by following this guide will include the minimal required fields - further fields can be added in the configuration files if needed.

	### Elliptic Curve Public Key Certificates (ECDSA with NIST-p-256)
	#### SCA certificate (TNP~SCA~) generation example:
	> Please check [SCA Creation](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/1.1.full-video.SCA.v2.mp4) video  for reference

	##### sca.conf
	Create a new file called sca.conf and replace the dn entries with your jurisdiction’s details.	
	```
	[req]
	prompt = no
	default_md = sha256
	distinguished_name = dn

	[dn]
	C = DE
	ST = NRW
	L = Bonn
	O = MinistryOfTest
	OU = DGCOperations
	CN = SCA_DGC_DE_01

	[ext]
	basicConstraints = critical, CA:TRUE, pathlen:0
	keyUsage = critical, cRLSign, keyCertSign
	subjectKeyIdentifier = hash
	```
	*Certificate generation*
	Open a command line prompt in the folder where the sca.conf is located and use the following OpenSSL command to create the private key (CAprivkey.key) and the certificate (CAcert.pem):
	```
	openssl req -x509 -new -days 1461 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout CAprivkey.key -nodes -out CAcert.pem -config sca.conf
	```
	#### DSC generation example
	Document Signer Certificates (DSCs) must be signed by the SCA. Hence, you have to create the SCA certificate (with the corresponding private key) before you can issue DSCs.

	##### DSC.conf
	> Please check [DSC generation and deletion](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/3.2.and3.3.full-video.v2.mp4)  video for reference
	
	Create a new file called DSC.conf in the folder where your CA’s private key is located and add the following fields:
	```
	[ext]
	keyUsage = critical, digitalSignature
	subjectKeyIdentifier = hash
	authorityKeyIdentifier = keyid:always
	crlDistributionPoints = URI:http://crl.exampledomain.example/CRL/SCA.crl
	extendedKeyUsage = 1.3.6.1.4.1.1847.2021.1.1,1.3.6.1.4.1.1847.2021.1.2,1.3.6.1.4.1.1847.2021.1.3
	```
	It is recommended that a SCA provides certificate revocation lists. Therefore, replace the crlDistributionPoints URI with the information for your jurisdiction.
The extendedKeyUsage field is optional and can be used to further restrict the DSC certificate as follows:\
**Field** &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp; **Value**\
extendedKeyUsage &emsp; 1.3.6.1.4.1.1847.2021.1.1 for Test Issuers\
extendedKeyUsage &emsp; 1.3.6.1.4.1.1847.2021.1.2 for Vacination Issuers\
extendedKeyUsage &emsp; 1.3.6.1.4.1.1847.2021.1.3 for Recovery Issuers\
The above example contains all three extended key usages.

	*Create a certificate signing request (CSR)*
	In order to create a certificate for a Document Signer, first create a Certificate Signing Request preferably on the machine that will use the certificate in order to avoid copying the private key (DSC01privkey.key) to this machine later. The CSR must contain the Distinguished Name (DN) information that will be included in the DSC. Open a command prompt and use the following command to create the CSR:
	```
	openssl req -newkey ec:<(openssl ecparam -name prime256v1) -keyout DSC01privkey.key -nodes -out DSC01csr.pem
	```
	If needed, you can repeat this procedure to create multiple CSRs for different DSCs (on different maschines). When prompted, enter the necessary information (e.g. C= your jurisdicion (MUST), O = your Organisation (OPTIONAL), CN = non-empty and unique CN (MUST), …).

	*Issue the certificate*
	Copy the CSR (DSC01csr.pem) to the folder where the private key of your CA is located. Open a command prompt and use the following command to issue the DSC (DSCcert.pem):
	```
	openssl x509 -req -in DSC01csr.pem -CA CAcert.pem -CAkey CAprivkey.key -CAcreateserial -days 730 -extensions ext -extfile DSC.conf -out DSCcert.pem
	```
	#### TNP~UP~  generation example
	##### uploadCert.conf
	> Please check [UP Creation](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/1.1.full-video.UP.v2.mp4)  video for reference
	
	Create a new file called _uploadCert.conf_ and replace the dn entries with your jurisdiction’s details.
	```
	[req]
	prompt = no
	default_md = sha256
	distinguished_name = dn

	[dn]
	C = DE
	ST = NRW
	L = Bonn
	O = MinistryOfTest
	OU = DGCOperations
	CN = NationX_TNPUP

	[ext]
	keyUsage = critical, digitalSignature
	```
	##### Certificate generation
	Open a command line prompt in the folder where the _uploadCert.conf_ is located and use the following OpenSSL command to create the private key (_TNP_UP.key_) and the certificate (_TNP_UP.pem_):
	```plaintext
	openssl req -x509 -new -days 365 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout TNP_UP.key -nodes -out TNP_UP.pem -config uploadCert.conf
	```
	#### TNP~TLS~  generation example
	##### TLSClient.conf
	> Please check  [TLS Creation](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/1.1.full-video.TLS.v2.mp4) video for reference 
	
	Create a new file called _TLSClient.conf_ and replace the dn entries with your jurisdiction’s details.
	```
	[req]
	prompt = no
	default_md = sha256
	distinguished_name = dn

	[dn]
	C = DE
	ST = NRW
	L = Bonn
	O = MinistryOfTest
	OU = DGCOperations
	CN = NationX_TNP_TLS

	[ext]
	keyUsage = critical, digitalSignature
	extendedKeyUsage = clientAuth
	```
	**NOTE** :Beware that self-signed certificates should also contain the key usage Certificate signing (keyCertSign), so that the (self) signature of the certificate can be verified.
	```plaintext
	[ext]
	keyUsage = critical, digitalSignature, keyCertSign
	extendedKeyUsage = clientAuth
	```
	##### Certificate generation
	Open a command line prompt in the folder where the _TLSClient.conf_ is located and use the following OpenSSL command to create the private key (_TNP_TLS.key_) and the certificate (_TNP_TLS.pem_):
	```plaintext
	openssl req -x509 -new -days 365 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout TNP_TLS.key -nodes -out TNP_TLS.pem -config TLSClient.conf
	```
	### RSA Public Key Certificates
	In case you want to use RSA certificates you can still use the configuration files provided above. During the CSR/certificate creation, replace the `-newkey ec:<(openssl ecparam -name prime256v1)` with `-newkey rsa:4096` for a 4096 Bit RSA key.  
Please be aware that RSA is NOT RECOMMENDED for the DSC and if you want to use RSA as your document signing algorithm, please create either a 2048 bit RSA key or at maximum a 3072 bit RSA key due to the space limitations on the QR codes.

	### Appendix A: Further example configuration files
	The following configuration files have been provided during the alignment on the [certificate governance](https://worldhealthorganization.github.io/smart-trust/concepts_certificate_governance.html). The configuration files contain additional fields that a Trust Network Participant might want to include and use. The config-files are not tested with the OpenSSL commands provided above.
	#### SCA Conf
	```plaintext
	[ sca_ext ]
	basicConstraints        = critical,CA:true,pathlen:0
	keyUsage                = critical,keyCertSign,cRLSign
	subjectKeyIdentifier    = hash
	authorityKeyIdentifier  = keyid:always
	issuerAltName           = dirName:dir_sect
	subjectAltName          = dirName:dir_sect
	crlDistributionPoints   = URI:http://crl.publichealth.xx/CRLs/XX-Health.crl
	2.5.29.16               = ASN1:SEQUENCE:CAprivateKeyUsagePeriod


	[ CAprivateKeyUsagePeriod ]
	notBefore               = IMPLICIT:0,GENERALIZEDTIME:$ENV::PRIV_KEY_START
	notAfter                = IMPLICIT:1,GENERALIZEDTIME:$ENV::CA_PRIV_KEY_END

	[dir_sect]
	L=XX
	```
	#### DSC conf
	```plaintext
	[ document_signer_all_ext ]
	keyUsage                = critical,digitalSignature
	subjectKeyIdentifier    = hash
	authorityKeyIdentifier  = keyid:always
	subjectAltName          = dirName:dir_sect
	issuerAltName           = dirName:dir_sect
	crlDistributionPoints   = URI:http://crl.npkd.nl/CRLs/NLD-Health.crl
	extendedKeyUsage        = 1.3.6.1.4.1.1847.2021.1.1,1.3.6.1.4.1.1847.2021.1.2,1.3.6.1.4.1.1847.2021.1.3
	2.5.29.16               = ASN1:SEQUENCE:DSprivateKeyUsagePeriod

	[ document_signer_test_ext ]
	keyUsage                = critical,digitalSignature
	subjectKeyIdentifier    = hash
	authorityKeyIdentifier  = keyid:always
	subjectAltName          = dirName:dir_sect
	issuerAltName           = dirName:dir_sect
	crlDistributionPoints   = URI:http://crl.npkd.nl/CRLs/NLD-Health.crl
	extendedKeyUsage        = 1.3.6.1.4.1.1847.2021.1.1
	2.5.29.16               = ASN1:SEQUENCE:DSprivateKeyUsagePeriod

	[ document_signer_vaccinations_ext ]
	keyUsage                = critical,digitalSignature
	subjectKeyIdentifier    = hash
	authorityKeyIdentifier  = keyid:always
	subjectAltName          = dirName:dir_sect
	issuerAltName           = dirName:dir_sect
	crlDistributionPoints   = URI:http://crl.npkd.nl/CRLs/NLD-Health.crl
	extendedKeyUsage        = 1.3.6.1.4.1.1847.2021.1.2
	2.5.29.16               = ASN1:SEQUENCE:DSprivateKeyUsagePeriod

	[ document_signer_recovery_ext ]
	keyUsage                = critical,digitalSignature
	subjectKeyIdentifier    = hash
	authorityKeyIdentifier  = keyid:always
	subjectAltName          = dirName:dir_sect
	issuerAltName           = dirName:dir_sect
	crlDistributionPoints   = URI:http://crl.npkd.nl/CRLs/NLD-Health.crl
	extendedKeyUsage        = 1.3.6.1.4.1.1847.2021.1.3
	2.5.29.16               = ASN1:SEQUENCE:DSprivateKeyUsagePeriod

	[ DSprivateKeyUsagePeriod ]
	notBefore               = IMPLICIT:0,GENERALIZEDTIME:$ENV::PRIV_KEY_START
	notAfter                = IMPLICIT:1,GENERALIZEDTIME:$ENV::DS_PRIV_KEY_END
	```
 	## Tagging for taking into use

	[](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/README.md#tagging-for-taking-into-use)

	Finally commit push changes and make a signed tag for the version you want to take into use.

	```
	git add .
	git commit -m "feat(cert): update certificates for onboarding"
	GIT_TRACE=1 git tag -s v0.0.1 -m 'onboardingRequest'
	git push --tags
	```
6. **Signing Your Work**
	> Please check  [Signing (tag) certificates](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/2.4.full-video.v2.mp4) video for reference

	Git is cryptographically secure, but it’s not foolproof. If you’re taking work from others on the internet and want to verify that commits are actually from a trusted source, Git has a few ways to sign and verify work using GPG.

	First of all, if you want to sign anything you need to get GPG configured and your personal key installed.
	```	
	$ gpg --list-secret-keys --keyid-format=long
	/Users/hubot/.gnupg/secring.gpg
	------------------------------------
	sec   4096R/3AA5C34371567BD2 2016-03-10 [expires: 2017-03-10]
	uid                          Hubot <hubot@example.com>
	ssb   4096R/4BB6D45482678BE3 2016-03-10
	````
	If you don’t have a key installed, you can generate one with **gpg --gen-key**.
	```
	$ gpg --gen-key
	```
	Once you have a private key to sign with, you can configure Git to use it for signing things by setting the user.signingkey config setting.
	```
	$ git config --global user.signingkey 3AA5C34371567BD2!
	```
	Now Git will use your key by default to sign tags and commits if you want.
	### Signing Tags
	If you have a GPG private key set up, you can now use it to sign new tags. All you have to do is use -s instead of -a:
	```
	$ git tag -s v1.5 -m 'my signed 1.5 tag'

	You need a passphrase to unlock the secret key for
	user: "Ben Straub <ben@straub.cc>"
	2048-bit RSA key, ID 800430EB, created 2014-05-04
	```
	If you run git show on that tag, you can see your GPG signature attached to it:
	```
	$ git show v1.5
	tag v1.5
	Tagger: Ben Straub <ben@straub.cc>
	Date:   Sat May 3 20:29:41 2014 -0700

	my signed 1.5 tag
	-----BEGIN PGP SIGNATURE-----
	Version: GnuPG v1

	iQEcBAABAgAGBQJTZbQlAAoJEF0+sviABDDrZbQH/09PfE51KPVPlanr6q1v4/Ut
	LQxfojUWiLQdg2ESJItkcuweYg+kc3HCyFejeDIBw9dpXt00rY26p05qrpnG+85b
	hM1/PswpPLuBSr+oCIDj5GMC2r2iEKsfv2fJbNW8iWAXVLoWZRF8B0MfqX/YTMbm
	ecorc4iXzQu7tupRihslbNkfvfciMnSDeSvzCpWAHl7h8Wj6hhqePmLm9lAYqnKp
	8S5B/1SSQuEAjRZgI4IexpZoeKGVDptPHxLLS38fozsyi0QyDyzEgJxcJQVMXxVi
	RUysgqjcpT8+iQM1PblGfHR4XAhuOqN5Fx06PSaFZhqvWFezJ28/CLyX5q+oIVk=
	=EFTF
	-----END PGP SIGNATURE-----

	commit ca82a6dff817ec66f44342007202690a93763949
	Author: Scott Chacon <schacon@gee-mail.com>
	Date:   Mon Mar 17 21:52:11 2008 -0700

	    Change version number
	```
	### Verifying Tags
	To verify a signed tag, you use git tag -v <tag-name>. This command uses GPG to verify the signature. You need the signer’s public key in your keyring for this to work properly:
	```
	$ git tag -v v1.4.2.1
	object 883653babd8ee7ea23e6a5c392bb739348b1eb61
	type commit
	tag v1.4.2.1
	tagger Junio C Hamano <junkio@cox.net> 1158138501 -0700

	GIT 1.4.2.1

	Minor fixes since 1.4.2, including git-mv and git-http with alternates.
	gpg: Signature made Wed Sep 13 02:08:25 2006 PDT using DSA key ID F3119B9A
	gpg: Good signature from "Junio C Hamano <junkio@cox.net>"
	gpg:                 aka "[jpeg image of size 1513]"
	Primary key fingerprint: 3565 2A26 2040 E066 C9A7  4A7D C0C6 D9A4 F311 9B9A

	```
	If you don’t have the signer’s public key, you get something like this instead:
	```
	gpg: Signature made Wed Sep 13 02:08:25 2006 PDT using DSA key ID F3119B9A
	gpg: Can't check signature: public key not found
	error: could not verify the tag 'v1.4.2.1'
	```
	### Signing Commits
	In more recent versions of Git (v1.7.9 and above), you can now also sign individual commits. If you’re interested in signing commits directly instead of just the tags, all you need to do is add a -S to your git commit command.
	```
	$ git commit -a -S -m 'Signed commit'

	You need a passphrase to unlock the secret key for
	user: "Scott Chacon (Git signing key) <schacon@gmail.com>"
	2048-bit RSA key, ID 0A46826A, created 2014-06-04

	[master 5c3386c] Signed commit
	 4 files changed, 4 insertions(+), 24 deletions(-)
	 rewrite Rakefile (100%)
	 create mode 100644 lib/git.rb
	```
	To see and verify these signatures, there is also a --show-signature option to git log.
	```
	$ git log --show-signature -1
	commit 5c3386cf54bba0a33a32da706aa52bc0155503c2
	gpg: Signature made Wed Jun  4 19:49:17 2014 PDT using RSA key ID 0A46826A
	gpg: Good signature from "Scott Chacon (Git signing key) <schacon@gmail.com>"
	Author: Scott Chacon <schacon@gmail.com>
	Date:   Wed Jun 4 19:49:17 2014 -0700

	    Signed commit
	```
	Additionally, you can configure git log to check any signatures it finds and list them in its output with the %G? format.
	```
	$ git log --pretty="format:%h %G? %aN  %s"

	5c3386c G Scott Chacon  Signed commit
	ca82a6d N Scott Chacon  Change the version number
	085bb3b N Scott Chacon  Remove unnecessary test code
	a11bef0 N Scott Chacon  Initial commit
	```
	Here we can see that only the latest commit is signed and valid and the previous commits are not.

	In Git 1.8.3 and later, git merge and git pull can be told to inspect and reject when merging a commit that does not carry a trusted GPG signature with the --verify-signatures command.

	If you use this option when merging a branch and it contains commits that are not signed and valid, the merge will not work.
	```
	$ git merge --verify-signatures non-verify
	fatal: Commit ab06180 does not have a GPG signature.
	```
	If the merge contains only valid signed commits, the merge command will show you all the signatures it has checked and then move forward with the merge.
	```
	$ git merge --verify-signatures signed-branch
	Commit 13ad65e has a good GPG signature by Scott Chacon (Git signing key) <schacon@gmail.com>
	Updating 5c3386c..13ad65e
	Fast-forward
	 README | 2 ++
	 1 file changed, 2 insertions(+)
	```
	You can also use the -S option with the git merge command to sign the resulting merge commit itself. The following example both verifies that every commit in the branch to be merged is signed and furthermore signs the resulting merge commit.
	```
	$ git merge --verify-signatures -S  signed-branch
	Commit 13ad65e has a good GPG signature by Scott Chacon (Git signing key) <schacon@gmail.com>

	You need a passphrase to unlock the secret key for
	user: "Scott Chacon (Git signing key) <schacon@gmail.com>"
	2048-bit RSA key, ID 0A46826A, created 2014-06-04

	Merge made by the 'recursive' strategy.
	 README | 2 ++
	 1 file changed, 2 insertions(+)
	```
	### Everyone Must Sign - Always a good idea
	Signing tags and commits is great, but if you decide to use this in your normal workflow, you’ll have to make sure that everyone on your team understands how to do so. This can be achieved by asking everyone working with the repository to run git config --local commit.gpgsign true to automatically have all of their commits in the repository signed by default. If you don’t, you’ll end up spending a lot of time helping people figure out how to rewrite their commits with signed versions. Make sure you understand GPG and the benefits of signing things before adopting this as part of your standard workflow.
7. Validating the certificates
	> Please check [Testing connection](https://github.com/WorldHealthOrganization/smart-trust/releases/download/v1.1.1/3.1.full-video.v2.mp4)  video for reference

	Use the following command to verify the certificates by testing the connection.
	```
	curl -v https://tng-dev.who.int/trustList --cert TLS.pem --key TLS.key
	```

8. Send an onboarding/participation request to gdhcn-support@who.int which contains:
- URL of the private repository created as a prerequisite
- The GPG key exported in Step 4

Once you recieve confirmation on sucesfull onboarding from TNG Support Team ( gdhcn-support@who.int) 

After onboarding in the DEV/UAT/Pro Environment, check the connectivity with the Trust Network Gateway using its API. This can be acheived with following command:

TNG-WHO Endpoints:
-	PRD:	 https://tng.who.int
-	UAT:	 https://tng-uat.who.int
-	DEV:	 https://tng-dev.who.int


```
curl -v https://tng-dev.who.int/trustList --cert TLS.pem --key TLS_key.pem
```
You should see a output like:

```
[
{
    "kid": "+jrpHSqdqZY=",
    "timestamp": "2023-05-25T07:55:21Z",
    "country": "XC",
    "certificateType": "UPLOAD",
    "thumbprint": "fa3ae91d...",
    "signature": "MIAGCSqGSIb3D...",
    "rawData": "MIIErTCCA5WgAwIBAgII..."
}
]
```
4) Test the other Trustlist Routes in the same style (e.g. with DSC/SCA/Upload/Authentication…)
5) Create an Document Signer Certificate and sign it by the SCA
6) Create an CMS Package with the following Command:
    Note: Step 4 and 5 could be achived through two menthod commandline and script respectively .

**Method 1 - Commandline .**
```
openssl x509 -outform der -in cert.pem -out cert.der
openssl cms -sign -nodetach -in cert.der -signer signing.crt -inkey signing.key -out signed.der -outform DER -binary
openssl base64 -in signed.der -out cms.b64 -e -A

```
**Note**: cert.der is your DSC, signing.crt is the TNPUP.

**Method 2 - Scripts**

The DSC generation and upload of  CMS package to TNG Gateway  could be achieved through the below mentioned scripts.
For DEV and UAT environments you may use script. 

[Generate DSCs](https://github.com/WorldHealthOrganization/tng-participant-template/tree/main/scripts/certgen#generate-dscs)

[Upload DSCs](https://github.com/WorldHealthOrganization/tng-participant-template/tree/main/scripts/certgen#upload-dscs0)

The Distinguised Nmae ( DN) configuration file while will parse as source  [DN_template.cnf](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/DN_template.cnf) is an example.

Please replace with your actual OSSL_COUNTRY_NAME, OSSL_STATE_NAME etc parameters accordingly of 	DN_template.cnf file.

The script expects at least two arguments:
A configuration file (DN_template.cnf) that contains the Distinguished Name (DN) template.
A subdirectory where the SCA (Signing Certificate Authority) PEM and KEY files are located.
An optional third argument can be provided to specify the purpose of the DSC (e.g., test, vax, rec). If this argument is not provided, the DSC will be generated for all purposes.

**Howto to run DSC Generate Script** [gen_dsh.sh](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/scripts/certgen/gen_dsc.sh)

``` 
./script_name.sh DN_template.cnf directory_of_SCA_files [test/vax/rec-purpose}

```
**How to run upload.sh script:**

./upload_dsc.sh: Replace this with the actual name of your script.

/path/to/subdir: Path to the directory containing UP.pem and UP.key.

/path/to/DSC_dir: Path to the directory containing the DSC files (DSC.pem, DSC.key).

DCC: The domain name to be used. If omitted, the script will default to DCC.
```
./upload_dsc.sh /path/to/subdir-up_pem_key  /path/to/DSC_dir [DCC]
```

7) Check DSC is already exist before upload CMS package
```   
curl -v https://tng-dev.who.int/trustList/DSC/XC --cert TLS.pem --key TLS.key
```
9) Upload the CMS Package to the Gateway
```    
curl -v -X POST -H "Content-Type: application/cms" --cert TLS.pem --key TLS_key.pem --data @cms.b64 https://tng-dev.who.int/signerCertificate

```
11) Download the Trustlist again, and check if your DSC is available.
```   
curl -v https://tng-dev.who.int/trustList/DSC/XC --cert TLS.pem --key TLS.key
```    

Note: Some versions of curl don’t attach the client certificates automatically. This can be checked via curl --version Ensure that the used version is linked to OpenSSL. Especially under Windows (https://curl.se/windows/):







=======================================================================
# Certificate Renewal Procedures

=======================================================================

## 1. **Renewing TLS Certificates**

The TLS, UP and SCA certificate renewal proces is same as fresh new TLS/UP/SCA certfication generation during fresh new full onboarding you had followed . Once you get notified by TNG Support Team prior 30 daysby E-mail communication on certificate expiration, so accordinlgy you have to renew you respective certificate .

**Validity periods**
Digital certificates contain a validity period that enforces certificate renewal. Renewal is necessary to use fresh cryptographic keys and to adapt the key sizes when improvements in computation or new attacks threaten the security of the cryptographic algorithm that is used. The shell model applies (see Section “Signing Certificate Authorities and Validation Model”). The following validity periods are recommended based on the assumption of the one-year maximum validity for Verifiable Digital Health Certificates :

SCA: 4 years
DSC: 2 years
Upload: 1-2 years
TLS Client authentication: 1-2 years
For a timely renewal, the following usage period for the private keys are recommended:

SCA: 1 year
DSC: 6 months
GDHCN Participants MUST create new upload certificates and TLS certificates timely, e.g. one month, before expiration in order to allow smooth operation. SCA and DSC SHOULD be renewed at least one month before the private key usage ends (considering the necessary operational procedures). GDHCN Participants MUST provide updated SCA, upload and TLS certificates to the GDHCN Secretariat.



### For Production Environment:

### **Renewing UP (TLS Certificates)**
1. **Create TLS Configuration File (`TLSClient.conf`):**

    ```plaintext
    [req]
    prompt = no
    default_md = sha256
    distinguished_name = dn

    [dn]
    C = DE
    ST = NRW
    L = Bonn
    O = MinistryOfTest
    OU = DGCOperations
    CN = NationX_TNP_TLS

    [ext]
    keyUsage = critical, digitalSignature, keyCertSign
    extendedKeyUsage = clientAuth
    ```

2. **Generate New Private Key and Certificate:**

    ```bash
    openssl req -x509 -new -days 365 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout TNP_TLS.key -nodes -out TNP_TLS.pem -config TLSClient.conf
    
    ```

## 2. **Renewing UP (Upload Certificates)**

### For Production Environment:
1. **Create UP Configuration File (`uploadCert.conf`):**

    ```plaintext
    [req]
    prompt = no
    default_md = sha256
    distinguished_name = dn

    [dn]
    C = DE
    ST = NRW
    L = Bonn
    O = MinistryOfTest
    OU = DGCOperations
    CN = NationX_TNPUP

    [ext]
    keyUsage = critical, digitalSignature
    ```

2. **Generate New Private Key and Certificate:**

    ```bash
    openssl req -x509 -new -days 365 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout TNP_UP.key -nodes -out TNP_UP.pem -config uploadCert.conf
    ```

## 3. **Renewing SCA (Signing Certificate Authority)**

### For Production Environment:
1. **Create SCA Configuration File (`sca.conf`):**

    ```plaintext
    [req]
    prompt = no
    default_md = sha256
    distinguished_name = dn

    [dn]
    C = DE
    ST = NRW
    L = Bonn
    O = MinistryOfTest
    OU = DGCOperations
    CN = SCA_DGC_DE_01

    [ext]
    basicConstraints = critical, CA:TRUE, pathlen:0
    keyUsage = critical, cRLSign, keyCertSign
    subjectKeyIdentifier = hash
    ```

2. **Generate New Private Key and Certificate:**

    ```bash
    openssl req -x509 -new -days 1461 -newkey ec:<(openssl ecparam -name prime256v1) -extensions ext -keyout CAprivkey.key -nodes -out CAcert.pem -config sca.conf

    
    ```

## General Notes:
- Make sure to replace configuration file details with your specific information.
- Ensure to back up any existing certificates before renewing.
- Verify and update any configurations or deployment settings to use the new certificates.
- Self-signed certificates are generally used for DEV and UAT environments. For production, use certificates signed by a recognized CA.




## Git Commit and Tag Push

### General Steps for Committing and Tagging Renewed Certificates:

1. **Add the renewed certificate to Git:**

    ```bash
    git add path/to/renewed-certificate.pem
    ```

2. **Commit the changes:**

    ```bash
    git commit -m "Add renewed certificate"
    ```

3. **Push the changes to the main branch:**

    ```bash
    git push origin main
    ```

4. **Tag the commit with an appropriate version:**

    ```bash
    git tag -a v1.3 -m "Renewed certificate"
    ```

5. **Push the tag to the remote repository:**

    ```bash
    git push origin v1.3
    ```

Feel free to adjust the file names and tags as needed for your specific context.


    
