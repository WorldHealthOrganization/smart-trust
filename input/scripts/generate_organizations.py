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
    country_resources = extract_countries(gho_country_list)

    participants_file = open(participants_filename,"w")
    print(country_resources,file=participants_file)
    participants_file.close() 


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
    for country in data['value']:
        # print(pp(country))
        print("Processing " + country['Code'] + ' / ' + country['Title'])
        participantid = "TNGPartcipant-" + country['Code']
        instance = "Instance: " + participantid + "\n"
        instance += "InstanceOf: IHE.mCSD.Organization\n"
        instance += "Usage: #definition" + "\n"
        instance += '* title = "' + escape(country["Title"]) + '"\n'
        instance += '* status = $pubStatus#active\n'
        instance += '* name = "' + escape(country['Title']) + '"\n'
        instance += '* publisher = "WHO"\n'
        instance += '* experimental = true\n'
        instance += '* description = "' + escape(country['Title']) +'\n'
        instances += instance + "\n"
        
    return instances




main()
