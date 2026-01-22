@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION
SET publisher_jar=publisher.jar
SET input_cache_path=%CD%\input-cache

REM Base URL for DAK scripts manifest
SET SCRIPT_BASE_URL=https://raw.githubusercontent.com/WorldHealthOrganization/smart-base/main/input/scripts

REM Download and run pre-sushi scripts if dak.json exists
SET pre_sushi_dir=%CD%\local-template\scripts\pre-sushi
IF EXIST "dak.json" (
    ECHO DAK processing enabled - checking for pre-sushi scripts...
    IF NOT EXIST "%pre_sushi_dir%" mkdir "%pre_sushi_dir%"

    REM Download manifest and scripts dynamically
    curl -L -f -s -o "%pre_sushi_dir%\pre-sushi-scripts.txt" "%SCRIPT_BASE_URL%/pre-sushi-scripts.txt" 2>nul
    IF EXIST "%pre_sushi_dir%\pre-sushi-scripts.txt" (
        FOR /F "usebackq tokens=1,2 delims=:" %%a IN ("%pre_sushi_dir%\pre-sushi-scripts.txt") DO (
            IF NOT EXIST "%pre_sushi_dir%\%%a" (
                ECHO   Downloading %%a...
                curl -L -f -s -o "%pre_sushi_dir%\%%a" "%SCRIPT_BASE_URL%/%%b" 2>nul
            )
        )
    ) ELSE (
        ECHO   Could not download script manifest, using local scripts only
    )
)

REM Run pre-sushi scripts (before IG Publisher/sushi starts)
IF EXIST "%pre_sushi_dir%" (
    ECHO Running pre-sushi scripts...
    FOR %%f IN ("%pre_sushi_dir%\*.py") DO (
        ECHO   Running %%f
        python "%%f" "%CD%"
    )
) ELSE (
    ECHO No pre-sushi scripts directory found, skipping...
)

ECHO Checking internet connection...
PING tx.fhir.org -4 -n 1 -w 1000 | FINDSTR TTL && GOTO isonline
ECHO We're offline...
SET txoption=-tx n/a
GOTO igpublish

:isonline
ECHO We're online
SET txoption=

:igpublish

SET JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8

IF EXIST "%input_cache_path%\%publisher_jar%" (
	JAVA -jar "%input_cache_path%\%publisher_jar%" -ig . %txoption% %*
) ELSE If exist "..\%publisher_jar%" (
	JAVA -jar "..\%publisher_jar%" -ig . %txoption% %*
) ELSE (
	ECHO IG Publisher NOT FOUND in input-cache or parent folder.  Please run _updatePublisher.  Aborting...
)

PAUSE
