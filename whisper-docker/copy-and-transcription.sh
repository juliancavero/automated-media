#!/bin/bash
set -ex

INPUT_MP4_FILE_PATH=$1
INPUT_MP4_FILE_NAME=`basename $INPUT_MP4_FILE_PATH`
LANG=$2

if [ x$LANG == x ]; then
    LANG=es
fi

# Build the Docker image
IMAGE=`docker build -q .`

# Use a more explicit path mapping for Docker
echo "Running Docker with input file: $INPUT_MP4_FILE_PATH"
echo "Input filename: $INPUT_MP4_FILE_NAME"

# Important: Path to the file inside the container must be absolute and include mnt directory
docker run --rm -v $PWD/mnt:/usr/local/src/whisper.cpp/mnt -it $IMAGE entrypoint.sh /usr/local/src/whisper.cpp/mnt/$INPUT_MP4_FILE_NAME $LANG
