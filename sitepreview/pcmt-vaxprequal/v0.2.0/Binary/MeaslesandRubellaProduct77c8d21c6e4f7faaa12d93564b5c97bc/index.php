<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-MeaslesandRubellaProduct77c8d21c6e4f7faaa12d93564b5c97bc.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
