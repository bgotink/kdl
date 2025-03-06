import assert from "node:assert/strict";
import {test} from "uvu";

import {
	InvalidKdlError,
	Tag,
	Value,
	clearFormat,
	format,
	parse,
} from "../src/index.js";

test("bare number suffixes", () => {
	let value = new Value(10);
	value.tag = new Tag("xp");
	assert.deepEqual(clearFormat(parse(`10xp`, {as: "value"})), value);

	value.tag = new Tag("m");
	assert.deepEqual(clearFormat(parse(`10m`, {as: "value"})), value);

	assert.equal(format(parse(`node 10m 5xp`)), "node 10m 5xp");

	assert.throws(
		() =>
			parse(String.raw`
		node \
			1b0 \
			1o0 \
			1x0 \
			1m0 \
			1e0e0 \
			1e_0 \
			1e_a \
			1e-_0 \
			1e-_a \
	`),
		(error) => {
			assert(error instanceof InvalidKdlError);
			assert(error.errors != null);
			assert.equal(error.errors.length, 9);

			assert.match(
				error.errors[0].message,
				/Invalid number with suffix, a suffix cannot start with a letter followed by a digit at 3/,
			);
			assert.match(
				error.errors[1].message,
				/Invalid number with suffix, a suffix cannot start with a letter followed by a digit at 4/,
			);
			assert.match(
				error.errors[2].message,
				/Invalid number with suffix, a suffix cannot start with an x followed by a hexidecimal number at 5/,
			);
			assert.match(
				error.errors[3].message,
				/Invalid number with suffix, a suffix cannot start with a letter followed by a digit at 6/,
			);
			assert.match(
				error.errors[4].message,
				/Invalid number with suffix, a number with an exponent cannot have a suffix at 7/,
			);
			assert.match(
				error.errors[5].message,
				/Invalid decimal number, the number after the exponent mustn't start on an underscore at 8/,
			);
			assert.match(
				error.errors[6].message,
				/Invalid number with suffix, a suffix cannot start with a letter followed by an underscore at 9/,
			);
			assert.match(
				error.errors[7].message,
				/Invalid decimal number, the number after the exponent mustn't start on an underscore at 10/,
			);
			assert.match(
				error.errors[8].message,
				/Invalid number with suffix, a suffix cannot start with a letter followed by an underscore at 11/,
			);

			return true;
		},
	);

	assert.throws(
		() => parse("node 0true"),
		/Invalid suffix true, values that look like keywords cannot be used as suffix/,
	);
	assert.throws(
		() => parse("node 0nan"),
		/Invalid suffix nan, values that look like keywords cannot be used as suffix/,
	);
});

test("separated number suffixes", () => {
	let value = new Value(10);
	value.tag = new Tag("xp");
	assert.deepEqual(clearFormat(parse(`10#xp`, {as: "value"})), value);

	value.tag = new Tag("m");
	assert.deepEqual(clearFormat(parse(`10#m`, {as: "value"})), value);

	assert.equal(format(parse("node 10#m 5#_xp")), "node 10#m 5#_xp");

	assert.doesNotThrow(() =>
		parse(String.raw`
		node \
			1#b0 \
			1#o0 \
			1#x0 \
			1#m0 \
			1e0#e0 \
			1#e_0 \
			1#e_a \
			1#e-_0 \
			1#e-_a \
	`),
	);

	assert.throws(
		() => parse("node 0#true"),
		/Invalid number suffix #true, did you forget a space between the number and the keyword?/,
	);
	assert.throws(
		() => parse("node 0#nan"),
		/Invalid number suffix #nan, did you forget a space between the number and the keyword?/,
	);
	assert.throws(
		() => parse("node #nan#lorem"),
		/Unexpected hashed suffix, you cannot place suffixes on number keywords/,
	);
	assert.throws(
		() => parse("node #null#lorem"),
		/Unexpected hashed suffix, you can only place suffixes on numbers/,
	);
	assert.throws(
		() => parse('node "test"#lorem'),
		/Unexpected hashed suffix on a string, you can only place suffixes on numbers/,
	);
});

test.run();
