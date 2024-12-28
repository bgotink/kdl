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
	--entryFileName index \
	--membersWithOwnFile Class \
	--parametersFormat table \
	--hideBreadcrumbs \
	--hidePageHeader \
	src/index.js src/json.d.ts src/v1-compat.js src/dessert.d.ts

yarn esbuild --bundle \
	--minify --keep-names \
	--sourcemap \
	--format=esm --platform=browser --target=safari16 \
	--outdir=documentation/src \
	documentation/kdl.js

cd documentation
mdbook "${1:-build}"
