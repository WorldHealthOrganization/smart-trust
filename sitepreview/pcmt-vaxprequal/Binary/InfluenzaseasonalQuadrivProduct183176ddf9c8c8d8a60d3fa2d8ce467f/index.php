<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-InfluenzaseasonalQuadrivProduct183176ddf9c8c8d8a60d3fa2d8ce467f.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
