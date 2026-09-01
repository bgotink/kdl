#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v genhtml &>/dev/null; then
	# shellcheck disable=SC2016
	echo 'Missing command genhtml, run `brew install lcov` or whatever alternative exists for your system' >&2
	exit 1
fi

opts=()

genhtml_location="$(dirname "$(dirname "$(command -v genhtml)")")"
if [[ -x "$genhtml_location/share/lcov/support-scripts/gitblame.pm" ]]; then
	opts+=("--annotate-script" "$genhtml_location/share/lcov/support-scripts/gitblame.pm")
fi

exec genhtml \
	-o coverage \
	--ignore-errors package,package,inconsistent,inconsistent \
	--num-spaces 4 \
	"${opts[@]}" \
	lcov.info \
	"$@"
