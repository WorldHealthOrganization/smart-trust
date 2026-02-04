<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDB5256bec4bd8bae0e45743e9d569db466.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
