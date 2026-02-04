<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DengueTetravalentliveattProducta742565a0d07d6c92f087a1c055ab278.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
