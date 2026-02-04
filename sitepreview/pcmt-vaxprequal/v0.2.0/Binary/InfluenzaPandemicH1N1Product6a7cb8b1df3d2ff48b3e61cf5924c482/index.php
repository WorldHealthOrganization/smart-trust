<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaPandemicH1N1Product6a7cb8b1df3d2ff48b3e61cf5924c482.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
