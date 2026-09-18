#!/bin/sh
# Docker entrypoint — delegates to the shared Render/single-service boot script.
set -eu
exec ./scripts/start-render.sh
