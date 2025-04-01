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

# the WHO RefMart Country List
refmart_country_list_url = "https://xmart-api-public.who.int/REFMART/REF_COUNTRY"

participants_filename = "input/fsh/instances/participants.fsh"
endpoints_filename = "input/fsh/instances/endpoints.fsh"
refmart_filename = "input/fsh/codesystems/refmart_countries.fsh"
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

    refmart_country_list = load_remote_json(refmart_country_list_url)
    extract_countries(refmart_country_list)

def printout(content,filename):
    file = open(filename,"w")
    print(content, file=file)
    file.close


def load_remote_json(url):
    response = urllib.request("GET",url)
    return json.loads(response.data)


# the WHO refmart Country List
#{
  # "@odata.context": "https://xmart-api-public.who.int/REFMART/$metadata#REF_COUNTRY",
  # "value": [
  # "GEO_M49_CODE": "004",
  # "CODE_ISO_2": "AF",
  # "CODE_ISO_3": "AFG",
  # "CODE_WHO": "AFG",
  # "CODE_ISO_NUMERIC": 4,
  # "NAME_SHORT_EN": "Afghanistan",
  # "NAME_FORMAL_EN": "the Islamic Republic of  Afghanistan",
  # "CAPITAL_CITY": "Kabul",
  # "ADJECTIVE_PEOPLE": "Afghan",
  # "GEO_SMALL_POP_FLAG": false,
  # "GEO_SOVEREIGN": null,
  # "SOVEREIGN_ISO_3": null,
  # "GRP_WB_INCOME": "LIC",
  # "GRP_WHO_REGION": "EMR",
  # "WHO_LEGAL_STATUS": "M",
  # "WHO_LEGAL_STATUS_TITLE": "Member State",
  # "DATE_START": null,
  # "NAME_CHANGE": null,
  # "ISO_CHANGE": null,
  # "CAPITAL_CHANGE": null,
  # "STATISTICAL_CHANGE": null,
  # "GEO_PRECEDED_BY": null,
  # "GEO_SUCCEEDED_BY": null,
  # "NAME_SHORT_AR": "أفغانستان",
  # "NAME_FORMAL_AR": "جمهورية أفغانستان الإسلامية",
  # "NAME_SHORT_ES": "Afganistán",
  # "NAME_FORMAL_ES": "República Islámica del Afganistán",
  # "NAME_SHORT_FR": "Afghanistan",
  # "NAME_FORMAL_FR": "République islamique d'Afghanistan",
  # "NAME_SHORT_RU": "Афганистан",
  # "NAME_FORMAL_RU": "Исламская Республика Афганистан",
  # "NAME_SHORT_ZH": "阿富汗",
  # "NAME_FORMAL_ZH": "阿富汗伊斯兰共和国"
  # }...
#

def pp(json_content):
    return json.dumps(json_content, indent=2)

def escape(str):
    return str.replace('"', r'\"')

def load_participants():
    pattern = "^\\* \\$RefmartCountryList#([A-Z]{3})"
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
    codes = "CodeSystem: RefMartCountryList\n"
    codes += 'Title: "WHO RefMart Jurisidiction List"\n'
    codes += 'Description: "CodeSystem for WHO Refmart Country and Jurisidiction List available at ' + refmart_country_list_url + '"\n'
    codes += '* ^url = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"\n'
    
    for country in data['value']:
        # print(pp(country))
        print("Processing " + country['CODE_ISO_3'] + ' / ' + country['NAME_SHORT_EN'])

        codes += "* #" + country['CODE_ISO_3'] + ' "' + escape(country['NAME_SHORT_EN']) + '"\n'

        if (country['CODE_ISO_3']in participants):    
            participantid = "GDHCNParticipant-" + country['CODE_ISO_3']            
            endpointreferences = ""
            
            didendpointid = "GDHCNParticipantDID-" + country['CODE_ISO_3'] + "-All"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['NAME_SHORT_EN']) + ' Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + '\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['CODE_ISO_3'] + '/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"

            didendpointid = "GDHCNParticipantDID-" + country['CODE_ISO_3'] + "-DSC"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['NAME_SHORT_EN']) + ' Trustlist (DID v2) - Document Signing Certificates\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + ':DSC\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['CODE_ISO_3'] + '/DSC/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"

            didendpointid = "GDHCNParticipantDID-" + country['CODE_ISO_3'] + "-SCA"
            endpoint =  "Instance: " + didendpointid + "\n"
            endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
            endpoint += "Usage: #definition" + "\n"
            endpoint += '* name = "' + escape(country['NAME_SHORT_EN']) + ' Trustlist (DID v2) - Certificate Signing Authority\ndid:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + ':DSC\nresolvable at http://tng-cdn.who.int/v2/trustlist/-/' + country['CODE_ISO_3'] + '/SCA/did.json"\n'
            endpoint += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
            endpoint += "* status = #active\n"
            endpoint += "* connectionType = $ConnectionTypes#http-get\n"
            endpoint += "* payloadMimeType = #application/did\n"
            endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
            endpoint += '* address = "did:web:tng-cdn.who.int:v2:trustlist:-:' + country['CODE_ISO_3'] + '"\n'            
            endpoints += endpoint + "\n"
            endpointreferences += "* endpoint[+] = Reference(" + didendpointid + ")\n"
            
        
            instance = "Instance: " + participantid + "\n"
            instance += "InstanceOf: IHE.mCSD.Organization\n"
            instance += "Usage: #definition" + "\n"
            instance += '* name = "' + escape(country['NAME_SHORT_EN']) + '"\n'
            instance += '* type = $orgType#govt\n'
            instance += endpointreferences 
            instance += '\n'
            instances += instance + "\n"

        
    printout(codes,refmart_filename)
    printout(instances,participants_filename)
    printout(endpoints,endpoints_filename)



main()
