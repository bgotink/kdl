import assert from "node:assert/strict";
import {test} from "uvu";

import {parse} from "../src/index.js";
import {AssertionError} from "node:assert";

test("invalid identifiers", () => {
	assert.throws(
		() => parse("lorem[ipsum"),
		/Unexpected character \"\[\", did you forget to quote an identifier\? at 1:6/,
	);
	assert.throws(
		() => parse("lorem 2=3"),
		/Unexpected token "=", did you forget to quote an identifier\? at 1:8/,
	);
});

test("invalid keywords", () => {
	assert.throws(() => parse("test true"), /Invalid keyword "true"/);
	assert.throws(() => parse("test false"), /Invalid keyword "false"/);
	assert.throws(() => parse("test null"), /Invalid keyword "null"/);

	assert.throws(
		() => parse("test null true false"),
		(e) => {
			assert(e instanceof AggregateError);
			assert.equal(e.errors.length, 3);
			assert.match(e.errors[0].message, /Invalid keyword "null"/);
			assert.match(e.errors[1].message, /Invalid keyword "true"/);
			assert.match(e.errors[2].message, /Invalid keyword "false"/);
			return true;
		},
	);
});

test("empty inputs", () => {
	assert.throws(() => parse("", {as: "value"}), /Expected a value/);
	assert.throws(() => parse("", {as: "identifier"}), /Expected an identifier/);
	assert.throws(() => parse("", {as: "node"}), /Expected a node/);
	assert.throws(() => parse("", {as: "entry"}), /Expected an entry/);
});

test.run();
