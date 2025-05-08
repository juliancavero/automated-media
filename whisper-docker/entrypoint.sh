#!/bin/bash
set -e

INPUT_MP4_FILE_PATH=$1
LANG=$2

# Print debugging info
echo "Input file path: $INPUT_MP4_FILE_PATH"
echo "Language: $LANG"
ls -la /usr/local/src/whisper.cpp/mnt/

# Convert input to WAV using a simpler path approach
ffmpeg -i "$INPUT_MP4_FILE_PATH" -ar 16000 /usr/local/src/whisper.cpp/samples/test.wav

# Run whisper on the WAV file
./main -m models/ggml-tiny.bin -ml 1 --split-on-word --output-json --output-file ./mnt/output -l $LANG -f samples/test.wav
