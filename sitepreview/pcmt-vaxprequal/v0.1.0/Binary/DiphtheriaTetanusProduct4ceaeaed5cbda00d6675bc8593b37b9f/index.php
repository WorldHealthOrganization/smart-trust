<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusProduct4ceaeaed5cbda00d6675bc8593b37b9f.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
