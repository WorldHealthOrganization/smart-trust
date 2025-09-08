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

# Environment-specific configuration
environment_configs = {
    "PROD": {
        "suffix": "",
        "description_suffix": "for Production environment",
        "participants_repo": "tng-participants-prod",
        "env_name": ""
    },
    "UAT": {
        "suffix": "-UAT",
        "description_suffix": "for User Acceptance Testing environment",
        "participants_repo": "tng-participants-uat",
        "env_name": " - UAT"
    },
    "DEV": {
        "suffix": "-DEV",
        "description_suffix": "for Development environment",
        "participants_repo": "tng-participants-dev",
        "env_name": " - DEV"
    }
}


def usage():
    print("OPTIONS:")
    print(" --env <environment> : specify environment (PROD, UAT, DEV). Default is PROD")
    print(" --help|h : print this information")
    sys.exit(2)


def load_refmart_from_file():
    """Load RefMart data from existing refmart_countries.fsh file"""
    countries = []
    try:
        with open('input/fsh/codesystems/refmart_countries.fsh', 'r') as file:
            for line in file:
                line = line.strip()
                if line.startswith('* #'):
                    # Parse line like: * #AFG "Afghanistan"
                    parts = line.split('"')
                    if len(parts) >= 2:
                        code = line.split('#')[1].split(' ')[0]
                        name = parts[1]
                        countries.append({
                            'CODE_ISO_3': code,
                            'NAME_SHORT_EN': name
                        })
    except FileNotFoundError:
        print("Warning: refmart_countries.fsh not found")
    
    return {'value': countries}


def main():
    environment = "PROD"  # default
    
    try:
        opts, args = getopt.getopt(sys.argv[1:], "he:", ["help", "env="])
    except getopt.GetoptError:
        usage()
    
    for opt, arg in opts:
        if opt in ("-h", "--help"):
            usage()
        elif opt in ("-e", "--env"):
            environment = arg.upper()
            if environment not in environment_configs:
                print(f"Error: Invalid environment '{environment}'. Must be one of: {', '.join(environment_configs.keys())}")
                sys.exit(1)

    config = environment_configs[environment]
    
    # Set environment-specific filenames
    suffix = config["suffix"]
    participants_filename = f"input/fsh/instances/participants{suffix}.fsh"
    endpoints_filename = f"input/fsh/instances/endpoints{suffix}.fsh"
    refmart_filename = f"input/fsh/codesystems/refmart_countries{suffix}.fsh"
    participants_valueset = f"input/fsh/valuesets/Participants{suffix}.fsh"
    
    print(f"Generating {environment} environment files...")
    print(f"Using config: {config}")
    
    # Use existing RefMart data instead of trying to fetch from remote
    if environment == "PROD":
        # For PROD, try to load from remote, fallback to local file
        try:
            refmart_country_list = load_remote_json(refmart_country_list_url)
        except:
            print("Warning: Could not load from remote, using local file")
            refmart_country_list = load_refmart_from_file()
    else:
        # For DEV and UAT, always use local file since we don't need to generate RefMart
        refmart_country_list = load_refmart_from_file()
    
    extract_countries(refmart_country_list, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset)

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

def load_participants(participants_valueset, environment="PROD"):
    """Load participants based on environment requirements"""
    if environment == "DEV":
        # For DEV, we would load from the DEV repo directly
        # Since we can't access the repo, we'll return the existing participants from the valueset
        # but the logic should be modified to include ALL participants from DEV repo
        pattern = "^\\* \\$([^#]+)#([A-Z]{3})"
    elif environment == "UAT":
        # For UAT, we would load participants that are NOT in RefMart
        pattern = "^\\* \\$([^#]+)#([A-Z]{3})"
    else:  # PROD
        pattern = "^\\* \\$RefMartCountryList#([A-Z]{3})"
    
    compiled_pattern = re.compile(pattern)
    matches = []
    try:
        with open(participants_valueset, 'r') as file:
            for line_num, line in enumerate(file,1):
                match = compiled_pattern.match(line)
                if (match):
                    if environment == "PROD":
                        matches.append(match.group()[-3:])
                    else:
                        matches.append(match.group(2))
    except FileNotFoundError:
        print(f"Warning: {participants_valueset} not found, starting with empty participant list")
    return  matches


