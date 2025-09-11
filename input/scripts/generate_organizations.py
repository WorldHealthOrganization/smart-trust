#!/usr/bin/env python3

import glob as glob
import re
# import pandas lib as pd
# import pandas as pd
#import string
import sys
import getopt
import urllib3 as urllib
import json
import requests
import base64
from cryptography import x509
from cryptography.x509.oid import ExtensionOID, NameOID

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
    print(" --source <source> : specify participant source (local|github-api). Default is local")
    print(" --help|h : print this information")
    sys.exit(2)


def load_refmart_from_file():
    """Load RefMart data from existing RefMartCountryList.fsh file"""
    countries = []
    try:
        with open('input/fsh/codesystems/RefMartCountryList.fsh', 'r', encoding='utf-8') as file:
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
        print("Warning: RefMartCountryList.fsh not found")
    
    return {'value': countries}


def find_pem_file_in_directory(repo, path, depth=0, max_depth=4):
    """Recursively search for CA.pem, TLS.pem or other .pem files in a directory"""
    print(f"[SEARCH] Searching in directory: {path} (depth {depth})")
    
    if depth > max_depth:
        print(f"[SEARCH] Max depth reached, stopping search")
        return None
    
    try:
        url = f"https://api.github.com/repos/WorldHealthOrganization/{repo}/contents/{path}"
        print(f"[SEARCH] Fetching contents from: {url}")
        
        response = requests.get(url)
        if response.status_code != 200:
            print(f"[SEARCH] ERROR: Failed to fetch directory contents. Status: {response.status_code}")
            return None
            
        contents = response.json()
        print(f"[SEARCH] Found {len(contents)} items in {path}")
        
        # Log all files and directories found
        files = []
        directories = []
        for item in contents:
            if item['type'] == 'file':
                files.append(item['name'])
                # Check if this is a PEM file we're looking for
                # Look for files named CA.pem, TLS.pem, or any .pem file
                if item['name'] in ['CA.pem', 'TLS.pem'] or item['name'].endswith('.pem'):
                    print(f"[SEARCH] ✓ Found PEM file: {item['path']}")
                    return item
            else:
                directories.append(item['name'])
        
        print(f"[SEARCH] Files in {path}: {files}")
        print(f"[SEARCH] Directories in {path}: {directories}")
        
        # If no PEM file found at this level, search subdirectories
        for item in contents:
            if item['type'] == 'dir':
                pem_file = find_pem_file_in_directory(repo, item['path'], depth + 1, max_depth)
                if pem_file:
                    return pem_file
        
        return None
        
    except Exception as e:
        print(f"[SEARCH] ERROR: Exception while searching {path}: {e}")
        return None


