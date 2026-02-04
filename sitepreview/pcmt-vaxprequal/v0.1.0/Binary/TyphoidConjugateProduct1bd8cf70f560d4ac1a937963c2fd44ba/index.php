<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TyphoidConjugateProduct1bd8cf70f560d4ac1a937963c2fd44ba.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
