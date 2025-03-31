#!/usr/bin/env python3

import glob as glob
import re
# import pandas lib as pd
import pandas as pd
#import string
import sys
import getopt
import urllib3 as urllib
import json

# the WHO GHO Country List
gho_country_list_url = "https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues"

participants_filename = "input/fsh/instances/participants.fsh"
endpoints_filename = "input/fsh/instances/endpoints.fsh"
gho_filename = "input/fsh/codesystems/gho_countries.fsh"
participants_valueset = "input/fsh/valuesets/Participants.fsh"



def usage():
    print("OPTIONS:")
    print(" none")
    print("--help|h : print this information")
    sys.exit(2)


def main():
    try:
        opts,args = getopt.getopt(sys.argv[1:], "h", ["help"])
    except getopt.GetoptError:
        usage()

    gho_country_list = load_remote_json(gho_country_list_url)
    extract_countries(gho_country_list)

def printout(content,filename):
    file = open(filename,"w")
    print(content, file=file)
    file.close


def load_remote_json(url):
    response = urllib.request("GET",url)
    return json.loads(response.data)


# the WHO GHO Country List
#{
  # "@odata.context": "https://ghoapi.azureedge.net/api/$metadata#Collection(Default.DIMENSION_VALUE)",
  # "value": [
  #   {
  #     "Code": "ABW",
  #     "Title": "Aruba",
  #     "ParentDimension": "REGION",
  #     "Dimension": "COUNTRY",
  #     "ParentCode": "AMR",
  #     "ParentTitle": "Americas"
  #   }, ...
#

def pp(json_content):
    return json.dumps(json_content, indent=2)

def escape(str):
    return str.replace('"', r'\"')

def load_participants():
    pattern = "^\\* \\$GHOCountryList#([A-Z]{3})"
    compiled_pattern = re.compile(pattern)
    matches = []
    with open(participants_valueset, 'r') as file:
        for line_num, line in enumerate(file,1):
            match = compiled_pattern.match(line)
            if (match):
                matches.append(match.group()[-3:])
    return  matches


def extract_countries(data):
    participants = load_participants()

    instances = ""
    endpoints = ""
    codes = "CodeSystem: GHOCountryList\n"
    codes += 'Title: "WHO GHO Jurisidiction List"\n'
    codes += 'Description: "CodeSystem for WHO Global Health Observatory (GHO) Country and Jurisidiction List available at ' + gho_country_list_url + '"\n'

    
    for country in data['value']:
        # print(pp(country))
        print("Processing " + country['Code'] + ' / ' + country['Title'])

        codes += "* #" + country['Code'] + ' "' + escape(country['Title']) + '"\n'

        if (country['Code']in participants):    
            participantid = "GDHCNParticipant-" + country['Code']            
            endpointreferences = ""
            
            didendpointid = "GDHCNParticipantDID-" + country['Code'] + "-All"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['Title']) + ' Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + '\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['Code'] + '/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"

            didendpointid = "GDHCNParticipantDID-" + country['Code'] + "-DSC"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['Title']) + ' Trustlist (DID v2) - Document Signing Certificates\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + ':DSC\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['Code'] + '/DSC/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"

            didendpointid = "GDHCNParticipantDID-" + country['Code'] + "-SCA"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['Title']) + ' Trustlist (DID v2) - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + ':DSC\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['Code'] + '/SCA/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['Code'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"
            
        
            instance = "Instance: " + participantid + "\n"
            instance += "InstanceOf: IHE.mCSD.Organization\n"
            instance += "Usage: #definition" + "\n"
            instance += '* name = "' + escape(country['Title']) + '"\n'
            instance += '* type = $orgType#govt\n'
            instance += endpointreferences 
            instance += '\n'
            instances += instance + "\n"

        
    printout(codes,gho_filename)
    printout(instances,participants_filename)
    printout(endpoints,endpoints_filename)



main()