def extract_countries(data, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset):
    environment = "PROD" if config["suffix"] == "" else config["suffix"][1:]  # Remove the "-" prefix
    participants = load_participants(participants_valueset, environment)
    print (participants)
    instances = ""
    endpoints = ""
    
    # Generate environment-specific CodeSystem
    suffix = config["suffix"]
    env_name = config["env_name"]
    description_suffix = config["description_suffix"]
    
    # Only generate RefMartCountryList for PROD environment
    if suffix == "":  # PROD environment
        codes = f"CodeSystem: RefMartCountryList{suffix}\n"
        codes += f'Title: "WHO RefMart Jurisidiction List{env_name}"\n'
        codes += f'Description: "CodeSystem for WHO Refmart Country and Jurisidiction List available at {refmart_country_list_url} {description_suffix}"\n'
        codes += f'* ^url = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY{suffix}"\n'
    else:
        # For DEV and UAT, don't generate RefMartCountryList
        codes = ""
    
def extract_countries(data, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset):
    environment = "PROD" if config["suffix"] == "" else config["suffix"][1:]  # Remove the "-" prefix
    participants = load_participants(participants_valueset, environment)
    print(f"Environment: {environment}")
    print(f"Participants: {participants}")
    instances = ""
    endpoints = ""
    
    # Generate environment-specific CodeSystem
    suffix = config["suffix"]
    env_name = config["env_name"]
    description_suffix = config["description_suffix"]
    
    # Only generate RefMartCountryList for PROD environment
    if suffix == "":  # PROD environment
        codes = f"CodeSystem: RefMartCountryList{suffix}\n"
        codes += f'Title: "WHO RefMart Jurisidiction List{env_name}"\n'
        codes += f'Description: "CodeSystem for WHO Refmart Country and Jurisidiction List available at {refmart_country_list_url} {description_suffix}"\n'
        codes += f'* ^experimental = true\n'
        codes += f'* ^caseSensitive = false\n'
        codes += f'* ^url = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY{suffix}"\n'
        
        # For PROD, process RefMart data normally
        for country in data['value']:
            print("Processing " + country['CODE_ISO_3'] + ' / ' + country['NAME_SHORT_EN'])
            codes += "* #" + country['CODE_ISO_3'] + ' "' + escape(country['NAME_SHORT_EN']) + '"\n'
            
            if (country['CODE_ISO_3'] in participants):    
                instances += generate_participant_instance(country, config)
                endpoints += generate_participant_endpoints(country, config)
    
    else:
        # For DEV and UAT, don't generate RefMartCountryList, but do generate participant instances
        codes = ""  # No RefMart codes for DEV/UAT
        
        if environment == "DEV":
            # For DEV: Include all participants from the DEV repo (simulate with RefMart data for now)
            # In real implementation, this would query the DEV repository directly
            for country in data['value']:
                if (country['CODE_ISO_3'] in participants):
                    print(f"Processing DEV participant: {country['CODE_ISO_3']} / {country['NAME_SHORT_EN']}")
                    instances += generate_participant_instance(country, config)
                    endpoints += generate_participant_endpoints(country, config)
        
        elif environment == "UAT":
            # For UAT: Only include participants that are NOT in RefMart
            # This logic would need to be refined based on actual participant repo content
            refmart_codes = {country['CODE_ISO_3'] for country in data['value']}
            for country in data['value']:
                if (country['CODE_ISO_3'] in participants and country['CODE_ISO_3'] not in refmart_codes):
                    print(f"Processing UAT participant (not in RefMart): {country['CODE_ISO_3']} / {country['NAME_SHORT_EN']}")
                    instances += generate_participant_instance(country, config)
                    endpoints += generate_participant_endpoints(country, config)
        
    # Only generate RefMartCountryList file for PROD environment
    if suffix == "":  # PROD environment
        printout(codes, refmart_filename)
    
    printout(instances, participants_filename)
    printout(endpoints, endpoints_filename)


