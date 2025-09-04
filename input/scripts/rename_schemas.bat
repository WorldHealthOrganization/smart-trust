@echo off
setlocal enabledelayedexpansion
REM Script to rename logical model schema files to match FHIR canonical naming convention
REM Changes from [name].schema.json to StructureDefinition-[name].schema.json

echo Renaming logical model schema files...

REM Directory where the built IG output is located
set OUTPUT_DIR=%1
if "%OUTPUT_DIR%"=="" set OUTPUT_DIR=output

if not exist "%OUTPUT_DIR%" (
    echo Output directory %OUTPUT_DIR% not found. Skipping schema renaming.
    exit /b 0
)

REM List of logical model IDs that need to be renamed
set MODELS=HCert SchemeInformation CWT COSEHeader CWTPayload

for %%m in (%MODELS%) do (
    set OLD_FILE=%OUTPUT_DIR%\%%m.schema.json
    set NEW_FILE=%OUTPUT_DIR%\StructureDefinition-%%m.schema.json
    
    if exist "!OLD_FILE!" (
        echo Renaming !OLD_FILE! to !NEW_FILE!
        move "!OLD_FILE!" "!NEW_FILE!"
    ) else (
        echo Schema file !OLD_FILE! not found, skipping...
    )
)

echo Schema renaming completed.