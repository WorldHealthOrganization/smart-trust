<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-PreQualDBa1b8577c56035c4ad388e6a93986a21e.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
