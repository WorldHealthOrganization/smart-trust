@ECHO OFF
SET publisher_jar=publisher.jar
SET input_cache_path=%CD%\input-cache

REM Run pre-sushi scripts (before IG Publisher/sushi starts)
SET pre_sushi_dir=%CD%\local-template\scripts\pre-sushi
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
