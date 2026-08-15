#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v genhtml &>/dev/null; then
	echo 'Missing command genhtml, run `brew install lcov` or whatever alternative exists for your system' >&2
	exit 1
fi

exec genhtml \
	-o coverage \
	--ignore-errors inconsistent \
	lcov.info \
	"$@"
