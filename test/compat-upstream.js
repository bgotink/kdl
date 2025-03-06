import assert from "node:assert/strict";
import {readFileSync, readdirSync, existsSync} from "node:fs";
import {test} from "uvu";

import {clearFormat, format, parse as parseV2} from "../src/index.js";
import {parse as parseV1, parseCompat} from "../src/v1-compat.js";

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

	// These tests have become valid with the introduction of number suffixes
	"illegal_char_in_binary.kdl",
	"multiple_x_in_hex.kdl",
	"no_digits_in_hex.kdl",
]);

const testsWithInvalidKdlV1ButValidKdlV2 = new Set([
	// bare identifers can be used as values now
	"bare_arg.kdl",
	"dash_dash.kdl",
	"question_mark_at_start_of_int.kdl",
	"question_mark_before_number.kdl",
	"underscore_at_start_of_int.kdl",
	"underscore_before_number.kdl",
	// [,<>] are now valid in bare identifiers
	"chevrons_in_bare_id.kdl",
	"comma_in_bare_id.kdl",
	// escline doesn't require a unicode whitespace anymore
	"escline_comment_node.kdl",
	// node-space is allowed in types and between types and what they type
	"comment_after_arg_type.kdl",
	"comment_after_node_type.kdl",
	"comment_after_prop_type.kdl",
	"comment_in_arg_type.kdl",
	"comment_in_node_type.kdl",
	"comment_in_prop_type.kdl",
	"space_after_arg_type.kdl",
	"space_after_node_type.kdl",
	"space_in_node_type.kdl",
]);

for (const testCase of readdirSync(new URL("input", testCasesFolder))) {
	const inputFile = new URL(`input/${testCase}`, testCasesFolder);
	const expectedOutputFile = new URL(
		`expected_kdl/${testCase}`,
		testCasesFolder,
	);

	if (knownBrokenTests.has(testCase)) {
		continue;
	}

	const input = readFileSync(inputFile, "utf8");

	if (!existsSync(expectedOutputFile)) {
		test(testCase, () => {
			assert.throws(() => parseV1(input));

			if (testsWithInvalidKdlV1ButValidKdlV2.has(testCase)) {
				assert.doesNotThrow(() => parseCompat(input));
			} else {
				assert.throws(() => parseCompat(input));
			}
		});
	} else {
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

			assert.deepEqual(
				clearFormat(parseV1(input)),
				clearFormat(parseV1(expectedOutput)),
			);

			const document = parseV1(input);
			const textV2 = format(document);
			assert.deepEqual(parseV2(textV2), document);

			assert.deepEqual(parseCompat(input), document);
			assert.deepEqual(parseCompat(textV2), document);
		});
	}
}

test.run();
