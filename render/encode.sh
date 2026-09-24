#!/usr/bin/env bash
# Assemble les images + la bande son en MP4 (H.264 + AAC).
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -framerate 60 -i frames/%05d.png -i out/audio.wav \
  -map 0:v -map 1:a -t 30 \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 192k -ac 2 -movflags +faststart \
  out/claude-montage-1080p.mp4
# version legere (< 8 Mo) pour le partage
ffmpeg -y -framerate 60 -i frames/%05d.png -i out/audio.wav \
  -map 0:v -map 1:a -t 30 \
  -c:v libx264 -preset slow -b:v 1750k -maxrate 2000k -bufsize 4000k \
  -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 96k -ac 2 \
  out/claude-montage-light.mp4
ls -lh out/*.mp4
