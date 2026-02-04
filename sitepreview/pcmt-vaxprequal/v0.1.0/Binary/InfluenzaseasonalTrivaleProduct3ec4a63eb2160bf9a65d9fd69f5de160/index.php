<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct3ec4a63eb2160bf9a65d9fd69f5de160.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
