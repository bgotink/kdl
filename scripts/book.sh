#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

if ! command -v mdbook >/dev/null 2>&1; then
	echo "Please install mdbook first" >&2
	exit 1
fi

typedocargs=()
case "${2:-github}" in
	tngl)
		typedocargs+=("--sourceLinkTemplate" "https://tangled.org/bram.gotink.be/kdl/blob/{gitRevision}/{path}#L{line}")
		export MDBOOK_OUTPUT__HTML__GIT_REPOSITORY_URL="https://tangled.org/bram.gotink.be/kdl"
		export MDBOOK_OUTPUT__HTML__EDIT_URL_TEMPLATE="https://tangled.org/bram.gotink.be/kdl/blob/main/documentation/{path}"
		;;
esac

yarn typedoc \
	--out documentation/src/api/reference \
	"${typedocargs[@]}" \
	src/index.js src/json.d.ts src/v1-compat.js src/dessert.d.ts

yarn esbuild --bundle \
	--minify \
	--sourcemap \
	--format=esm --platform=browser --target=safari16 \
	--outdir=documentation/src \
	documentation/kdl.js

cd documentation
mdbook "${1:-build}"
