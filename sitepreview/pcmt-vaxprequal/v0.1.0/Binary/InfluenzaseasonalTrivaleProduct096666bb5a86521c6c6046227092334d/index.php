<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-InfluenzaseasonalTrivaleProduct096666bb5a86521c6c6046227092334d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
