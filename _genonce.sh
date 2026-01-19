#!/bin/bash
publisher_jar=publisher.jar
input_cache_path=./input-cache/

# Run pre-sushi scripts (before IG Publisher/sushi starts)
pre_sushi_dir="./local-template/scripts/pre-sushi"
if [ -d "$pre_sushi_dir" ]; then
    echo "Running pre-sushi scripts..."
    for script in $(ls -1 "$pre_sushi_dir"/*.py 2>/dev/null | sort); do
        if [ -f "$script" ]; then
            echo "  Running $script"
            python "$script" "$(pwd)"
        fi
    done
else
    echo "No pre-sushi scripts directory found, skipping..."
fi

echo Checking internet connection...
curl -sSf tx.fhir.org > /dev/null

if [ $? -eq 0 ]; then
	echo "Online"
	txoption=""
else
	echo "Offline"
	txoption="-tx n/a"
fi

echo "$txoption"

export JAVA_TOOL_OPTIONS="$JAVA_TOOL_OPTIONS -Dfile.encoding=UTF-8"

publisher=$input_cache_path/$publisher_jar
if test -f "$publisher"; then
	java -jar $publisher -ig . $txoption $*
else
	publisher=../$publisher_jar
	if test -f "$publisher"; then
		java -jar $publisher -ig . $txoption $*
	else
		echo IG Publisher NOT FOUND in input-cache or parent folder.  Please run _updatePublisher.  Aborting...
	fi
fi
