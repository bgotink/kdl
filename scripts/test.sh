#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

coverage_options=()

if ! ( printf '%s\0' "$@" | grep -Fxqz -- '--watch' ); then
	coverage_options=(--experimental-test-coverage --test-reporter=lcov --test-reporter-destination=lcov.info)
fi

exec node --test \
	--test-reporter=spec --test-reporter-destination=stdout \
	"${coverage_options[@]}" \
	"$@" \
	'test/*.js' 'test/dessert/*.js'
