import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {suite, test} from "node:test";

import {
	formatCompact,
	clearFormat,
	parse,
	Document,
	Node,
	Identifier,
	Entry,
	Value,
} from "../src/index.js";

suite("formatCompact", () => {
	const testCasesFolder = new URL(
		"kdl-test/test_cases/valid/",
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

	for (const testCase of readdirSync(testCasesFolder)) {
		if (!testCase.endsWith(".kdl") || knownBrokenTests.has(testCase)) {
			continue;
		}

		test(testCase, (t) => {
			const document = clearFormat(
				parse(readFileSync(new URL(testCase, testCasesFolder))),
			);

			const formatted = formatCompact(document);

			// assert the document is not changed by formatCompact
			assert.deepEqual(clearFormat(parse(formatted)), document);
			// assert formatCompact of a compact document yields the exact same text
			assert.equal(formatCompact(parse(formatted)), formatted);

			// snapshot the result
			t.assert.snapshot(formatted);
		});
	}

	test("inline test document", () => {
		assert.equal(
			formatCompact(
				new Document([
					new Node(
						new Identifier("node"),
						[
							new Entry(new Value("value"), null),
							new Entry(new Value(2e25), null),
							new Entry(new Value(null), null),
							new Entry(new Value(true), null),
							new Entry(new Value(false), null),
						],
						new Document([
							new Node(new Identifier("child")),
							new Node(new Identifier("child too")),
						]),
					),
				]),
			),
			`node value 20000000000000000000000000 #null #true #false{child;"child too"}`,
		);
	});

	test("formatCompact fails on non-KDL values", () => {
		assert.throws(() => {
			// @ts-expect-error types don't allow invalid values
			formatCompact(/not a kdl object/);
		});
	});
});
