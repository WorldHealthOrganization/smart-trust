---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s022-using-the-application
section_title: "Using the application"
file: "README.md"
lines: 271-293
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
# Using the application

Once a complete Test Bed instance has been set up, either in development or as a Dockerised service, access using the default
Test Bed administrator account as follows:
1. Go to http://localhost:9000.
2. Click on the login button.
3. Authenticate using `admin@itb`. This account is set with a one-time password that is refreshed at start-up until a
   first login is made. The password to use is obtained by checking the logs of container `gitb-ui`.

An example log output to retrieve the administrator password is as follows: 
```
###############################################################################

The one-time password for the default administrator account [admin@itb] is:

b1afbc39-8ad7-49f4-a9d9-0bcec942aef4

###############################################################################
```

For information on how to proceed once you have logged in, you may refer to the Test Bed's [user guide](https://www.itb.ec.europa.eu/docs/itb-ta/latest/) 
and [sample usage tutorials](https://www.itb.ec.europa.eu/docs/guides/latest/definingYourTestConfiguration/index.html).
