<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalTrivaleProductbc5b1b4b2ba40fb3b9743077a086766e.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
