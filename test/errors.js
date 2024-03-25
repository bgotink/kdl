import assert from "node:assert/strict";
import {test} from "uvu";

import {parse} from "../src/index.js";

test("invalid identifiers", () => {
	assert.throws(
		() => parse("lorem[ipsum"),
		/Unexpected character \"\[\", did you forget to quote an identifier\? at 1:6/,
	);
	assert.throws(
		() => parse("lorem 2=3"),
		/Unexpected character "=", did you forget to quote a property name that isn't a valid identifier\? at 1:8/,
	);
});

test("invalid keywords", () => {
	assert.throws(() => parse("test true"), /Invalid keyword "true"/);
	assert.throws(() => parse("test false"), /Invalid keyword "false"/);
	assert.throws(() => parse("test null"), /Invalid keyword "null"/);
});

test.run();
