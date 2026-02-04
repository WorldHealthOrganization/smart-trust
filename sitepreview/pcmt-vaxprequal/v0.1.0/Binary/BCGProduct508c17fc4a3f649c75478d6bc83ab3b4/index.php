<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-BCGProduct508c17fc4a3f649c75478d6bc83ab3b4.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
