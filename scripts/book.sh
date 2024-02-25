#!/usr/bin/env bash

set -e

cd $(dirname "$0")/..

if ! command -v mdbook >/dev/null 2>&1; then
	echo "Please install mdbook first" >&2
	exit 1
fi

yarn typedoc \
	--plugin typedoc-plugin-markdown \
	--out documentation/src/api/reference \
	--readme none \
	--excludePrivate \
	--excludeProtected \
	--githubPages false \
	--validation \
	--entryDocument index.md \
	src/index.js

cd documentation
mdbook "${1:-build}"