def fetch_participant_locality_from_github(repo, participant_code):
    """Fetch participant locality name from CA.pem, TLS.pem or other .pem file in GitHub repository"""
    print(f"\n=== LOCALITY EXTRACTION LOG for {participant_code} ===")
    try:
        # Recursively search for CA.pem, TLS.pem or other .pem files in participant directory
        pem_file = find_pem_file_in_directory(repo, participant_code)
        
        if not pem_file:
            print(f"[STEP 2] ERROR: No CA.pem, TLS.pem or other .pem file found for participant {participant_code}")
            return None
        
        print(f"[STEP 2] SUCCESS: Using PEM file: {pem_file['path']}")
        
        # Fetch the PEM file content
        pem_url = pem_file['download_url']
        print(f"[STEP 3] Fetching PEM file content from: {pem_url}")
        
        pem_response = requests.get(pem_url)
        print(f"[STEP 3] PEM file HTTP Response Status: {pem_response.status_code}")
        
        if pem_response.status_code != 200:
            print(f"[STEP 3] ERROR: Failed to fetch PEM file. Status: {pem_response.status_code}")
            return None
            
        pem_response.raise_for_status()
        
        pem_content_text = pem_response.text
        print(f"[STEP 3] SUCCESS: Downloaded PEM file, size: {len(pem_content_text)} characters")
        print(f"[STEP 3] PEM file starts with: {pem_content_text[:100]}...")
        
        # Parse the certificate to extract locality name
        print(f"[STEP 4] Attempting to parse X.509 certificate...")
        pem_content = pem_content_text.encode('utf-8')
        
        try:
            cert = x509.load_pem_x509_certificate(pem_content)
            print(f"[STEP 4] SUCCESS: Certificate loaded successfully")
        except Exception as cert_error:
            print(f"[STEP 4] ERROR: Failed to parse certificate: {cert_error}")
            # Try to determine if this looks like a certificate
            if "BEGIN CERTIFICATE" in pem_content_text:
                print(f"[STEP 4] Certificate markers found but parsing failed")
            else:
                print(f"[STEP 4] No certificate markers found in PEM content")
            return None
        
        # Extract locality name from subject
        print(f"[STEP 5] Extracting subject information from certificate...")
        subject = cert.subject
        print(f"[STEP 5] Certificate subject: {subject}")
        
        # Log all subject attributes
        subject_attributes = []
        locality_found = None
        
        for attribute in subject:
            attr_name = attribute.oid._name if hasattr(attribute.oid, '_name') else str(attribute.oid)
            attr_value = attribute.value
            subject_attributes.append(f"{attr_name}: {attr_value}")
            
            if attribute.oid == NameOID.LOCALITY_NAME:
                locality_found = attribute.value
                print(f"[STEP 5] ✓ LOCALITY NAME FOUND: {locality_found}")
        
        print(f"[STEP 5] All subject attributes: {subject_attributes}")
        
        if locality_found:
            print(f"[STEP 6] SUCCESS: Extracted locality for {participant_code}: '{locality_found}'")
            print(f"=== END LOCALITY EXTRACTION LOG for {participant_code} ===\n")
            return locality_found
        else:
            print(f"[STEP 6] ERROR: No locality name (localityName) found in certificate subject")
            print(f"[STEP 6] Available subject fields: {[attr.split(':')[0] for attr in subject_attributes]}")
            print(f"=== END LOCALITY EXTRACTION LOG for {participant_code} ===\n")
            return None
        
    except requests.RequestException as e:
        print(f"[ERROR] Network/HTTP error fetching data for {participant_code}: {e}")
        print(f"=== END LOCALITY EXTRACTION LOG for {participant_code} ===\n")
        return None
    except Exception as e:
        print(f"[ERROR] Unexpected error processing {participant_code}: {e}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        print(f"=== END LOCALITY EXTRACTION LOG for {participant_code} ===\n")
        return None


def fetch_participants_from_github(environment):
    """Fetch participant directory names from GitHub repository"""
    repo_mapping = {
        "PROD": "tng-participants-prod",
        "UAT": "tng-participants-uat", 
        "DEV": "tng-participants-dev"
    }
    
    repo = repo_mapping.get(environment)
    if not repo:
        print(f"Error: Unknown environment '{environment}'")
        return []
    
    try:
        url = f"https://api.github.com/repos/WorldHealthOrganization/{repo}/contents"
        print(f"Fetching participants from: {url}")
        
        response = requests.get(url)
        response.raise_for_status()
        
        contents = response.json()
        
        # Filter for directories that match participant pattern: 3 letters, optionally followed by -[A-Z]+
        participant_pattern = re.compile(r'^[A-Z]{3}(-[A-Z]+)*$')
        participants = []
        
        for item in contents:
            if item['type'] == 'dir' and participant_pattern.match(item['name']):
                participants.append(item['name'])
        
        participants.sort()
        print(f"Found {len(participants)} participants in {repo}: {participants}")
        return participants
        
    except requests.RequestException as e:
        print(f"Error fetching participants from GitHub: {e}")
        return []
    except Exception as e:
        print(f"Error processing GitHub response: {e}")
        return []


def fetch_participants_with_localities_from_github(environment):
    """Fetch participant directory names with their locality names from GitHub repository"""
    print(f"\n=== FETCHING PARTICIPANTS WITH LOCALITIES for {environment} ===")
    
    repo_mapping = {
        "PROD": "tng-participants-prod",
        "UAT": "tng-participants-uat", 
        "DEV": "tng-participants-dev"
    }
    
    repo = repo_mapping.get(environment)
    if not repo:
        print(f"ERROR: Unknown environment '{environment}'")
        return {}
    
    print(f"Target repository: {repo}")
    
    # First get the list of participants
    print(f"[PHASE 1] Getting list of participants from {repo}")
    participants = fetch_participants_from_github(environment)
    
    if not participants:
        print(f"[PHASE 1] ERROR: No participants found, falling back to static data")
        return fetch_participants_with_localities_from_static_data(environment)
    
    print(f"[PHASE 1] SUCCESS: Found {len(participants)} participants: {participants}")
    
    # Then fetch locality names for each participant
    print(f"[PHASE 2] Extracting locality names from PEM certificates for each participant")
    participants_with_localities = {}
    successful_extractions = 0
    failed_extractions = 0
    
    for i, participant_code in enumerate(participants, 1):
        print(f"\n[PHASE 2] Processing participant {i}/{len(participants)}: {participant_code}")
        locality = fetch_participant_locality_from_github(repo, participant_code)
        
        if locality:
            participants_with_localities[participant_code] = locality
            successful_extractions += 1
            print(f"[PHASE 2] ✓ SUCCESS: {participant_code} -> '{locality}'")
        else:
            # Fallback to environment + participant format if locality can't be extracted
            fallback_name = f"{environment} Participant {participant_code}"
            participants_with_localities[participant_code] = fallback_name
            failed_extractions += 1
            print(f"[PHASE 2] ✗ FAILED: {participant_code} -> fallback to '{fallback_name}'")
    
    print(f"\n[PHASE 2] SUMMARY:")
    print(f"  - Total participants processed: {len(participants)}")
    print(f"  - Successful locality extractions: {successful_extractions}")
    print(f"  - Failed extractions (using fallback): {failed_extractions}")
    print(f"  - Success rate: {(successful_extractions/len(participants)*100):.1f}%")
    
    print(f"\n[FINAL RESULT] Participants with localities:")
    for code, locality in sorted(participants_with_localities.items()):
        print(f"  {code}: '{locality}'")
    
    print(f"=== END FETCHING PARTICIPANTS WITH LOCALITIES for {environment} ===\n")
    
    return participants_with_localities


def fetch_participants_from_static_data(environment):
    """Fetch participant directory names using static data from GitHub API responses"""
    
    # Static data based on actual GitHub API responses (as of the time of this script)
    dev_participants = [
        "AND", "ARG", "ARM", "BHS", "BLZ", "BRA", "BRB", "CHL", "COL", "CRI", 
        "CYP", "DOM", "ECU", "EST", "GTM", "HND", "IDN", "LVA", "OMN", "PAN", 
        "PER", "PRY", "SGP", "SLV", "SMR", "SUR", "SVN", "TGO", "URY", "USA", 
        "WHO", "XCL", "XML", "XXA", "XXB", "XXC", "XXD", "XXE", "XXF", "XXG", "XXH", 
        "XXI", "XXJ", "XXK", "XXO", "XXP", "XXU", "XXV", "XXX", "XYK"
    ]
    
    uat_participants = [
        "ALB", "AND", "ARM", "BEL", "BEN", "BRA", "CAN", "CYP", "CZE", "ESP", 
        "EST", "FIN", "FRA", "FRO", "HRV", "IDN", "IRL", "LTU", "LVA", "MCO", 
        "MLT", "MYS", "NLD", "NZL", "OMN", "POL", "PRT", "SAU", "SGP", "SMR", 
        "SVK", "SVN", "SWE", "TGO", "THA", "TUR", "WHO", "XXA", "XXB", "XXC", "XXD", 
        "XXO", "XXS", "XXU", "XXV", "XXX", "XYK"
    ]
    
    if environment == "DEV":
        print(f"Using static data for DEV: Found {len(dev_participants)} participants")
        return dev_participants
    elif environment == "UAT":
        print(f"Using static data for UAT: Found {len(uat_participants)} participants") 
        return uat_participants
    elif environment == "PROD":
        # For PROD, we don't use this function - it uses RefMart data
        return []
    else:
        print(f"Error: Unknown environment '{environment}'")
        return []


def fetch_participants_with_localities_from_static_data(environment):
    """Fetch participant directory names with fallback format when GitHub API is unavailable"""
    print(f"\n=== USING STATIC FALLBACK DATA for {environment} ===")
    print(f"GitHub API is unavailable, using fallback format for all participants")
    print(f"Note: Locality names should be extracted dynamically from PEM certificates when GitHub API is available")
    
    participants = fetch_participants_from_static_data(environment)
    
    participants_with_localities = {}
    
    for participant_code in participants:
        # Use participant format as fallback when GitHub API is unavailable
        # This ensures localities are extracted dynamically from PEM certificates when API is accessible
        fallback_name = f"{environment} Participant {participant_code}"
        participants_with_localities[participant_code] = fallback_name
        print(f"[STATIC] {participant_code} -> '{fallback_name}' (fallback format - localities should come from PEM certificates)")
    
    print(f"\n[STATIC SUMMARY]:")
    print(f"  - Total participants: {len(participants)}")
    print(f"  - All using fallback format: {len(participants)}")
    print(f"  - For actual locality names, ensure GitHub API access to extract from PEM certificates")
    print(f"=== END STATIC FALLBACK DATA for {environment} ===\n")
    
    return participants_with_localities


def main():
    environment = "PROD"  # default
    participant_source = "local"  # default
    
    try:
        opts, args = getopt.getopt(sys.argv[1:], "he:s:", ["help", "env=", "source="])
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
        elif opt in ("-s", "--source"):
            participant_source = arg.lower()
            if participant_source not in ["local", "github-api"]:
                print(f"Error: Invalid source '{participant_source}'. Must be one of: local, github-api")
                sys.exit(1)

    config = environment_configs[environment]
    
    # Set environment-specific filenames
    suffix = config["suffix"]
    participants_filename = f"input/fsh/instances/participants{suffix}.fsh"
    endpoints_filename = f"input/fsh/instances/endpoints{suffix}.fsh"
    refmart_filename = f"input/fsh/codesystems/RefMartCountryList{suffix}.fsh"
    participants_valueset = f"input/fsh/valuesets/Participants{suffix}.fsh"
    
    print(f"Generating {environment} environment files...")
    print(f"Using config: {config}")
    print(f"Participant source: {participant_source}")
    
    # Load RefMart data based on environment requirements
    if environment == "PROD":
        # For PROD, try to load from remote, fallback to local file
        try:
            refmart_country_list = load_remote_json(refmart_country_list_url)
        except:
            print("Warning: Could not load from remote, using local file")
            refmart_country_list = load_refmart_from_file()
    elif environment in ["UAT", "DEV"]:
        # For UAT and DEV, load PROD's RefMart to check against existing participants
        refmart_country_list = load_refmart_from_file()
    else:
        refmart_country_list = None
    
    # Get participants based on source
    if participant_source == "github-api":
        if environment in ["DEV", "UAT"]:
            # For DEV and UAT, fetch participants with their locality names from PEM files
            participants_with_localities = fetch_participants_with_localities_from_github(environment)
            # If GitHub API fails (e.g., due to firewall), fallback to static data
            if not participants_with_localities:
                print("GitHub API failed, falling back to static data")
                participants_with_localities = fetch_participants_with_localities_from_static_data(environment)
            extract_countries_from_api_with_localities(refmart_country_list, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset, participants_with_localities)
        else:
            # For PROD, use the original approach
            participants_from_api = fetch_participants_from_github(environment)
            # If GitHub API fails (e.g., due to firewall), fallback to static data
            if not participants_from_api:
                print("GitHub API failed, falling back to static data")
                participants_from_api = fetch_participants_from_static_data(environment)
            extract_countries_from_api(refmart_country_list, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset, participants_from_api)
    else:
        extract_countries(refmart_country_list, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset)

def printout(content,filename):
    """Write content to file with proper UTF-8 encoding"""
    with open(filename, "w", encoding='utf-8') as file:
        print(content, file=file)


def load_remote_json(url):
    """Load JSON data from a URL with proper UTF-8 encoding handling"""
    http = urllib.PoolManager()
    response = http.request("GET", url)
    
    if response.status != 200:
        raise Exception(f"HTTP {response.status}: Failed to fetch data from {url}")
    
    # Properly decode the response data as UTF-8 before parsing JSON
    json_data = json.loads(response.data.decode('utf-8'))
    return json_data


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



def extract_countries_from_api_with_localities(data, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset, participants_with_localities):
    """Extract countries using participants with locality names fetched from GitHub API and PEM files"""
    environment = "PROD" if config["suffix"] == "" else config["suffix"][1:]  # Remove the "-" prefix
    print(f"\n=== PROCESSING PARTICIPANTS WITH LOCALITIES for {environment} ===")
    print(f"Environment: {environment}")
    print(f"Received {len(participants_with_localities)} participants with localities:")
    
    for code, locality in sorted(participants_with_localities.items()):
        print(f"  {code}: '{locality}'")
    
    instances = ""
    endpoints = ""
    valueset_entries = ""
    
    # Generate environment-specific CodeSystem
    suffix = config["suffix"]
    env_name = config["env_name"]
    description_suffix = config["description_suffix"]
    
    # For DEV and UAT, generate Participants CodeSystem for codes NOT in RefMart
    codes = f"CodeSystem: Participants{suffix}\n"
    codes += f'Title: "WHO GDHCN Trust Network Participant{env_name}"\n'
    codes += f'Description: "CodeSystem for GDHCN Trust Network Participants {description_suffix}"\n'
    codes += f'* ^experimental = true\n'
    codes += f'* ^caseSensitive = false\n'
    codes += f'* ^url = "http://smart.who.int/trust/CodeSystems/Participants{suffix}"\n'
    
    processed_count = 0
    refmart_participants = []  # Track participants found in RefMart
    
    if environment in ["DEV", "UAT"]:
        print(f"[{environment} PROCESSING] NEW LOGIC: Using RefMart for existing codes, adding only new codes to Participants{suffix}")
        
        # Get RefMart codes if available
        refmart_codes = set()
        refmart_country_dict = {}
        if data and 'value' in data:
            refmart_codes = {country['CODE_ISO_3'] for country in data['value']}
            refmart_country_dict = {country['CODE_ISO_3']: country for country in data['value']}
            print(f"[{environment}] RefMart contains {len(refmart_codes)} country codes")
            print(f"[{environment}] RefMart codes: {sorted(refmart_codes)}")
        else:
            print(f"[{environment}] WARNING: No RefMart data available")
        
        # Process each participant
        for participant_code, locality_name in participants_with_localities.items():
            if participant_code in refmart_codes:
                # Use RefMart data for this participant
                refmart_country = refmart_country_dict[participant_code]
                print(f"[{environment}] ✓ Using RefMart data for: {participant_code} -> '{refmart_country['NAME_SHORT_EN']}'")
                instances += generate_participant_instance(refmart_country, config)
                endpoints += generate_participant_endpoints(refmart_country, config)
                valueset_entries += f"* $RefMartCountryList#{participant_code}\n"
                refmart_participants.append(participant_code)
            else:
                # Add to environment-specific CodeSystem
                mock_country = {
                    'CODE_ISO_3': participant_code,
                    'NAME_SHORT_EN': locality_name
                }
                print(f"[{environment}] ✓ Adding to Participants{suffix}: {participant_code} -> '{locality_name}' (not in RefMart)")
                codes += "* #" + participant_code + ' "' + escape(locality_name) + '"\n'
                instances += generate_participant_instance(mock_country, config)
                endpoints += generate_participant_endpoints(mock_country, config)
                valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
                processed_count += 1
    
    print(f"\n[{environment} SUMMARY]:")
    print(f"  - Total participants processed: {len(participants_with_localities)}")
    print(f"  - Participants from RefMart: {len(refmart_participants)} - {sorted(refmart_participants)}")
    print(f"  - Participants added to Participants{suffix}: {processed_count}")
    
    # Generate the CodeSystem file for DEV/UAT (only if we have codes not in RefMart)
    codesystem_filename = f"input/fsh/codesystems/Participants{suffix}.fsh"
    if processed_count > 0:
        print(f"[OUTPUT] Writing CodeSystem to: {codesystem_filename}")
        printout(codes, codesystem_filename)
    else:
        print(f"[OUTPUT] No codes to add to Participants{suffix} CodeSystem - all participants found in RefMart")
        # Still create the file but with no codes
        printout(codes, codesystem_filename)
    
    print(f"[OUTPUT] Writing participants to: {participants_filename}")
    printout(instances, participants_filename)
    
    print(f"[OUTPUT] Writing endpoints to: {endpoints_filename}")
    printout(endpoints, endpoints_filename)
    
    # Generate the valueset file with updated logic
    print(f"[OUTPUT] Writing valueset to: {participants_valueset}")
    generate_valueset_new_logic(config, participants_valueset, valueset_entries, len(refmart_participants), processed_count)
    
    print(f"=== END PROCESSING PARTICIPANTS WITH LOCALITIES for {environment} ===\n")


def extract_countries_from_api(data, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset, participants_from_api):
    """Extract countries using participants fetched from GitHub API"""
    environment = "PROD" if config["suffix"] == "" else config["suffix"][1:]  # Remove the "-" prefix
    print(f"Environment: {environment}")
    print(f"Participants from API: {participants_from_api}")
    
    instances = ""
    endpoints = ""
    valueset_entries = ""
    
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
        if data and 'value' in data:
            for country in data['value']:
                print("Processing " + country['CODE_ISO_3'] + ' / ' + country['NAME_SHORT_EN'])
                codes += "* #" + country['CODE_ISO_3'] + ' "' + escape(country['NAME_SHORT_EN']) + '"\n'
                
                if (country['CODE_ISO_3'] in participants_from_api):    
                    instances += generate_participant_instance(country, config)
                    endpoints += generate_participant_endpoints(country, config)
                    valueset_entries += f"* $RefMartCountryList{suffix}#{country['CODE_ISO_3']}\n"
    
    else:
        # For DEV and UAT, generate Participants CodeSystem
        codes = f"CodeSystem: Participants{suffix}\n"
        codes += f'Title: "WHO GDHCN Trust Network Participant{env_name}"\n'
        codes += f'Description: "CodeSystem for GDHCN Trust Network Participants {description_suffix}"\n'
        codes += f'* ^experimental = true\n'
        codes += f'* ^caseSensitive = false\n'
        codes += f'* ^url = "http://smart.who.int/trust/CodeSystems/Participants{suffix}"\n'
        
        if environment == "DEV":
            # For DEV: Include all participants from the DEV repo
            for participant_code in participants_from_api:
                # Create a mock country object for DEV participants
                mock_country = {
                    'CODE_ISO_3': participant_code,
                    'NAME_SHORT_EN': f"DEV Participant {participant_code}"
                }
                print(f"Processing DEV participant: {participant_code}")
                codes += "* #" + participant_code + ' "' + escape(mock_country['NAME_SHORT_EN']) + '"\n'
                instances += generate_participant_instance(mock_country, config)
                endpoints += generate_participant_endpoints(mock_country, config)
                valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
        
        elif environment == "UAT":
            # For UAT: Only include participants that are NOT in RefMart
            if data and 'value' in data:
                refmart_codes = {country['CODE_ISO_3'] for country in data['value']}
                for participant_code in participants_from_api:
                    if participant_code not in refmart_codes:
                        # Create a mock country object for UAT participants not in RefMart
                        mock_country = {
                            'CODE_ISO_3': participant_code,
                            'NAME_SHORT_EN': f"UAT Participant {participant_code}"
                        }
                        print(f"Processing UAT participant (not in RefMart): {participant_code}")
                        codes += "* #" + participant_code + ' "' + escape(mock_country['NAME_SHORT_EN']) + '"\n'
                        instances += generate_participant_instance(mock_country, config)
                        endpoints += generate_participant_endpoints(mock_country, config)
                        valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
                    else:
                        print(f"Skipping UAT participant {participant_code} (found in RefMart)")
        
        # Generate the CodeSystem file for DEV/UAT
        codesystem_filename = f"input/fsh/codesystems/Participants{suffix}.fsh"
        printout(codes, codesystem_filename)
    
    # Only generate RefMartCountryList file for PROD environment
    if suffix == "":  # PROD environment
        printout(codes, refmart_filename)
    
    printout(instances, participants_filename)
    printout(endpoints, endpoints_filename)
    
    # Generate the valueset file
    generate_valueset(config, participants_valueset, valueset_entries)
    


def extract_countries(data, config, participants_filename, endpoints_filename, refmart_filename, participants_valueset):
    """Original extract_countries function for backward compatibility with local source"""
    environment = "PROD" if config["suffix"] == "" else config["suffix"][1:]  # Remove the "-" prefix
    participants = load_participants(participants_valueset, environment)
    print(f"Environment: {environment}")
    print(f"Participants: {participants}")
    instances = ""
    endpoints = ""
    valueset_entries = ""
    
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
        if data and 'value' in data:
            for country in data['value']:
                print("Processing " + country['CODE_ISO_3'] + ' / ' + country['NAME_SHORT_EN'])
                codes += "* #" + country['CODE_ISO_3'] + ' "' + escape(country['NAME_SHORT_EN']) + '"\n'
                
                if (country['CODE_ISO_3'] in participants):    
                    instances += generate_participant_instance(country, config)
                    endpoints += generate_participant_endpoints(country, config)
                    valueset_entries += f"* $RefMartCountryList{suffix}#{country['CODE_ISO_3']}\n"
    
    else:
        # For DEV and UAT, generate Participants CodeSystem
        codes = f"CodeSystem: Participants{suffix}\n"
        codes += f'Title: "WHO GDHCN Trust Network Participant{env_name}"\n'
        codes += f'Description: "CodeSystem for GDHCN Trust Network Participants {description_suffix}"\n'
        codes += f'* ^experimental = true\n'
        codes += f'* ^caseSensitive = false\n'
        codes += f'* ^url = "http://smart.who.int/trust/CodeSystems/Participants{suffix}"\n'
        
        if environment == "DEV":
            # For DEV: Include all participants from the DEV repo
            # Since we don't have access to the actual repo, we simulate with participants list
            # In real implementation, this would query the DEV repository directly
            for participant_code in participants:
                # Create a mock country object for DEV participants
                mock_country = {
                    'CODE_ISO_3': participant_code,
                    'NAME_SHORT_EN': f"DEV Participant {participant_code}"
                }
                print(f"Processing DEV participant: {participant_code}")
                codes += "* #" + participant_code + ' "' + escape(mock_country['NAME_SHORT_EN']) + '"\n'
                instances += generate_participant_instance(mock_country, config)
                endpoints += generate_participant_endpoints(mock_country, config)
                valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
        
        elif environment == "UAT":
            # For UAT: Only include participants that are NOT in RefMart
            # Load PROD's RefMart to filter against
            if data and 'value' in data:
                refmart_codes = {country['CODE_ISO_3'] for country in data['value']}
                for participant_code in participants:
                    if participant_code not in refmart_codes:
                        # Create a mock country object for UAT participants not in RefMart
                        mock_country = {
                            'CODE_ISO_3': participant_code,
                            'NAME_SHORT_EN': f"UAT Participant {participant_code}"
                        }
                        print(f"Processing UAT participant (not in RefMart): {participant_code}")
                        codes += "* #" + participant_code + ' "' + escape(mock_country['NAME_SHORT_EN']) + '"\n'
                        instances += generate_participant_instance(mock_country, config)
                        endpoints += generate_participant_endpoints(mock_country, config)
                        valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
                    else:
                        print(f"Skipping UAT participant {participant_code} (found in RefMart)")
            else:
                # If no RefMart data available, include all participants
                for participant_code in participants:
                    # Create a mock country object for UAT participants
                    mock_country = {
                        'CODE_ISO_3': participant_code,
                        'NAME_SHORT_EN': f"UAT Participant {participant_code}"
                    }
                    print(f"Processing UAT participant: {participant_code}")
                    codes += "* #" + participant_code + ' "' + escape(mock_country['NAME_SHORT_EN']) + '"\n'
                    instances += generate_participant_instance(mock_country, config)
                    endpoints += generate_participant_endpoints(mock_country, config)
                    valueset_entries += f"* $Participants{suffix}#{participant_code}\n"
        
        # Generate the CodeSystem file for DEV/UAT
        codesystem_filename = f"input/fsh/codesystems/Participants{suffix}.fsh"
        printout(codes, codesystem_filename)
        
    # Only generate RefMartCountryList file for PROD environment
    if suffix == "":  # PROD environment
        printout(codes, refmart_filename)
    
    printout(instances, participants_filename)
    printout(endpoints, endpoints_filename)
    
    # Generate the valueset file
    generate_valueset(config, participants_valueset, valueset_entries)


def generate_valueset_new_logic(config, participants_valueset, valueset_entries, refmart_count, env_specific_count):
    """Generate the participants valueset file with new logic for DEV/UAT environments"""
    suffix = config["suffix"]
    env_name = config["env_name"]
    description_suffix = config["description_suffix"]
    environment = suffix[1:] if suffix else "PROD"  # Remove the "-" prefix
    
    if suffix == "":  # PROD
        valueset_content = f"""ValueSet:     Participants
Title:        "WHO GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants {description_suffix}"

* ^status = #active
* ^experimental = true

* include codes from system Participants


// To generate this list of codes for PROD environment
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \\$RefMartCountryList#%P\\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the RefMart set.

{valueset_entries}"""
    else:
        # For DEV and UAT with new logic
        comment = f"""// New logic for {environment} environment:
// 1. If participant exists in RefMart, use RefMart code
// 2. If participant does NOT exist in RefMart, add to Participants{suffix} CodeSystem
// 3. ValueSet includes codes from BOTH sources
//
// Current composition:
//   - RefMart codes (participants found in RefMart): {refmart_count}
//   - Participants{suffix} codes (participants NOT in RefMart): {env_specific_count}
//
// To regenerate, execute on tng-participants-{environment.lower()} repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*'"""

        valueset_content = f"""ValueSet:     Participants{suffix}
Title:        "WHO GDHCN Trust Network Participant{env_name}"
Description:  "ValueSet of GDHCN Trust Network Participants {description_suffix}"

* ^status = #active
* ^experimental = true

* include codes from system Participants{suffix}

{comment}

{valueset_entries}"""
    
    printout(valueset_content, participants_valueset)


def generate_valueset(config, participants_valueset, valueset_entries):
    """Generate the participants valueset file (backward compatibility)"""
    suffix = config["suffix"]
    env_name = config["env_name"]
    description_suffix = config["description_suffix"]
    
    if suffix == "":  # PROD
        valueset_content = f"""ValueSet:     Participants
Title:        "WHO GDHCN Trust Network Participant"
Description:  "ValueSet of GDHCN Trust Network Participants {description_suffix}"

* ^status = #active
* ^experimental = true

* include codes from system Participants


// To generate this list of codes for PROD environment
// execute the following on tng-participants-prod repo:
//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf "* \\$RefMartCountryList#%P\\n"  | grep -v WHO
//
// in the future, will need to exclude more than just WHO as not being from the RefMart set.

{valueset_entries}"""
    else:
        # For DEV and UAT
        environment = suffix[1:]  # Remove the "-" prefix
        
        if environment == "DEV":
            codesystem_ref = f"Participants{suffix}"
            comment = f"// To generate this list of codes for {environment} environment\n// execute the following on tng-participants-{environment.lower()} repo:\n//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf \"* \\$Participants{suffix}#%P\\n\"  | grep -v WHO"
        else:  # UAT
            codesystem_ref = f"Participants{suffix}"
            comment = f"// To generate this list of codes for {environment} environment\n// execute the following on tng-participants-{environment.lower()} repo:\n//     gfind . -maxdepth 1 -type d -name '[A-Z][A-Z][A-Z](-[A-Z]+)*' -printf \"* \\$Participants{suffix}#%P\\n\"  | grep -v WHO\n// Note: Only includes participants NOT found in RefMart"
        
        valueset_content = f"""ValueSet:     Participants{suffix}
Title:        "WHO GDHCN Trust Network Participant{env_name}"
Description:  "ValueSet of GDHCN Trust Network Participants {description_suffix}"

* ^status = #active
* ^experimental = true

* include codes from system {codesystem_ref}


{comment}

{valueset_entries}"""
    
    printout(valueset_content, participants_valueset)


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
    
    # Determine base URL based on environment (use HTTPS and documented endpoints)
    if suffix == "":  # PROD
        base_url = "https://tng-cdn.who.int"
    elif suffix == "-UAT":
        base_url = "https://tng-cdn-uat.who.int"
    else:  # DEV
        base_url = "https://tng-cdn-dev.who.int"
    
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
    endpoint += f'* address = "did:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}:DSC"\n'
    endpoints += endpoint + "\n"
    
    # SCA endpoint  
    didendpointid = f"GDHCNParticipantDID-{country['CODE_ISO_3']}{suffix}-SCA"
    endpoint =  "Instance: " + didendpointid + "\n"
    endpoint += "InstanceOf: IHE.mCSD.Endpoint\n"
    endpoint += "Usage: #definition" + "\n"
    endpoint += f'* name = "{escape(country["NAME_SHORT_EN"])} Trustlist (DID v2){env_name} - Certificate Signing Authority\\ndid:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}:SCA\\nresolvable at {base_url}/v2/trustlist/-/{country["CODE_ISO_3"]}/SCA/did.json"\n'
    endpoint += f"* managingOrganization = Reference(Organization/GDHCNParticipant-{country['CODE_ISO_3']}{suffix})\n"
    endpoint += "* status = #active\n"
    endpoint += "* connectionType = $ConnectionTypes#http-get\n"
    endpoint += "* payloadMimeType = #application/did\n"
    endpoint += "* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2\n"
    endpoint += f'* address = "did:web:tng-cdn.who.int:v2:trustlist:-:{country["CODE_ISO_3"]}:SCA"\n'
    endpoints += endpoint + "\n"
    
    return endpoints



main()
