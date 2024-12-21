import assert from "node:assert/strict";
import {readFileSync, readdirSync, existsSync} from "node:fs";
import {test} from "uvu";

import {format, parse} from "../src/index.js";
import {parseWithoutFormatting, parseAndTransform} from "../src/v1-compat.js";

const testCasesFolder = new URL(
	"upstream-v1/tests/test_cases/",
	import.meta.url,
);

const knownBrokenTests = new Set([
	// All JavaScript numbers are floats, meaning the largest
	// integer number we can represent is lower than what
	// the KDL tests expect
	"hex.kdl",
	"hex_int.kdl",

	// These tests use numbers that require a bigdecimal
	// implementation to represent the value, which our
	// javascript engine doesn't provide (yet?)
	"sci_notation_large.kdl",
	"sci_notation_small.kdl",
]);

for (const testCase of readdirSync(new URL("input", testCasesFolder))) {
	const inputFile = new URL(`input/${testCase}`, testCasesFolder);
	const expectedOutputFile = new URL(
		`expected_kdl/${testCase}`,
		testCasesFolder,
	);

	if (knownBrokenTests.has(testCase) || !existsSync(expectedOutputFile)) {
		continue;
	}

	const input = readFileSync(inputFile, "utf8");
	const expectedOutput = readFileSync(expectedOutputFile, "utf8");

	test(testCase, () => {
		// There are two parts to this test:
		//
		// - Check whether the expected output and the input parse into the same
		//   document. This validates that we correctly handle a bunch of edge cases
		//   correctly.
		// - Check whether the returned document (with formatting info attached) will
		//   be formatted correctly as KDL v2. Note the formatting function doesn't
		//   validate the formatting info, so if the info is wrong the format
		//   function would happily output invalid KDL files.

		if (testCase !== "repeated_prop.kdl") {
			// Skip this assertion for repeated_prop as we store the repeated props so
			// the two values wouldn't be deepEqual.

			assert.deepEqual(
				parseWithoutFormatting(input),
				parseWithoutFormatting(expectedOutput),
			);
		}

		const document = parseAndTransform(input);

		assert.deepEqual(parse(format(document)), document);
	});
}

test.run();
