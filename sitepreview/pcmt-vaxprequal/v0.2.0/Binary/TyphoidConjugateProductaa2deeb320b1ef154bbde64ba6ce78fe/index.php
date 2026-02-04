<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TyphoidConjugateProductaa2deeb320b1ef154bbde64ba6ce78fe.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