def generate_participant_instance(country, config):
    """Generate a participant organization instance"""
    suffix = config["suffix"]
    participantid = f"GDHCNParticipant-{country['CODE_ISO_3']}{suffix}"
    
    instance = "Instance: " + participantid + "\n"
    instance += "InstanceOf: IHE.mCSD.Organization\n"
    instance += "Usage: #definition" + "\n"
    instance += '* name = "' + escape(country['NAME_SHORT_EN']) + '"\n'
    instance += '* type = $orgType#govt\n'
    instance += f"* endpoint[+] = Reference(GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-All)\n"
    instance += f"* endpoint[+] = Reference(GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-DSC)\n"
    instance += f"* endpoint[+] = Reference(GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-SCA)\n"
    instance += '\n'
    return instance + "\n"


def generate_participant_endpoints(country, config):
    """Generate participant endpoints"""
    suffix = config["suffix"]
    env_name = config["env_name"]
    
    # Determine base URL based on environment
    if suffix == "":  # PROD
        base_url = "http://tng-cdn.who.int"
    elif suffix == "-UAT":
        base_url = "http://tng-cdn-uat.who.int"
    else:  # DEV
        base_url = "http://tng-cdn-dev.who.int"
    
    endpoints = ""
    
    # All keys endpoint
    didendpointid = f"GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-All"
    endpoint =  "Instance: " + didendpointid + "\n"
    endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
    endpoint += f'Description: "{escape(country["NAME_SHORT_EN"])} Trustlist (DID v2){env_name} - All keys\\ndid:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}\\nresolvable at {base_url}/v2/trustlist/-/{country["CODE_ISO_3"]}/did.json"\n'
    endpoint += "Usage: #definition" + "\n"
    endpoint += f'* name = "{escape(country["NAME_SHORT_EN"])} Trustlist (DID v2){env_name} - All keys\\ndid:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}\\nresolvable at {base_url}/v2/trustlist/-/{country["CODE_ISO_3"]}/did.json"\n'
    endpoint += f"* managingOrganization = Reference(Organization/GDHCNParticipant-{country['CODE_ISO_3']}{suffix})\n"
    endpoint += "* status = #active\n"
    endpoint += "* connectionType = $ConnectionTypes#http-get\n"
    endpoint += "* payloadMimeType = #application/did\n"
    endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
    endpoint += f'* address = "did:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}"\n'
    endpoints += endpoint + "\n"
    
    # DSC endpoint
    didendpointid = f"GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-DSC"
    endpoint =  "Instance: " + didendpointid + "\n"
    endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
    endpoint += "Usage: #definition" + "\n"
    endpoint += f'* name = "{escape(country["NAME_SHORT_EN"])} Trustlist (DID v2){env_name} - Document Signing Certificates\\ndid:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}:DSC\\nresolvable at {base_url}/v2/trustlist/-/{country["CODE_ISO_3"]}/DSC/did.json"\n'
    endpoint += f"* managingOrganization = Reference(Organization/GDHCNParticipant-{country['CODE_ISO_3']}{suffix})\n"
    endpoint += "* status = #active\n"
    endpoint += "* connectionType = $ConnectionTypes#http-get\n"
    endpoint += "* payloadMimeType = #application/did\n"
    endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
    endpoint += f'* address = "did:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}"\n'
    endpoints += endpoint + "\n"
    
    # SCA endpoint  
    didendpointid = f"GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-SCA"
    endpoint =  "Instance: " + didendpointid + "\n"
    endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
    endpoint += "Usage: #definition" + "\n"
    endpoint += f'* name = "{escape(country["NAME_SHORT_EN"])} Trustlist (DID v2){env_name} - Certificate Signing Authority\\ndid:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}:DSC\\nresolvable at {base_url}/v2/trustlist/-/{country["CODE_ISO_3"]}/SCA/did.json"\n'
    endpoint += f"* managingOrganization = Reference(Organization/GDHCNParticipant-{country['CODE_ISO_3']}{suffix})\n"
    endpoint += "* status = #active\n"
    endpoint += "* connectionType = $ConnectionTypes#http-get\n"
    endpoint += "* payloadMimeType = #application/did\n"
    endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
    endpoint += f'* address = "did:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}"\n'
    endpoints += endpoint + "\n"
    
    return endpoints



main()
