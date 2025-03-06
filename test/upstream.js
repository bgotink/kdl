import assert from "node:assert/strict";
import {readFileSync, readdirSync, existsSync} from "node:fs";
import {suite} from "uvu";

import {clearFormat, format, parse} from "../src/index.js";

const testValid = suite("valid documents");
const testInvalid = suite("invalid documents");

const testCasesFolder = new URL("upstream/tests/test_cases/", import.meta.url);

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
	"bare_ident_numeric_fail.kdl",
	"bare_ident_numeric_sign_fail.kdl",
	"illegal_char_in_binary_fail.kdl",
	"multiple_x_in_hex_fail.kdl",
	"no_digits_in_hex_fail.kdl",
]);

/**
 * Pass the given KDL text through parse() and then format()
 *
 * @param {string} text
 */
function roundTrip(text) {
	return format(parse(text));
}

/**
 * Format the given KDL text in the format the upstream test suite expects.
 *
 * @param {Parameters<parse>[0]} text
 */
function parseAndFormat(text) {
	const document = parse(text);
	clearFormat(document);

	// The expected output of the tests uses scientific notation
	// for numbers that javascript itself still prints normally
	document.nodes.forEach(function reformatNumbers(node) {
		for (const {value} of node.entries) {
			if (typeof value.value !== "number") {
				continue;
			}

			const clone = value.clone();
			clone.tag = null;

			let formatted = format(clone);
			if (formatted.length > 8 && formatted.endsWith("0000")) {
				formatted = value.value.toExponential();
			} else if (formatted.length > 8 && formatted.startsWith("0.0000")) {
				formatted = value.value.toExponential();
			}

			// The tests use uppercase E for exponential notation,
			// but javascript uses lowercase e.
			if (formatted.includes("e")) {
				value.representation = formatted.replace(
					/e([+-])?/,
					(_, sign) => `E${sign ?? "+"}`,
				);
			}
		}

		node.children?.nodes.forEach(reformatNumbers);
	});

	let formatted = format(document);

	// Replace tabs with four spaces, as used in the expected output
	formatted = formatted.replaceAll("\t", "    ");

	// Turn empty output into a newline, as expected in the test
	formatted = formatted || "\n";

	return formatted;
}

/**
 * Process the expected KDL output to remove formatting that javascript doesn't
 * support.
 *
 * @param {string} text
 */
function normalizeExpectedOutput(text) {
	// JavaScript doesn't distinguish between float and integer, so turn floats
	// into integer if the decimal part is zero.
	// This regex is a hack, but the proper solution would be to parse the KDL
	// and we don't want to use our parser because that would muddle the test
	// results.
	return text.replace(/(?<=[0-9])\.0+(?= |\n|[eE][+-]?[0-9]|$)/g, "");
}

for (const testCase of readdirSync(new URL("input", testCasesFolder))) {
	const inputFile = new URL(`input/${testCase}`, testCasesFolder);
	const expectedOutputFile = new URL(
		`expected_kdl/${testCase}`,
		testCasesFolder,
	);

	if (!existsSync(expectedOutputFile)) {
		// read as buffer because the file might contain invalid UTF8 and we don't
		// want node to replace those with a filler codepoint.
		const input = readFileSync(inputFile);

		testInvalid(testCase, () => {
			if (knownBrokenTests.has(testCase)) {
				assert.doesNotThrow(() => parse(input));
			} else {
				assert.throws(() => parse(input));
			}
		});
	} else {
		const input = readFileSync(inputFile, "utf8");
		const expectedOutput = normalizeExpectedOutput(
			readFileSync(expectedOutputFile, "utf8"),
		);

		testValid(testCase, () => {
			if (knownBrokenTests.has(testCase)) {
				assert.throws(() => {
					assert.equal(parseAndFormat(input), expectedOutput);
				});
			} else {
				assert.equal(roundTrip(input), input);
				assert.equal(parseAndFormat(input), expectedOutput);
			}
		});
	}
}

testValid.run();
testInvalid.run();

const testExample = suite("examples");
const exampleFolder = new URL("upstream/examples/", import.meta.url);

for (const file of readdirSync(exampleFolder)) {
	testExample(`Example ${file}`, () => {
		const raw = readFileSync(new URL(file, exampleFolder), "utf8");

		assert.equal(roundTrip(raw), raw);
	});
}

testExample.run();
