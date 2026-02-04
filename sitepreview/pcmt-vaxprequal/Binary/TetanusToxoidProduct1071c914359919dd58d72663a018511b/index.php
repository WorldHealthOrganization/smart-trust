<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct1071c914359919dd58d72663a018511b.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
