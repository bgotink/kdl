import assert from "node:assert/strict";
import {suite, test} from "node:test";

import {InvalidKdlError, parse} from "../src/index.js";

suite("errors", () => {
	test("invalid identifiers", () => {
		assert.throws(
			() => parse("lorem[ipsum"),
			/Unexpected character "\[", did you forget to quote an identifier\? at 1:6/,
		);
		assert.throws(
			() => parse("lorem 2=3"),
			/Unexpected equals sign, did you forget to quote the property name\? at 1:8/,
		);
	});

	test("multiple errors", () => {
		assert.throws(
			() => parse("test null true false [ohno]"),
			(e) => {
				assert(e instanceof InvalidKdlError);
				assert.equal(e.errors?.length, 4);
				const errors = [...e.flat()];
				assert.equal(errors.length, 4);

				assert.match(errors[0].message, /Invalid keyword "null"/);
				assert.match(errors[1].message, /Invalid keyword "true"/);
				assert.match(errors[2].message, /Invalid keyword "false"/);
				assert.match(
					errors[3].message,
					/Unexpected character "\[", did you forget to quote an identifier\?/,
				);
				return true;
			},
		);
	});

	test("empty inputs", () => {
		assert.throws(() => parse("", {as: "value"}), /Expected a value/);
		assert.throws(
			() => parse("", {as: "identifier"}),
			/Expected an identifier/,
		);
		assert.throws(() => parse("", {as: "node"}), /Expected a node/);
		assert.throws(() => parse("", {as: "entry"}), /Expected an entry/);
	});

	test("underscore after start-of-number", () => {
		const options = /** @type {const} */ ({
			flags: {experimentalSuffixedNumbers: true},
		});

		assert.throws(() => parse("- 0b_1", options), /Invalid binary number/);
		assert.throws(() => parse("- 0b_a", options), /Invalid number with suffix/);

		assert.throws(() => parse("- 0o_1", options), /Invalid octal number/);
		assert.throws(
			() => parse("- 0o__a", options),
			/Invalid number with suffix/,
		);

		assert.throws(
			() => parse("- 0x__1", options),
			/Invalid hexadecimal number/,
		);
		assert.throws(() => parse("- 0x_q", options), /Invalid number with suffix/);
	});
});
