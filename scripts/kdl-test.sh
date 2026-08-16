#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v kdl-test &>/dev/null; then
	kdl_test=kdl-test
elif [[ -x ./kdl-test ]]; then
	kdl_test="$PWD/kdl-test"
else
	echo "Place kdl-test on the path or in the root of this repository" >&2
fi

exec "$kdl_test" run \
	--skip valid/hex.kdl \
	--skip valid/hex_int.kdl \
	--skip valid/sci_notation_large.kdl \
	--skip valid/sci_notation_small.kdl \
	--decoder "$PWD/scripts/kdl-test/decoder.js"
