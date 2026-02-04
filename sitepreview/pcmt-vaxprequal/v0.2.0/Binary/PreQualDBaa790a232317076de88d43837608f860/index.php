<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBaa790a232317076de88d43837608f860.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
