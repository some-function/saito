#!/bin/bash

function scan_directory {
    local directory="$1"
    local json_result="{"

    for file in "$directory"/*; do
        if [ -d "$file" ]; then
            json_result+="\"$(basename "$file")\": $(scan_directory "$file"),"
        elif [[ "$file" =~ \.(jpg|jpeg|png|gif)$ ]]; then
            image_data=$(base64 -w 0 "$file")
            json_result+="\"$(basename "$file")\": \"data:image/$(echo "$file" | awk -F. '{print tolower($NF)}');base64,$image_data\","
        fi
    done

    json_result=$(echo "$json_result" | sed 's/,$//')
    json_result+="}"

    echo "$json_result"
}

if [ -z "$1" ]; then
    echo "Please provide a directory path to start scanning."
    exit 1
fi

start_directory="$1"

if [ ! -d "$start_directory" ]; then
    echo "Invalid directory path: $start_directory"
    exit 1
fi

json_output=$(scan_directory "$start_directory")

echo "$json_output" > image_tree.json

echo "JSON file with image data created: image_tree.json"