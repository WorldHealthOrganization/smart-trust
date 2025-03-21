CodeSystem: ConnectionTypes
Title:        "WHO GDHCN Connection Types"
Description:  """
CodeSystem for GDHCN connection types"""

* ^experimental = true
* ^caseSensitive = false
* ^status = #active

* #http-get "http-get" "http(s) GET request"
* #mtls "mTLS" "mutual TLS (mTLS)"

