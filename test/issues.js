import assert from "node:assert/strict";
import {test} from "uvu";

import {
	clearFormat,
	Entry,
	InvalidKdlError,
	Node,
	parse,
} from "../src/index.js";

test("issue #1: leading/trailing whitespace", () => {
	assert.deepEqual(
		clearFormat(
			parse(
				String.raw`
					node {}
				`,
				{as: "node"},
			),
		),
		Node.create("node"),
	);

	assert.deepEqual(
		clearFormat(
			parse(
				String.raw`    \
					prop="value" \
				`,
				{as: "entry"},
			),
		),
		Entry.createProperty("prop", "value"),
	);

	assert.deepEqual(
		clearFormat(
			parse(
				String.raw` \
					"value"   \
				`,
				{as: "entry"},
			),
		),
		Entry.createArgument("value"),
	);
});

test("issue #5: trailing comments", () => {
	assert.doesNotThrow(() => parse(`node "arg"\n\n// test\n`));
});

test("issue #8: escaped surrogates", () => {
	assert.throws(
		() => {
			parse(
				String.raw`no "Surrogtates high\u{D800}\u{D911}\u{DABB}\u{DBFF} low\u{DC00}\u{DEAD}\u{DFFF}"`,
			);
		},
		(err) => {
			assert(err instanceof InvalidKdlError);
			assert.equal(err.errors?.length, 7);

			for (let i = 0; i < 7; i++) {
				assert.match(
					err.errors[i].message,
					/only scalar values can be added using an escape/,
				);
			}

			return true;
		},
	);
});

test("issue #9: unicode escapes", () => {
	assert.equal(
		parse(String.raw`node "\u{00000a}"`).nodes[0].getArgument(0),
		"\u{0a}",
	);
});

test("issue: accept missing whitespace", () => {
	assert.throws(() => parse('node /- "arg"2'));
});

test.run();
