import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {expect} from 'expect';
import {suite} from 'uvu';

import {clearFormat, format, parse} from '../src/index.js';

const test = suite('upstream test suite');

const testCasesFolder = new URL('upstream/tests/test_cases/', import.meta.url);

const knownBrokenTests = new Set([
	// All JavaScript numbers are floats, meaning the largest
	// integer number we can represent is lower than what
	// the KDL tests expect
	'hex.kdl',
	'hex_int.kdl',

	// These tests use numbers that require a bigdecimal
	// implementation to represent the value, which our
	// javascript engine doesn't provide (yet?)
	'sci_notation_large.kdl',
	'sci_notation_small.kdl',
]);

/**
 * Format the given KDL text in the format the upstream test suite expects.
 *
 * @param {string} text
 */
function parseAndFormat(text) {
	const document = parse(text);
	clearFormat(document);

	// The expected output of the tests uses scientific notation
	// for numbers that javascript itself still prints regularly
	document.nodes.forEach(function reformatNumbers(node) {
		for (const {value} of node.entries) {
			if (typeof value.value !== 'number') {
				continue;
			}

			let formatted = format(value);
			if (formatted.length > 8 && formatted.endsWith('0000')) {
				formatted = value.value.toExponential();
			} else if (formatted.length > 8 && formatted.startsWith('0.0000')) {
				formatted = value.value.toExponential();
			}

			// The tests use uppercase E for exponential notation,
			// but javascript uses lowercase e.
			if (formatted.includes('e')) {
				value.representation = formatted.replace(
					/e([+-])?/,
					(_, sign) => `E${sign ?? '+'}`,
				);
			}
		}

		node.children?.nodes.forEach(reformatNumbers);
	});

	let formatted = format(document);

	// Replace tabs with four spaces, as used in the expected output
	formatted = formatted.replace(/\t/g, '    ');

	// Turn empty output into a newline, as expected in the test
	formatted ||= '\n';

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
	return text.replace(/(?<=[0-9])\.0+(?= |\n|[eE][+-]?[0-9]|$)/g, '');
}

for (const testCase of readdirSync(new URL('input', testCasesFolder))) {
	test(testCase, () => {
		const input = readFileSync(
			new URL(`input/${testCase}`, testCasesFolder),
			'utf8',
		);

		const expectedOutputFile = new URL(
			`expected_kdl/${testCase}`,
			testCasesFolder,
		);

		if (!existsSync(expectedOutputFile)) {
			if (knownBrokenTests.has(testCase)) {
				expect(() => parse(input)).not.toThrow();
			} else {
				expect(() => parse(input)).toThrow();
			}

			return;
		}

		const expectedOutput = normalizeExpectedOutput(
			readFileSync(expectedOutputFile, 'utf8'),
		);

		if (knownBrokenTests.has(testCase)) {
			expect(() => {
				expect(parseAndFormat(input)).toBe(expectedOutput);
			}).toThrow();
		} else {
			expect(parseAndFormat(input)).toBe(expectedOutput);
		}
	});
}

test.run();
