<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-SmallpoxandMpoxvaccineLiProduct1b03f110ef15d36c9664465098d3adec.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
