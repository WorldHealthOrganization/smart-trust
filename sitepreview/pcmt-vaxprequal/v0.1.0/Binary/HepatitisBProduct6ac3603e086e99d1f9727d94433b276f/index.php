<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBProduct6ac3603e086e99d1f9727d94433b276f.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
