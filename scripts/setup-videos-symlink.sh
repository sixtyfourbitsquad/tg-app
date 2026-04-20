#!/usr/bin/env bash
# Replace public/videos with a symlink to $VIDEOS_DIR (default /home/adii/videos).
# Run from the repo root on the VPS.
set -euo pipefail

VIDEOS_DIR="${VIDEOS_DIR:-/home/adii/videos}"
TARGET="public/videos"

if [[ ! -d "$VIDEOS_DIR" ]]; then
  echo "Source dir does not exist: $VIDEOS_DIR" >&2
  echo "Create it first:  sudo mkdir -p $VIDEOS_DIR && sudo chown \$USER:\$USER $VIDEOS_DIR" >&2
  exit 1
fi

if [[ -L "$TARGET" ]]; then
  echo "Removing existing symlink: $TARGET"
  rm "$TARGET"
elif [[ -d "$TARGET" ]]; then
  if [[ -n "$(ls -A "$TARGET" 2>/dev/null | grep -vE '^(README\.md|\.gitkeep)$' || true)" ]]; then
    echo "Refusing to remove non-empty directory: $TARGET" >&2
    echo "Move or back up its contents first." >&2
    exit 1
  fi
  echo "Removing placeholder directory: $TARGET"
  rm -rf "$TARGET"
fi

ln -s "$VIDEOS_DIR" "$TARGET"
echo "Linked $TARGET -> $VIDEOS_DIR"
