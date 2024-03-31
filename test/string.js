import assert from "node:assert/strict";
import {test} from "uvu";

import {parse} from "../src/index.js";

test("\\u escapes", () => {
	assert.equal(
		parse(String.raw`"\u{10abcd}"`, {as: "value"}).value,
		String.fromCodePoint(0x10abcd),
	);
});

test.run();
