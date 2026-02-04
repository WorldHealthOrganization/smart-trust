<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-MeaslesMumpsandRubellaProduct3e4662a10c91ed08c81f3163d43da4eb.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
