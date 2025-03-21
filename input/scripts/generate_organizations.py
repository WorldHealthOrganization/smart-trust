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
gho_filename = "input/fsh/codesystems/gho_countries.fsh"




def usage():
    print("Usage: scans input/system-requirements for excel sheets ")
    print("where the referenced excel contains a sheet entitled 'Non-functional'")
    print("and one entitled 'Functional' which contain the requirements.")
    print("The header row of the 'Non-functional' sheet should contain: ")
    print("   " , ', '.join(nonfunctional_headers))
    print("The header row of the 'Functional' sheet should contain: ")
    print("   " , ', '.join(nonfunctional_headers))
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


def extract_countries(data):
    instances = ""
    codes = "CodeSystem: GHOCountryList\n"
    codes += 'Title: "WHO GHO Country List"\n'
    codes += 'Description: "WHO Global Health Observatory (GHO) Country List"\n'

    
    for country in data['value']:
        # print(pp(country))
        print("Processing " + country['Code'] + ' / ' + country['Title'])

        codes += "* #" + country['Code'] + ' "' + escape(country['Title']) + '"\n'

        
        participantid = "TNGParticipant-" + country['Code']
        didendpointid = "TNGParticipantDID-" + country['Code']
        instance = "Instance: " + participantid + "\n"
        instance += "InstanceOf: IHE.mCSD.Organization\n"
        instance += "Usage: #definition" + "\n"
        instance += '* name = "' + escape(country['Title']) + '"\n'
        instance += '* type = $orgType#govt\n'
        instance += '\n'
        instance =  "Instance: " + didendpointid + "\n"
        instance += "InstanceOf: IHE.mCSD.Endpoint\n"
        instance += "Usage: #definition" + "\n"        
        instance += "* managingOrganization = Reference(Organization/" + participantid + ")\n"
        instance += "* status = #active\n"
        instance += "* connectionType = $ConnectionTypes#trustlist\n"
        instance += "* payloadMimeType = #application/did\n"
        instance += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
        instance += '* address = "http://tng-cdn.who.int/v2/trustlist/-/' + country['Code'] + '/did.json"\n'
        
        instances += instance + "\n"


        
    printout(codes,gho_filename)
    printout(instances,participants_filename)



main()
